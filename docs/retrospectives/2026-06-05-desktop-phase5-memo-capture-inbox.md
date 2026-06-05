# Phase 5 빠른 메모 캡처 + Inbox — SDD 풀파이프 첫 완주

- 일자: 2026-06-05
- 워크트리 / 브랜치: write-note / `007-phase-5-memo-capture-inbox` → develop merge 후 삭제
- 관련 커밋: 작업지시서 `b2abc16` · spec `818bff8` · plan `ac4ab39` · tasks `72d5f87` · 구현 `87c92a9` · 스타일 `e2faa22` · 문서 `02d0318`/`b83e377` · merge `386aac1`
- 작업 시간 (대략): 단일 세션 (브레인스토밍 ~ merge ~ 회고)

## 1. 무엇을 했는가 (사실)

- **브레인스토밍**으로 2개 본질 결정 확정: soft delete + 즉시 숨김 + 되돌리기 토스트 / 캡처 진입점 2개(빠른 메모 모달 + inbox 인라인) 모두 결선.
- **SDD 풀파이프 완주**: 작업지시서(`docs/superpowers/specs/2026-06-05-...design.ko.md`) → speckit-specify(spec.md + checklist 12/12) → plan(research/data-model/contracts/quickstart) → tasks(31개) → analyze(A1·C1 surface) → implement → dogfooding → merge.
- **백엔드**: `memos.deleted_at` 컬럼(스키마 v2→v3 ALTER) + `softDelete`/`restore` repository + IPC `memos.delete`/`restore`(contract/handlers/preload).
- **렌더러**: `QuickCapture` 결선(activeProjectId/onCaptured + 빈값 가드) · `MemoInboxScreen` 전면 결선(memos.list + projects.list 자체 fetch, 필터, 삭제/토스트) · `Toast` 신설 · `memoView` 매퍼 신설 · `relativeDate` 공용 추출(projectView 행위 보존) · App `memoRefresh` 브리지.
- **검증**: TDD 14 files 75 tests(+24, 회귀 0) + tsc + vite build GREEN. 삭제 버튼·토스트 CSS 추가.
- **dogfooding 통과**(사용자 직접): 캡처·자동연결·전체/미연결 필터·삭제/되돌리기·실데이터 inbox 정상.
- 진척 문서(vault `02-PROGRESS.md` · `docs/desktop-mvp-progress.html` · `docs/phase/README.md`) Phase 5 완료(62.5%) 반영, develop merge + feature 브랜치(로컬·원격) 삭제.

## 2. 어떻게 했는가 (접근)

- **브레인스토밍 → speckit** 두 단계 분리: 브레인스토밍으로 설계를 확정해 작업지시서에 박고, 그걸 speckit-specify 입력 brief로 사용. spec은 WHAT/WHY만, 구현 디테일(IPC·deleted_at)은 plan으로 위임 → spec 품질 checklist 12/12 통과.
- **TDD 순서 준수**: Foundational에서 테스트 4종(schema·memoRepository·relativeDate·memoView) 먼저 작성 → RED 확인(7 fail) → 구현 → GREEN. UI 결선은 행위 테스트(`MemoInboxScreen.test.tsx`)로 보호.
- **상태 관리 결정**: 기존 `ProjectsScreen` 자체-fetch 패턴과 일관 + 화면 밖 모달 교차 갱신을 위해 App `memoRefresh` 카운터 브리지. (대안 "App이 메모 목록 소유"는 패턴 불일치로 기각.)
- **dogfooding 버그 진단**: 사용자의 "메모 추가 안 됨"·"작품 삭제해도 연결 유지" 보고에 추측으로 코드를 고치지 않고, ① DB 직접 SELECT로 "연결 캡처가 정상 저장됨"·"작품 2개 다 존재" 확인 ② 스크린샷 분석으로 집필창 우측 패널이 더미(`MemoPanel`, 현재 작품 "ㄷㄱㄷㄱ"인데 "바다가 보이는 방" 표시)임을 규명 → Phase 6 영역 확인.

## 3. 잘 된 점

1. **backend 선결선의 이득** — 메모 저장 경계(repository/Store/IPC)가 Phase 2에서 이미 결선돼 있어, Phase 5는 soft delete 추가 + renderer 결선으로 작업이 압축됨. 근거: 구현 커밋이 신설 2·수정 7~8 파일로 끝남.
2. **추측 대신 관찰로 거짓 버그 차단** — dogfooding 두 "버그"가 실제 코드 버그가 아니라 더미 패널(Phase 6)임을 DB 조회 + 스크린샷으로 규명. 추측으로 코드를 고쳤다면 멀쩡한 코드를 망가뜨릴 뻔함. 근거: DB의 `linked_project_id` 값이 정상 저장돼 있었고, 코드 수정 0으로 종결.
3. **analyze의 사전 가치** — A1(active project 정의)·C1(인라인 미연결 규칙)을 구현 전 surface해 spec/tasks에 한 줄씩 박음 → 구현 중 임의 판단 회피.
4. **회귀 0** — relativeDate 공용 추출(projectView 코드 수정)에도 `projectView.test.ts` 6 tests GREEN 유지. baseline 51 → 75 tests 전부 통과.

## 4. 어긋난 점

