# Research: 대시보드 허브 (018, v3)

Phase 0 산출. v3 신규(백엔드 확장) 결정 + 구 plan(v2)에서 유효 승계한 FE 결정. NEEDS CLARIFICATION 잔여 0건.

## A. 백엔드 (v3 신규)

### R-B1. 기간 합계의 컨트롤러 위치 — 신규 횡단 컨트롤러

- **Decision**: `WorkSessionTotalController`(신규, `@RequestMapping("/api/work-sessions")`)에 `GET /total?from=&to=`. 기존 `WorkSessionController`는 불변.
- **Rationale**: 기존 컨트롤러는 클래스 레벨 `@RequestMapping("/api/projects/{projectId}/work-sessions")`로 작품 경로에 고정(Read 확인) — 작품 횡단 endpoint를 끼워 넣을 수 없다. 응답은 기존 `TotalDurationResponse` 재사용.
- **Alternatives considered**: 기존 컨트롤러에 절대 경로 메서드 추가(클래스 매핑과 충돌·혼란, 기각) · `/api/projects/work-sessions/total`(작품 컬렉션 의미와 불일치, 기각).

### R-B2. 기간 합계 쿼리 — JPQL join + 서비스 합산

- **Decision**: `WorkSessionRepository`에 JPQL — `WorkSession w JOIN Project p ON w.projectId = p.id WHERE p.userId = :userId AND w.endedAt IS NOT NULL AND w.startedAt >= :from AND w.startedAt < :to` 로 세션 목록 조회 → 서비스에서 `sumOf(endedAt - startedAt)` 합산. `@Transactional(readOnly = true)`.
- **Rationale**: `WorkSession`에 userId가 없어(엔티티 Read 확인 — 작품 경유 격리) projects join이 필수. duration 합산을 Kotlin에서 하는 것은 기존 `totalDurationMs`(`WorkSessionService:71` — 목록 조회 후 `sumOf`) 스타일과 일관. 베타 세션 수 소수 전제.
- **Alternatives considered**: SQL SUM 집계(@Query nativeQuery) — 기존 스타일과 이질 + Instant 연산 방언 의존, 기각. 아카이브 작품 제외 — "집필 시간"은 보관 여부와 무관한 사실이므로 **전체 작품 포함**(기존 작품별 total도 아카이브 구분 없음).

### R-B3. 카드 집계 쿼리 전략 — 3쿼리 일괄 + 서비스 조립

- **Decision**: `ProjectService.listCards(userId)` = ① 활성 작품 일괄(`userId + archivedAt IS NULL`, 기존 목록 쿼리 재사용 가능) ② `DocumentRepository.findByProjectIdIn(ids)` ③ `WorkSessionRepository.findByProjectIdInAndEndedAtIsNotNull(ids)` → 서비스에서 projectId 기준 그룹 조립 → `ProjectCardResponse[]`. 페이지네이션 없는 단순 배열(활성 전량, 베타 소수 전제 — spec Assumption).
- **Rationale**: 쿼리 3회 고정 — 작품 수와 무관(SQL N+1 금지, 글로벌 JPA 룰). Document는 작품 1:1(unique project_id — 엔티티 Read 확인)이라 조립이 단순. `body`(jsonb 본문)는 응답에 **포함하지 않는다**(마지막 문장은 FE가 별도 문서 조회로 파생 — 사용자 결정, 페이로드 비대 방지).
- **Alternatives considered**: 단일 JPQL 멀티 조인 DTO 프로젝션 — 세션 집계와 1:1 문서를 한 쿼리에 욱여넣으면 GROUP BY 복잡도만 증가, 기각. 기존 `GET /api/projects` 응답 확장 — 기존 소비처 전 화면에 집계 비용 전가 + 계약 변형, 기각(FR-013).

### R-B4. from/to 파라미터 규약

