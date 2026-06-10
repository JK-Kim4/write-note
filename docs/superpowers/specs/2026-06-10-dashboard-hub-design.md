# 대시보드 허브 (재진입 허브) — 설계

> **작성일**: 2026-06-10 · **브랜치**: `feat/studio-three-panel` · **버전: v4 (v3 + 집필 리듬 그래프·2단 배치)**
> **v4 갱신 (2026-06-10, 사용자 결정)**: 시간 표시를 문자열에서 **그래프(집필 리듬 카드)** 로 — 레이아웃을 **2단(B안)** 으로 재편. 목업 `docs/design/web/mockups/dashboard-time-graph-b.html`(높이 정렬판)이 채택안. 목표 게이지·등급·배지는 여전히 배제.
> **전제**: 내용 방향 **A. 재진입 허브** 사용자 확정. IA = `/`가 새 홈(대시보드), 기존 작품 벽 → `/library`.
> **목업**: v4 채택안 = `dashboard-time-graph-b.html` (구판 `dashboard-reentry-hub.html`·A안 `dashboard-time-graph.html`은 참고용)
> **원칙**: PRODUCT.md — "카드 그득한 SaaS 대시보드" 금지 / 게이미피케이션 배제 / AI·자동 생성 배제 / 원칙 4 v2(작업 리듬 인디케이터는 연속 작업 유도 신호로 허용)
> **v3 갱신 (2026-06-10, 사용자 결정)**: **백엔드 확장 포함** — (a) 기간 단위 작업시간 집계(주간 지표용) (b) 카드 집계 endpoint(N+1 축소). 표시 = "이번 주 집필 시간" 한 줄 + 이어서 쓰기 메타의 누적 총시간 **둘 다**. v2의 "백엔드 변경 0" 제약은 폐기.

---

## 1. 화면 구성 (v4 — 2단 B안)

`/` 진입 시: 인사 아래 **2단 그리드(좌 1.6fr / 우 1fr, 1080px 컨테이너)** + 하단 전폭 곁쪽지 줄. 모두 읽기 전용 + 진입 동작만(이 화면에서 편집하지 않는다).

| # | 블록 | 내용 | 동작 |
|---|---|---|---|
| ① | 인사 + 날짜 | 인사 한 줄(이름 없음) + "YYYY년 M월 D일 X요일" | 없음(정적) |
| ② | **좌** 이어서 쓰기 | 섹션 헤더(라벨 + 우측 "모든 작품 보기 →") + **최근작 1편** 최대 타일: 제목 + 마지막 문장(세리프 인용) + 다음 장면 + "N시간 전 저장 · N자" (**총시간 토막은 ③ 카드로 이동**) + [이어서 쓰기 →] | 타일/버튼 → 집필실 · 링크 → `/library` |
| ③ | **우** 집필 리듬 카드 | (a) "이번 주" 합계 + **요일 막대 7개**(월~일, 오늘 잉크블루 강조, 0분=가는 선) (b) 구분선 (c) **작품별 쌓인 시간** 가로 막대(최다 작품 강조) + 총합. **우측 카드 하단은 좌측 칼럼 바닥선과 정렬(stretch)** | 없음(정적) |
| ④ | **좌** 작품 | 최근작 제외 나머지 미니 카드 **2열**(제목 + 마지막 문장 2줄 클램프). "+ 새 작품" 카드는 v4에서 제거 — 새 작품은 "모든 작품 보기" → `/library` 경유 | 카드 → 집필실 |
| ⑤ | **하단 전폭** 최근 곁쪽지 | 섹션 헤더(라벨 + "모든 곁쪽지 보기 →") + 최신 곁쪽지 **3장** + **"+ 새 곁쪽지"** 점선 카드(본문 4줄 클램프) | 카드 → `/memos` · 새 곁쪽지 → 빠른 메모(QuickCapture) 모달 · 링크 → `/memos` |

- 860px 이하에서 2단은 1단 스택, 곁쪽지는 2열.

- 인사말에 **이름을 쓰지 않는다** — 사용자 이름 데이터 부재(`AuthMeResponse` = userId/email/kakaoLinked뿐. 목업 "나래님"은 더미).
- **시간 표시는 ③ 집필 리듬 카드로 일원화**(v4): 주간 요일 막대(연속 작업 유도) + 작품별 누적 막대(작품과 함께한 무게). 목표 게이지·등급·배지·자동 인용구 — **제외 유지**.