1. **dogfooding 거짓 버그 — 더미 UI 스코프 미선명시 (사용자 시간·혼란 소모)**
   - 사용자가 ④(작품 연결 캡처)·⑪(작품 삭제 교차)을 "버그"로 보고했으나, 실제는 집필창 `MemoPanel`이 하드코딩 더미(가짜 메모 3개 + 다른 작품명)라서 발생한 혼란.
   - spec Assumptions에 "Write Studio side panel은 Phase 6" 명시는 **있었으나**, **dogfooding 가이드를 작성할 때** "이 Phase에서 의도적으로 더미로 남긴 컴포넌트(`MemoPanel`)는 범위 밖이니 메모 화면 inbox에서만 확인"을 미리 박지 않음 → 사용자가 거짓 버그를 보고하고 그 진단에 한 사이클(DB 조회 + 스크린샷 분석) 소모.
   - **회피 가능했던 시점**: dogfooding 가이드 첫 작성 시. "이 Phase 범위 밖 / 의도적 더미" 항목을 가이드 맨 앞에 박았어야.

2. **환경 선확인 누락 — node 버전 (테스트 첫 실행에서 발견)**
   - 베이스라인 테스트 첫 실행 시 8 suite가 `No such built-in module: node:sqlite`로 fail. 원인은 셸 기본 Node v20(node:sqlite 미지원), 필요 버전은 24.14.0(`.nvmrc`).
   - `PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행으로 해소했으나, agent-workflow-discipline §8(Electron·네이티브 모듈 환경 선확인)의 "Node 버전 정합"을 **빌드/테스트 명령 실행 전에** 먼저 했어야.
   - **회피 가능했던 시점**: implement 진입 직후 첫 테스트 실행 전 `node -v` + `.nvmrc` 대조.

3. **더미 UI가 거짓 데이터로 남아 혼란 증폭**
   - `MemoPanel`이 빈 상태가 아니라 가짜 메모 3개("주인공이 바다를...")·실제와 다른 작품명을 표시 → 사용자가 "기능이 깨졌다"로 인식. 스코프 분리 시 더미를 플레이스홀더(빈 상태)로 두었다면 혼란이 작았을 것.

- 멈춤 신호: dogfooding 중 2건("4번 메모 추가 안", "11번 ... 반대 경우도 동일") — 둘 다 더미 패널 원인. 디버깅 재시도 0(관찰로 1회 규명). 환경 fail 1회(즉시 해소).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **dogfooding 가이드 = 범위 밖/더미 선명시**: 가이드 작성 시 "이 Phase에서 의도적으로 더미·미구현으로 남긴 UI" 목록을 맨 앞에 박는다. 특히 인접 화면에 더미가 보이면(예: 집필창 `MemoPanel`) "여기는 무시, ○○ 화면에서만 확인"을 명시.
2. **빌드/테스트 전 node 버전 선확인**: desktop 작업은 첫 테스트 실행 전 `node -v`로 `.nvmrc`(24.14.0) 정합 확인 + `PATH` 선행. (node:sqlite는 Node 24 내장.)
3. **스코프 분리 더미는 플레이스홀더로**: 다음 Phase로 미루는 컴포넌트는 거짓 데이터 대신 "○○ 예정" 빈 상태로 둔다. → Phase 6에서 `MemoPanel` 결선 시 이 지점 반영.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**후보 1 — dogfooding 가이드 범위 밖/더미 선명시**
- (1) 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md` (신규 §9) 또는 `CLAUDE.md` 작업 실행 지침
- (2) 본문: "dogfooding 가이드 송출 직전, '이 Phase에서 의도적으로 더미/미구현으로 남긴 UI(인접 화면 포함)' 목록을 가이드 맨 앞에 명시 의무. 사용자가 범위 밖 더미를 거짓 버그로 보고하는 혼란 방지."
- (3) 근거: §4(1) — Phase 5 dogfooding에서 `MemoPanel` 더미를 거짓 버그로 보고, 진단에 한 사이클 소모.

**후보 2 — 빌드/테스트 전 node 버전 선확인 (agent-workflow §8 보강)**
- (1) 대상: `.claude/rules/shared/agent-workflow-discipline.md` §8(Electron·네이티브 모듈 환경 선확인)
- (2) 본문: §8 체크리스트에 "빌드/테스트 명령 첫 실행 **직전** `node -v`로 `.nvmrc` 정합 확인 — 미정합 시 `PATH` 선행 또는 nvm 전환" 한 줄 추가.
- (3) 근거: §4(2) — 베이스라인 테스트 첫 실행에서 node:sqlite 8 suite fail(셸 v20 ↔ 필요 24).

**후보 3 — 스코프 분리 더미는 플레이스홀더 (typescript code-quality 또는 프로젝트 룰)**
- (1) 대상: `.claude/rules/typescript/code-quality.md` 또는 `CLAUDE.md`
- (2) 본문: "다음 Phase로 미루는 컴포넌트는 거짓 데이터 더미 대신 빈 상태/플레이스홀더로 둔다(dogfooding·실사용 혼란 방지)."
- (3) 근거: §4(3) — `MemoPanel`이 가짜 메모 3개·다른 작품명으로 혼란 증폭.

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
