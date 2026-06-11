# HANDOFF — Round 1 후속 버그 픽스 (네비게이션 전수조사 결과)

**작성**: 2026-06-11 · **브랜치**: `019-round1-schema-extensions` · **선행 커밋**: `1f8614c` (Round 1 구현, 미푸시)
**트리거**: 사용자 dogfooding 중 버그 보고 — "Rail에서 집필 클릭하면 홈으로, 인물 클릭하면 작품(벽)으로 간다. 전수조사해서 이번 PR에서 다 고쳐라."

## 1. 컨텍스트 (이전 세션 산출)

- Round 1(specs/019) 구현 완료·커밋됨: US1 곁쪽지 soft-delete/restore · US2 설정 서버 영속 · US3 등장인물 확장. 게이트 GREEN(backend 301 / frontend 162 + build).
- 사용자 버그 보고 직후 **읽기전용 감사 3트랙**(네비게이션 / Round 1 통합 / 횡단 정합)으로 후보 surfacing → 일부는 advisor가 직접 검증 완료, 일부는 미검증. 아래 §3·§4 분류가 그 결과.
- **이 PC 전제**: 옵시디언 vault 없음 → 진척·이슈 SoT = GitHub 이슈(#36/#37/#38, 완료 코멘트 게시됨) + repo 문서.

## 2. 근본원인 확정 (보고된 버그)

`frontend/src/lib/lastProject.ts` 의 `rememberLastProject` 는 **집필실(`/projects/[id]/write/page.tsx:68`)에서만** 호출된다. 따라서:
- 작품 상세·인물 페이지를 보고 있어도 "마지막 작품"이 기록 안 됨 → `getLastProject()`가 null
- `Rail.tsx` 의 "집필"(`:97-100`)·"인물"(`:103-106`)이 null fallback(홈/작품벽)으로 빠짐
- **Rail이 현재 URL의 작품 컨텍스트(`/projects/{id}/...`)를 전혀 안 씀** — 현재 작품 상세에 있는데도 lastProject만 봄

기존부터 있던 버그("집필" 항목)를 US3 "인물" 항목이 같은 패턴으로 답습해 표면화.

## 3. 확정 버그 (직접 검증 완료 — 수정 대상)

| # | 위치 | 증상 | 심각도 | 수정 방향 |
|---|---|---|---|---|
| A | `Rail.tsx:96-109` | 집필/인물 클릭 시 현재 경로의 projectId 무시, lastProject 없으면 홈/작품벽 | **High** | 우선순위: ① 현재 pathname 의 `/projects/(\d+)` → ② `getLastProject()` → ③ fallback. `activeProjectIdFrom` 정규식을 write 한정에서 projects 전체로 일반화 검토(QuickCapture 기본 연결도 함께 개선되는지 영향 확인) |
| B | `Rail.tsx` ITEMS match | `/projects/[id]`·`/projects/[id]/edit` 에서 모든 nav 하이라이트 꺼짐. "작품"은 `/library` 만 매칭 | Med | "작품" match 에 작품 상세/edit 포함 (단, `/write`·`/characters` 는 각자 항목이 매칭하므로 제외 규칙 필요) |
| C | `lastProject.ts` + 작품 삭제 | 작품 삭제 시 `wn:lastProjectId` 정리 없음 → stale id 로 집필/인물 진입 | Med | 삭제 성공 시(`library/page.tsx:250` 의 `useDeleteProject` onSuccess 또는 `useProjects.ts:49`) 삭제된 id == lastProject 면 clear. `clearLastProject()` 신설 |
| D | `CharacterService.kt` update + `CharacterForm.tsx` | **필드 클리어 불가** — 폼이 비운 값을 null 로 보내는데 update 는 `?.let`(null=미변경) → 성별 "선택 안 함"으로 저장해도 기존 값 유지. age/traits/shortDescription/notes 동일(기존 필드도 같은 버그 잠재) | **High** | ⚠️ 설계 결정 필요(§5-Q1). 기존 테스트 `updateCharacter only mutates specified fields`(FR-014 "null=미변경") 단정과 충돌 — 시맨틱 변경 시 테스트·FR 갱신 동반 |
| E | `CharacterPanel.tsx:68` | `character-card__meta` CSS 클래스가 어떤 CSS 파일에도 없음 → 무스타일 렌더 | Low | `desktop-app.css` 의 `.character-card__notes`(존재) 옆에 meta 스타일 추가 또는 기존 클래스 재사용 |
| F | `PreferencesSync.tsx:40-45` | **계정 전환 시 설정 누수** — `hydratedRef` 가 1회만 set, 로그아웃(`router.replace`, 풀 리로드 없음)→다른 계정 로그인 시 재하이드레이트 스킵 + 이전 계정 localStorage 값이 새 계정 서버로 PUT 될 수 있음 | **High** | hydratedRef 를 사용자 식별(me 의 userId) 단위로 리셋. 로그아웃 시 preferences store 초기화도 검토(영향: FOUC 스크립트는 localStorage 캐시 읽음 — 초기화 시점 주의) |

검증 근거: A·B·C = 코드 정독 + grep(rememberLastProject 호출 1곳뿐, removeItem 0건). D = `updateCharacter` 호출부가 폼 1곳뿐임을 grep 확인, 폼은 `gender || null` 전송. E = CSS grep 0건. F = guard 가 `["auth","me"]` 쿼리 공유·로그아웃이 SPA 내 replace 임을 코드로 확인(라이브 재현은 안 함 — 픽스 전 1회 재현 권장).

## 4. 미검증 후보 (재현 후 판단 — 무검증 수정 금지)

| 후보 | 위치 | 비고 |
|---|---|---|
| 연속 삭제 시 첫 토스트 유실(되돌리기 경로 소멸) | `memos/page.tsx:46-49` | desktop 1:1 의도와 동일 동작일 수 있음 — desktop 도 단일 슬롯. 고치려면 UX 결정 필요 |
| useDeleteMemo 낙관적 롤백이 inbox 캐시만 | `useMemos.ts:89-98` | 실패 시 서랍과 일시 불일치. onSettled 무효화로 수렴은 함 |
| characters 페이지 404 시 빈 상태만(안내 없음) | `characters/page.tsx:39-44` | C 수정하면 stale 진입 자체가 줄어듦. write/detail 페이지의 404 안내 패턴 참고 |
| `/projects/new` orphan 라우트(도달 동선 0) | `app/projects/new/` | 정리(삭제) 후보 — 사용자 컨펌 후 |
| `/auth/login-error` 등 도달 동선 | — | Kakao OAuth 콜백(백엔드 redirect)이 쓸 가능성 — 백엔드 redirect 타깃 확인 전 건드리지 말 것 |
| IME compositionend 후 동기화 지연 / 복원 editorKey 비대칭 | `PaperEditor.tsx`·`write/page.tsx` | **고위험 — 016 IME 오진 회귀 이력**(agent-workflow-discipline §11). 라이브 한글 재현 없이 수정 금지. 이번 PR 범위에서 빼고 이슈로 분리 권장 |
| restore 멱등 200 / memo size:100 | — | 의도된 설계·명시된 베타 제약 — 버그 아님, 수정 불필요 |

## 5. 시작 전 사용자 인터뷰 필요 (확정 후 구현)

- **Q1 (D 관련)**: 인물 편집 폼의 "비우기" 시맨틱. 옵션: (a) UpdateCharacterRequest 를 "폼 전체 상태 PUT" 시맨틱으로 — 보낸 요청의 null=클리어 (기존 FR-014·테스트 갱신, 파급: 폼 외 호출자 없음을 확인했으므로 안전) (b) 빈 문자열 sentinel — FE 가 "" 전송, BE 가 ""→null 클리어, null=미변경 유지 (FR 보존, 다소 우회적). 권장 후보: (a) — 호출부가 폼뿐이고 폼은 항상 전체 필드 전송.
- **Q2 (범위)**: §4 미검증 후보 중 이번 PR에 포함할 것(특히 `/projects/new` 삭제, characters 404 안내). IME 트랙은 분리 권장.

## 6. 환경 (이 PC)

- **로컬 스택**: 핸드오프 시점 실행 중이나 세션 종료로 죽었을 수 있음 — 재기동:
  - DB: `docker start write-note-pg-local` (또는 `docker run -d --name write-note-pg-local -e POSTGRES_DB=writenote -e POSTGRES_USER=writenote -e POSTGRES_PASSWORD=writenote-local-dev -p 5433:5432 postgres:17-alpine`)
  - 백엔드: `cd backend && SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/writenote ./gradlew bootRun --args='--spring.profiles.active=local'` (8080. 점유 시 `--server.port=8081` + 프론트 `BACKEND_ORIGIN`)
  - 프론트: `cd frontend && export PATH="$HOME/.nvm/versions/node/v22.19.0/bin:$PATH" && pnpm dev` (3000)
- **테스트 계정**: `test@writenote.local` / `WriteNote2026!` (5433 DB, 작품 "첫 소설"+인물 2+곁쪽지 2 시딩됨)
- **⚠️ 5432 는 무관한 타 프로젝트 `writing-app-db` — 절대 stop/rm 금지.** write-note 테스트는 `SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5433/writenote ./gradlew test` 오버라이드. 단 `BackendApplicationTests."test profile starts without production secrets"` 1건은 URL 문자열 5432 단정이라 5433 에선 실패(환경 인공물 — 기능 회귀 아님). 최종 클린 게이트가 필요하면 사용자 컨펌 받고 writing-app-db 잠시 stop→compose postgres(5432)→게이트→복원(이전 세션에서 1회 수행한 절차).
- **pnpm**: PATH 에 nvm node 22.19 필요. vitest 는 `export ESBUILD_BINARY_PATH="$PWD/node_modules/.pnpm/@esbuild+darwin-arm64@0.21.5/node_modules/@esbuild/darwin-arm64/bin/esbuild"` 선행(esbuild postinstall 미실행 머신). `pnpm-lock.yaml`(v6)·`pnpm-workspace.yaml` 은 pnpm 11 이 자동 변경/생성하므로 **커밋 전 디프 확인·제외**.
- **미커밋 잔여**: `.gitignore`(+`.gstack/` — gstack 부산물, Round 1 무관) / `.claude/worktrees/` untracked — 이번 PR 에 포함하지 말 것.

## 7. 완료 기준

1. §3 A~F 수정 + 각 버그당 회귀 테스트(재현→RED→GREEN)
2. §4 중 사용자가 포함시킨 항목 수정
3. 전체 게이트: backend `ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build` + frontend `typecheck && lint && test && build`
4. 실브라우저 dogfooding: 작품 상세→Rail 집필 클릭→그 작품 집필실 / 인물 클릭→그 작품 인물 / 계정 전환 설정 격리 / 인물 성별 비우기 저장
5. 같은 브랜치(`019-round1-schema-extensions`)에 fix 커밋(사용자 지시: "이번 PR에서 다 고쳐")
6. GitHub 이슈 코멘트로 버그·픽스 기록(vault 부재 — 이슈가 SoT). Rail 버그는 #38 코멘트 또는 신규 이슈로