## 2. 데이터 매핑 — 타일별 출처 (표시값 출처 명시, agent-discipline §9)

| 표시값 | 분류 | 출처 |
|---|---|---|
| 인사·날짜 | 클라 정적 | `new Date()` 한국어 포맷(마운트 후 렌더 — hydration 정합) |
| 최근작 선정 | 파생 | 카드 목록을 **문서 저장 시각(`documentUpdatedAt`) 내림차순**(동률 시 id 내림차순) 정렬, 첫 번째 = ②, 나머지 = ④ |
| 제목·다음 장면 | 저장 입력 | 카드 응답 `title` / `nextScene` (기존) |
| 마지막 문장 | 파생 표시 | 작품별 문서 본문 → `extractPlainText` → `lastSentence()` — **클라 파생 유지**(백엔드는 본문 텍스트 파생 없음, §3) |
| "N시간 전 저장" | 파생 표시 | `documentUpdatedAt` → 시간 단위 상대 포맷(신규 순수함수) |
| "N자" | 파생 표시 | `wordCount` — **신규 카드 집계 endpoint**(§4 BE-2)가 동봉 |
| 작품별 누적 막대(③b) | 파생 표시 | `totalDurationMs`(카드 집계 동봉) — 최대값 기준 상대 폭 + `formatDuration`. 누적 0 작품은 행 생략, 전부 0이면 절 생략 |
| 요일 막대(③a) | 파생 표시 | **기간 합계 endpoint(§4 BE-1)를 요일별 7회 병렬 호출**(로컬 자정 경계 `[일 시작, 다음날 시작)`) — 백엔드 변경 0. 오늘 이후 요일은 호출 없이 0. 주간 합 0이면 합계 자리 "기록 없음"(`formatDuration(0)`) |
| 최근 곁쪽지 | 저장 입력 + 파생 라벨 | 기존 `useInboxMemos()` → `capturedAt` 내림차순 상위 **3** + 기존 `formatRelativeDay` 재사용 |

## 3. 데이터 경로 — 카드 집계 + 마지막 문장 클라 파생 (v3 확정)

**현황(코드 사실)**: `frontend/src/lib/electron-api/projects.ts:39`의 `listCards()`가 `lastSentenceSource: ""` placeholder 반환 → **작품 벽 마지막 문장이 현재 전부 빈 상태**(015 설계와 어긋난 구현 격차). 또한 글자수·저장시각·누적시간을 화면이 쓰려면 작품별 N+1 추가 조회가 필요한 구조였다.

**v3 해소**: 백엔드 카드 집계 + 프론트 본문 파생의 혼합 —

```
listCards =
  GET /api/projects/cards (1회)                  ← 신규 BE-2: 제목·다음 장면 + wordCount·documentUpdatedAt·totalDurationMs 동봉
  + 작품별 getProjectDocument(id) 병렬 (N회)      ← 마지막 문장 파생 원료(본문)만 — 클라 파생 유지
  → ProjectCard { ...card, lastSentenceSource: extractPlainText(doc.body) }
```

- **마지막 문장을 클라 파생으로 유지하는 이유**(사용자 결정 — "주간+카드 집계" 범위): 백엔드가 본문(ProseMirror JSON)을 파싱하거나 비정규화 컬럼을 추가하는 것은 베타 작품 수 대비 과투자. 문서 N조회는 남지만 v2의 2N(문서+total)에서 N으로 줄고, 집계 숫자(글자수·시각·시간)는 조인 1회로 정리된다.
- 효과: 대시보드(②④)와 **작품 벽이 한 번에** 015 설계대로 동작(마지막 문장 회복). 캐시 키(`projectKeys.cards()`) 공유로 화면 이동 시 재호출 없음.
- 기각 대안: (v2안) 전부 클라 N+1 조립 — 백엔드를 여는 결정으로 대체. (전부 BE 집계) 마지막 문장까지 백엔드 파생 — 파싱/비정규화 과투자, 기각(사용자 결정).

## 4. 백엔드 확장 명세 (신규 — Kotlin/Spring, TDD)

