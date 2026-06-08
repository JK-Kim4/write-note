# Desktop Phase 3 — Projects Workspace (실데이터 결선 + 작품 화면 craft + genre)

- 일자: 2026-06-04
- 브랜치: `feat/desktop-phase3-projects-workspace` (미merge)
- 관련 커밋: `6b9d6e4` (preload fix — sandbox:true) · `b9bdfed` (Phase 3 feat)
- 작업 시간 (대략): 진척 파악 → 컨텍스트 인터뷰(A~E) → TDD 구현 → dogfooding 회귀 수정 → impeccable craft → 커밋

## 1. 무엇을 했는가 (사실)

- ProjectsScreen 을 더미 배열 → `electronAPI.projects.list/create` 실데이터로 결선. App 에 `activeProject` 진입 상태, WriteStudio 제목 동적화.
- `projectRepository.list` 정렬을 `created_at DESC` → `updated_at DESC, created_at DESC` 로 변경(결정적 timestamp 테스트로 RED→GREEN).
- `src/lib/projectView.ts`(도메인 Project → ProjectCardView, 상대시간 라벨) 신설 + 테스트.
- preload 회귀 수정 — `main.ts` `sandbox:false → true`.
- impeccable craft — 작품 화면 3상태 분리(작업실 입구 / 목록 / 생성), 빈 화면 surface 시트화, 작품 카드 고운바탕 serif 제목, 생성 폼 인라인 전환(모달 회피).
- DB 확장 — `projects.genre` 컬럼 + schema v1→v2 마이그레이션(기존 .db ALTER), 생성 폼 "추가 정보" disclosure(장르·목표 분량·톤).
- `src/types.ts` orphan `Project` 타입 제거. 최종 44 tests + build GREEN.

## 2. 어떻게 했는가 (접근)

- 사용자가 "추측/단정 반복 문제" 를 명시 지적 → 모든 결정 전 코드/문서 **직접 읽기**로 사실 확정(genre 부재, list 정렬, `.screen-main` flex-center, `Titlebar.right` optional, app.css 토큰 존재, project-card 정의).
- 본질 격차 5개(A 생성 폼 필드 / B 정렬 / C 목록 위치 / D view 타입 / E 테스트 모킹)를 인터뷰로 사용자 확정 후 구현.
- 전 단계 TDD(RED→GREEN). 환경은 §8 선확인으로 Node 24.14.0·corepack pnpm 8.15.5(lockfile v6.0 호환) 고정.
- preload 원인은 추측 없이 콘솔 에러 요청 + Electron 공식 문서 2회 검증(sandbox / esm) 후 옵션 제시.

## 3. 잘 된 점

1) **추측 배제가 실제로 작동** — genre 가 도메인에 없음을 직접 grep 으로 확인해 임의 결정 차단. 근거: A 인터뷰에서 "genre 는 스키마에 없음" 을 격차로 surfacing, 사용자가 DB 확장 trade-off 보고 결정.
2) **preload 진단이 추측 0** — 콘솔 에러(`require is not defined in ES module scope`) → 산출물 비교(main ESM / preload CJS) → 공식 문서 검증 → `sandbox:true`. agent-workflow §1(옵션 표 전 검증) 준수.
3) **환경 선확인(§8)이 사전 차단** — Node 20.10 ↔ .nvmrc 24 불일치, pnpm PATH 이탈, lockfile v6.0 비호환을 빌드 전 파악. 재시도 0.
4) **TDD 일관** — 정렬/매핑/화면/genre/마이그레이션 각 RED→GREEN, 재시도 0. 마이그레이션은 신규 DB·기존 v1 DB(ALTER) 양쪽 검증.

## 4. 어긋난 점

- **preload 결선이 Phase 1부터 깨져 있었다** — `sandbox:false`(ESM preload 의도)가 vite-plugin-electron 의 CJS preload(.mjs)와 충돌. renderer 가 `electronAPI` 를 처음 호출하는 Phase 3 dogfooding 에서야 표면화(Phase 1·2 는 renderer 가 electronAPI 미사용이라 콘솔 에러만 나고 화면 영향 0). **회피 가능 시점**: Phase 1 scaffold 때 renderer 에서 `window.electronAPI` 존재를 1회 smoke test. 빌드 산출물(typecheck/build)만으론 안 드러남.
- **빈 화면 첫 구현이 빈약** — 텍스트를 나무 책상 배경(`--bg`) 위에 직접 올려 대비 미달(muted 가독성). DESIGN.md paper-on-desk 원칙을 빈 화면에 첫 구현 때 적용했어야. 사용자 "배경 없다" 지적 후 surface 시트로 수정.
- 멈춤/피드백 신호: dogfooding 정상 루프 내 피드백 3회(list 에러 / 디자인 없음 / 배경 없음). 같은 에러 3+ 재시도·30분+ 디버깅 루프는 없음.
- genre 는 A 에서 제거 확정 후 디자인 단계에서 사용자 재요청 → DB 확장. 요구 변화라 어긋남은 아니나, 트랙 누적(§3)은 명시 보고함.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- renderer 가 preload 노출 IPC(`window.electronAPI`)를 처음 쓰는 Phase 에선 **존재 smoke test** 먼저.
- 빈 상태/입구 화면도 첫 구현부터 paper-on-desk(surface 시트) 적용 — 맨 배경 위 텍스트 금지(대비 미달).
- 로컬 sqlite 스키마 변경은 `migrate` 에 `user_version` 기반 ALTER 분기 + 신규/기존 DB 양쪽 테스트로 영구화.

### 5-2. 룰 갱신 후보 (적용 완료)

**`agent-workflow-discipline.md` §8 보강 — 적용 완료(본 커밋)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` §8 (Electron 환경 선확인)
- (2) 추가: self-check 5번째 항목 "preload 결선 ↔ sandbox 정합 + smoke test" + 2026-06-04 Phase 3 회귀 사례(동종 환경 함정 3세션 연속).
- (3) 근거: 본 회고 §4 — Phase 1~3 에 걸친 preload 결손.
