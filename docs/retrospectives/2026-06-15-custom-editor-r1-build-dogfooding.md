# 자체 에디터 엔진 1라운드 — 본 구축(US1~US3) + dogfooding

- 일자: 2026-06-15
- 워크트리 / 브랜치: `write-note-024-custom-editor` / `024-custom-editor` (base develop)
- 관련 커밋: `3ed09de`(SDD) · `08da021`(US1+픽스) · `6138160`(US3) · `d5f7e45`(US2+dogfooding 2차)
- 작업 시간: 1 세션(브레인스토밍→SDD→구현→dogfooding 연속)

## 1. 무엇을 했는가 (사실)

- **브레인스토밍**으로 결정 5개 확정: 수직 슬라이스 / B형 먼저 / 디스크는 PM JSON 유지·경계 변환 / 구조(문단·제목)만 / 신규 라우트→완전대체 / undo·paste 포함.
- **speckit SDD** 산출: `specs/024-custom-editor-r1/`에 spec·plan·research·data-model·contracts·tasks + analyze(C1·C2·U1 반영). spec dir 번호는 브랜치 정합으로 `024-custom-editor-r1`.
- **승격 모듈 `custom-editor/`** 구축: PoC 순수 자산(geometry/layoutEngine/measure) 이전 + model(buffer+blockAttrs)·pmConvert(PM JSON 경계 변환)·history(undo)·outline·CustomEditor·BCustomChapterEditor. 순수 로직 **TDD 115 테스트 GREEN**.
- **신규 라우트** `/b/works/[id]/custom` + **BStudioShell 추출**(기존 B형 라우트를 얇은 래퍼로, page.test 7 무회귀).
- US1(쓰기·저장·줄단위 분할) / US2(제목 H1~3·블록폰트·목차) / US3(undo·복붙·복사·잘라내기) 구현.
- **dogfooding으로 버그 7건 발견·수정**(아래 §4).
- 레이아웃/UX: 캐럿 가시화·여백·배경 톤·fit-to-width(zoom 자동축소)·확대축소 컨트롤·패널 폭 240/240 균형.

## 2. 어떻게 했는가 (접근)

- 구현은 **sub-agent 위임 + 태스크 규모별 모델 선정**(순수 TDD·결선=sonnet, 코어 렌더/EditContext·셸 추출=opus, haiku 금지). 컨텍스트 폭발 방지가 목적. 각 agent는 절대경로·워크트리 한정·검증 cap·5~12줄 보고 지시.
- 모든 agent에 **메인 repo(023-export 미커밋 패치) 비접촉** 못박음. dev 서버는 워크트리에서 백그라운드 구동, HMR로 dogfooding.
- 버그는 전부 **§11(추측 수정 반복 금지 — 관찰로 레이어 확정 후 수정)** 으로 접근: 결정론적 probe·grep·임시 진단 로그·프록시 재현.
- §10(핵심을 첫 dogfoodable에서)에 따라 US1 코드 완성 직후 멈추고 사용자 dogfooding 게이트 통과 후 US2/US3 진행.

## 3. 잘 된 점

1) **§11이 반복 헛수정을 실제로 차단했다.** 근거: (a) 저장 유실 — 자동저장 가설로 또 안 고치고 `modelToPmJson(pmJsonToModel(빈문서))` 비정규화를 *결정론적 테스트*로, 셸 flush 빈본문을 *grep+git*으로 확정 후 1회 수정. (b) IME 이중개행 — 콘솔 진단을 nl카운트→버퍼덤프→조합상태 3단계로 좁혀 `e.isComposing` 미설정을 규명. (c) "Project not found" — 코드 버그로 단정 않고 프록시로 재현해 *계정/소유권 불일치*임을 규명(엉뚱한 수정 회피).
2) **sub-agent 모델 선정이 비용/품질 균형.** 근거: OOM·무한루프 0, 각 agent 보고 5~12줄·tool 4~26, 순수 TDD는 sonnet으로 충분(108→115 GREEN), 최난도(blockFont 관통·셸 추출)만 opus.
3) **셸 추출이 무회귀.** 근거: 기존 `page.test.tsx` 7개가 추출 전후 동일 GREEN, 패널 폭 변경 후에도 7 GREEN.
4) **경계 변환 설계가 plumbing 보존.** 근거: 자동저장·버전토큰·충돌·draft 전부 무수정 재사용(body 문자열만 변환), 백엔드 변경 0.

## 4. 어긋난 점

사용자 멈춤/버그 신호 다수 — 대부분 dogfooding에서 표면화(자동화로 못 잡는 런타임/IME 영역).