### BE-1. 기간 작업시간 합계 — `GET /api/work-sessions/total?from={ISO}&to={ISO}`

- **의미**: 인증 사용자의 **전체 작품 횡단**, `from ≤ startedAt < to`인 **종료된 세션**(진행 중·폐기 제외 — 기존 `/total` 규약 동일)의 duration 합. 응답 = 기존 `TotalDurationResponse { totalDurationMs }` 재사용.
- **시간대 규약**: 서버는 시간대 무지 — 프론트가 사용자 로컬 기준 "이번 주 월요일 00:00"을 ISO instant로 환산해 전달. 주 경계에 걸친 세션은 `startedAt` 기준 귀속(단순·결정적).
- **검증**: `from < to` 필수(위반 시 400 VALIDATION_FAILED), 401은 기존 공통.
- **작업**: 컨트롤러 메서드(작품 경로 밖 신규 매핑) + 서비스 + 리포지토리 SUM 쿼리 + IT/단위 테스트.

### BE-2. 작품 카드 집계 — `GET /api/projects/cards`

- **의미**: 인증 사용자의 **활성 작품 전량**(베타 소수 전제, 페이지네이션 없음 — 단순 배열)을 카드용 집계와 함께 반환.
- **응답** `ProjectCardResponse[]`: 기존 `ProjectResponse` 필드 전부 + `wordCount`(문서 글자수) + `documentUpdatedAt`(문서 저장 시각) + `totalDurationMs`(누적 작업시간 — 종료 세션 합).
- **구현 방향**: 작품(1:1 문서)·세션 합계 조인/그룹 쿼리 — N+1 SQL 금지(글로벌 JPA 룰). 기존 `GET /api/projects`(페이지네이션 목록)는 **불변**(기존 소비처 보호).
- **작업**: 컨트롤러 + 서비스 + 리포지토리(집계 쿼리) + DTO + IT/단위 테스트.

### 공통

- 읽기 전용 2종 — 에러는 표준(401 AUTH_TOKEN_* / 400 VALIDATION_FAILED). `docs/plan/03-backend-requirements.md` 에러 매트릭스에 신규 코드 추가 없음.
- 게이트: `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` (포어그라운드).
- 계약 문서: spec/plan 단계의 contracts에 요청/응답 JSON 예시 박음. 프론트 shim(`electron-api`)이 이 계약의 소비자.

## 5. 라우팅 · Rail 재편 (`/` → `/library` 영향 전수 — v2와 동일, 변경 없음)

### 5-1. 라우트
- `src/app/page.tsx` → **신규 대시보드**(`'use client'` + `useAuthGuard("requireAuth")` + `.app` 셸 유지).
- 기존 ProjectsWallPage → `src/app/library/page.tsx` 이동(내용 불변). `?new=1`이면 create 모드 진입(`useSearchParams`는 Suspense 경계 — `auth/verify` 전례 패턴).

### 5-2. Rail
| 항목 | 변경 |
|---|---|
| **홈** (신규, 최상단) | `href:"/"`, `match: p === "/"` |
| 작품 | `href:"/" → "/library"`, `match → p.startsWith("/library")` |
| 집필 | fallback `push("/")` 유지(마지막 작품 없으면 대시보드) |
| 메모·기록·문의·잉크 한 방울 | 불변 |

Titlebar: 대시보드 = "홈", library = "작품"(기존).

### 5-3. 기존 `"/"` 참조 전수 (grep 검증 완료)
| 위치 | 처리 |
|---|---|
| 집필 page 작업 종료 후 `push("/")` | 유지(귀환점 = 대시보드) |
| 집필 page 에러 "작품 벽으로" 버튼 | `push("/library")`로 변경 |
| 레거시 상세(`projects/[id]`)·로그인 후·가드·not-found·verify-done | 유지(`/` = 홈) |
| `rememberLastProject` | 불변 — 대시보드는 미사용(`documentUpdatedAt` 정렬, 기기 간 일관) |

## 6. 빈 상태