- **Decision**: `@RequestParam from: Instant, to: Instant` — ISO-8601 instant 문자열(`2026-06-08T15:00:00Z` 형태)을 Spring 기본 변환으로 수신. `from >= to`면 400 VALIDATION_FAILED(기존 에러 경로). 시간대 환산("이번 주 월요일 0시" → UTC instant)은 FE 책임 — 서버 시간대 무지.
- **Rationale**: 에러 매트릭스(`docs/plan/03-backend-requirements.md` §3-1)에 신규 코드 추가 없이 기존 400/401 재사용. 주 경계 세션은 `startedAt` 기준 귀속(이중 계산 없음·결정적 — spec US3).
- **Alternatives considered**: `week=2026-W24` 파라미터(서버가 주 경계 계산 — 시간대 가정 필요, 기각) · epoch millis(가독성·디버깅 열세, 기각).

## B. 프론트엔드 (구 plan에서 유효 승계 + v3 갱신)

### R-F1. listCards 데이터 경로 (v3 갱신)

- **Decision**: `listCards()` = `GET /api/projects/cards` 1회(집계 동봉) + 작품별 `getProjectDocument(id)` 병렬 N회(마지막 문장 원료 `extractPlainText(doc.body)`만). 실패 시 전체 reject(부분 성공 배열 금지). `ProjectCard` = 카드 응답 + `lastSentenceSource`.
- **Rationale**: 작품 벽 마지막 문장 placeholder 격차(`electron-api/projects.ts:39` — Read 확인) 해소를 겸한다. v2안(클라 2N 조회) 대비 N으로 축소, 집계 숫자는 서버 정합(기록 화면과 동일 데이터 기준 — spec SC-005).

### R-F2. 최근작 선정·정렬 (승계)

- **Decision**: `documentUpdatedAt` 내림차순 + 동률 시 `id` 내림차순(결정적). 순수함수 `selectDashboard(cards)`. `project.updatedAt`(메타 변경 시각)·`rememberLastProject`(기기 종속) 미사용.

### R-F3. 상대 시간·주 시작 계산 (승계 + v3 추가)

- **Decision**: "N시간 전 저장" = 신규 `formatRelativeTime`(방금/N분 전/N시간 전/N일 전, `now` 주입) — 기존 `formatRelativeDay`는 일 단위라 부적합(확장은 기존 소비처 영향 — Surgical 위반, 기각). "이번 주" 경계 = 신규 `startOfWeekMonday(now)`(로컬 월요일 00:00 → Date) — `useWeeklyTotal`이 ISO 변환해 `from/to` 전달 + 캐시 키에 주 시작 포함. 곁쪽지 = 기존 `formatRelativeDay`, 작업시간 = 기존 `formatDuration` 재사용.

### R-F4. `/library?new=1` — Suspense 전례 (승계)

- **Decision**: `auth/verify/page.tsx` 패턴(외곽 `<Suspense>` + 내부 컴포넌트에서 `useSearchParams`) 그대로. `?new=1`이면 벽 `mode` 초기값 `"create"`.
- **Rationale**: 코드베이스 전례 2곳 + 공식 문서 `node_modules/next/dist/docs/.../use-search-params.md` 실재 확인(AGENTS.md 정합 — implement 시 정독 게이트).

### R-F5. 날짜·상대시각 hydration 정합 (승계)

- **Decision**: `new Date()` 의존 표시(인사 날짜·상대시각)는 클라 마운트 후 렌더(mount 게이트, 자리 유지). `suppressHydrationWarning`(은폐)·서버 시각 주입(과설계) 기각.

### R-F6. 테스트 전략·분포 (승계 + BE 추가)

- **Decision**: TDD 순서 — [BE] 서비스 단위(기간 경계·0 응답·소유권) → 컨트롤러 IT → [FE] `dashboardView.test.ts` → shim(`projects.test.ts` 확장 — 기존 파일·mock 패턴 확인됨) → 컴포넌트 RTL → page RTL. 벽·Rail 기존 테스트는 **부재**(확인) — 벽 이동은 `?new=1`+렌더 스모크로 보호, Rail은 page RTL 네비 단언.

### R-F7. 빈 상태·스타일 재사용 (승계)

- **Decision**: 작품 0 = 벽 `.welcome` 재사용(`desktop-app.css:1031` 확인) + CTA → `/library?new=1`. 로딩 = `.projects-skel`(:1027). 신규 대시보드 클래스는 목업에서 이관, 웜 토큰 계승(전 토큰 존재 확인). "이번 주" 한 줄은 목업 ghost의 점선 박스를 조용한 텍스트 줄로 낮춤(점선·태그는 목업 장치).