- **저장 유실(2회 헛수정 위험 직전 차단).** 셸 `latestBodyForFlushRef`가 빈 문서로 초기화 후 영원히 미갱신 → 챕터 전환 시 `flushDraft(빈문서)`. + `pmConvert` 왕복이 빈 문서를 `content:[{paragraph}]`로 비정규화 → 로드 즉시 거짓 dirty → baseline 이탈로 빈 flush가 파괴적. **회피 가능 시점:** BCustomChapterEditor 결선 시 "셸 flush 본문 출처가 실제 최신인가" + "왕복이 idempotent인가" 점검.
- **IME Enter 이중개행 + 첫 수정 실패.** 1차로 `if (e.isComposing) return` 가드를 넣었으나 **EditContext는 keydown e.isComposing을 설정하지 않아** 무효 → 사용자 "동일 문제 계속 발생". 조합 추적을 EditContext `compositionstart/end`로 바꿔 해결. **회피 가능 시점:** EditContext 커스텀 키 처리 설계 시 "contenteditable 가정(e.isComposing) 통용 안 됨" 인지.
- **목차 영구 미표시.** `useCustomOutline`이 마운트 시 스크롤 컨테이너 부재(챕터 비동기 로딩) → `if(!container) return`으로 관찰 영구 포기. **회피 가능 시점:** DOM 스크래핑 훅은 대상이 늦게 마운트될 수 있음을 전제(안정 조상 관찰).
- **누락 기능(런타임에서야 발견):** 복사/잘라내기 미구현(paste만), 캐럿 가시화(페이지 넘김 시 스크롤) 미구현 — 자체 렌더(네이티브 선택 억제) 에디터의 기본 부속인데 빠짐.
- **"Project not found" 혼선:** 테스트 계정으로 만든 프로젝트(3537)에 사용자가 본인 계정으로 진입 → 소유권 불일치. 코드 무관(차단함).
- **반복 디버깅:** 같은 버그 3회 이상 재시도는 없음(IME 1회 실패 후 2번째에 해결). 단 dogfooding 왕복이 많았음(런타임 영역 특성).

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- 자체 렌더 에디터(EditContext, 네이티브 선택 억제)는 **클립보드(copy/cut/paste)·캐럿 가시화 스크롤·IME 조합 가드**를 "기본 부속"으로 처음부터 체크리스트화. 빠지면 dogfooding에서 늦게 터진다.
- 1:1 인프라(useDocumentSession·셸 flush)를 1:N에 재사용할 때 **세션 재초기화뿐 아니라 "flush에 넘기는 본문의 출처"**까지 점검(016/022 §12 연장).
- 직렬화 왕복(pmConvert 등)은 **idempotent거나, baseline을 같은 정규화로 맞춰** 거짓 dirty를 차단.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

**(A) `agent-workflow-discipline.md` §12 보강 — flush 본문 출처**
- 대상: `.claude/rules/shared/agent-workflow-discipline.md` (§12)
- 본문: "1:1 자동저장 세션을 1:N(챕터 등)에 재사용 시, 세션 재초기화 검증에 더해 **전환 직전 flush로 넘기는 '본문'이 stale/빈 ref가 아닌 실제 최신인지** 확인한다(셸이 보유한 `latest*Ref`가 갱신되는지)."
- 근거: §4 저장 유실(`latestBodyForFlushRef` dead ref).

**(B) 신규 항목 — EditContext 커스텀 키/조합 가드**
- 대상: `.claude/rules/typescript/code-quality.md` (또는 agent-workflow-discipline 신규 §)
- 본문: "EditContext 기반 에디터에서 keydown 커스텀 처리(Enter 등)는 **`e.isComposing`을 신뢰하지 말 것 — EditContext는 이를 설정하지 않는다.** 조합 상태는 EditContext의 `compositionstart/compositionend`로 추적한 ref로 가드한다."
- 근거: §4 IME Enter 이중개행 + 1차 수정 실패.

**(C) 신규 항목 — 직렬화 왕복 idempotence / baseline 정규화**
- 대상: `.claude/rules/typescript/code-quality.md`
- 본문: "에디터 모델↔저장포맷 양방향 변환을 자동저장 dirty 판정에 쓸 때, **왕복이 비정규화면(예: 빈 문서가 다른 문자열로) 로드 즉시 거짓 dirty**가 난다. baseline(serverBody)을 동일 변환으로 정규화하거나 변환을 idempotent하게."
- 근거: §4 저장 유실의 거짓 dirty 축.

**(D) 신규 항목 — DOM 스크래핑 훅의 늦은 마운트 대상**
- 대상: `.claude/rules/typescript/code-quality.md` (React)
- 본문: "DOM을 스크래핑하는 훅(목차 등)이 대상 컨테이너를 마운트 시 못 찾으면 **`if(!container) return`으로 영구 포기 금지** — 비동기 마운트를 전제로 안정 조상(document.body 등)을 관찰하거나 재시도."
- 근거: §4 목차 영구 미표시.

**사용자 컨펌 전까지 실제 룰 파일 수정 안 함.**