| 상황 | 표시 |
|---|---|
| 작품 0 | 2단 대신 환영 블록(벽 `welcome` 톤) + "첫 작품 시작하기" → `/library?new=1` |
| 본문 0 | 마지막 문장 자리 = "아직 첫 문장을 기다리는 중"(벽과 동일 카피) |
| 다음 장면 빈 문자열 | 줄 숨김 |
| 작품 1편뿐 | ④ 미니 카드 영역 생략(좌측은 타일만) — 우측 리듬 카드는 유지 |
| 이번 주 0분 | 합계 자리 "기록 없음" + 막대 전부 가는 선(카드 자체는 유지 — 압박 없는 사실 표시) |
| 누적 전부 0 | 작품별 절 생략(주간 절만) |
| 곁쪽지 0 | 라벨 유지 + "아직 곁쪽지가 없어요" 한 줄 |
| 로딩/에러 | 벽과 동일 패턴(skel / 재시도). 카드·주간 조회 부분 실패 시 반쪽 렌더 금지 |

## 7. 스타일 — 웜 토큰 재사용 (확정, v2와 동일)

- 목업의 대시보드 클래스(`.dash-*`, `.resume*`, `.work-card*`, `.memo-card*`, ghost 한 줄)를 `desktop-app.css`로 이관, 값은 전부 기존 토큰 계승(전 토큰 존재 grep 확인). 다크는 `.dark` variant 자동.
- ③ 집필 리듬 카드(v4): 막대는 토큰만(주간 `--scrap-edge`/오늘·최다 `--accent`/0분·트랙 `--hairline`), 등급·퍼센트 라벨 없음. 섹션 링크(`.sec-link`)·곁쪽지 4열·새 곁쪽지 점선 카드도 목업 B에서 이관.
- 접근성: 대비 AA, button/link 시맨틱 + 포커스 가시, `prefers-reduced-motion` 대응.

## 8. 컴포넌트 분해 · 테스트 (TDD)

| 단위 | 책임 | 테스트 |
|---|---|---|
| **BE** `WorkSession*`(기간 합계) | §4 BE-1 | 단위(서비스·경계값 from/to) + IT — **선작성** |
| **BE** `Project*`(카드 집계) | §4 BE-2 | 단위 + IT(조인 집계 정확성) — **선작성** |
| `lib/dashboardView.ts` (신규 순수) | 정렬·선정 + 시간 단위 상대 포맷 + 주 시작(월요일) 계산 | vitest 단위 — **선작성** |
| `electron-api/projects.ts` `listCards` | 카드 endpoint + 문서 N병렬 + 파생 채움(§3) | 기존 테스트 패턴 확장 — **선작성** |
| `lib/query/useSessions`(훅) | v4: `useWeeklyByDay` — 요일별 7회 병렬(오늘 이후 0), 캐시 키 = 주 시작+오늘 | page RTL 로 커버 |
| `components/dashboard/ResumeCard·WorkMiniCard·RhythmCard` | ②④③ 표시 전용(props만). ResumeCard 메타에서 총시간 토막 제거(v4) | RTL 행위 |
| `app/page.tsx` (대시보드) | 훅 조립 + 빈 상태 분기 | RTL 통합(쿼리 mock) |
| `app/library/page.tsx` | 기존 벽 + `?new=1` | 렌더 스모크 + searchParam 1건 |
| `Rail.tsx` | §5-2 재편 | page RTL 네비 단언 |

게이트: **FE** vitest → `tsc --noEmit`(기존 1건 무시) → `eslint src` → `pnpm build`(RSC, 작성 직후). **BE** ktlint(main+test)+checkstyle+test+build. 전부 포어그라운드. 기존 무관 부채(`documents.test.ts`·집필 page lint) 불변.

## 9. 범위 밖

- 게이미피케이션 장치(streak·**목표 달성 게이지·등급/배지 라벨**) — 원칙 4 완화 후에도 배제. 시간 **막대 그래프 자체는 v4에서 허용**(평가·목표 없는 사실 표시). 자동 인용구 — "마찰 설계 > 자동화" 위배.
- 영감 보드 · Library 정식 재구성 · 작품별 대시보드(옛 2026-05-31 spec) — 별도 spec.
- 메모 delete/restore 등 015 보류 트랙 — 불변.
- 마지막 문장의 백엔드 파생(본문 파싱/비정규화) — 과투자로 기각(사용자 결정). 작품 수 증가 시 재검토.
