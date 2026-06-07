# 자체 EditContext 에디터 — 목표 상실 후 전량 폐기

- 일자: 2026-06-07
- 워크트리 / 브랜치: write-note / `feat/custom-editcontext-editor` (세션 종료 시 삭제, `develop @ 550211a` 복귀)
- 관련 PR / 커밋: 없음 — 본 세션 커밋 20개 전량 폐기(브랜치 삭제)
- 작업 시간 (대략): 단일 세션

## 1. 무엇을 했는가 (사실)

- 핸드오프(`docs/handoff/2026-06-07-custom-editor-A-handoff.md`)·PoC(`minimal.html`/`editor.html`)·`computePageBreaks` 정독 + 기준선(vitest 166 / tsc / build) 확인.
- 사용자 결정 3건 확정: 저장 = ProseMirror JSON 유지 / v1 서식 포함 / 진행 = 경량(설계문서+TDD).
- 설계 문서 + 1단계 구현 계획 작성, 커밋.
- **subagent-driven** 으로 "1단계 엔진 코어"를 6 dispatch 로 구현 — `schema`/`bridge`/`input`/`render`/`editorEngine`/하니스. 각 dispatch 마다 spec + 코드품질 2단계 리뷰. 합계 ~20 커밋, vitest 188 GREEN.
- 브라우저 dogfooding 1차 → **IME 는 정상**(빠른 타이핑·복잡 음절 조합 GREEN, 커서 1개). 그러나 Enter 다중·드래그 Backspace 버그 보고.
- 디버깅 중 스크린샷의 자모를 "CRITICAL IME 분해 버그"로 단정 → 사용자가 "내가 일부러 저렇게 친거야"로 정정.
- 사용자가 "이도저도 아닌작업" 지적 → **이번 브랜치·세션 작업물 전량 폐기**(브랜치 삭제 + 디버그 파일 삭제 + 내가 tracked 시킨 `editcontext.d.ts` 원본 복원). 메모리 미기록.

## 2. 어떻게 했는가 (접근)

- superpowers 스킬 체인: using-superpowers → brainstorming → writing-plans → subagent-driven-development → systematic-debugging → retrospective.
- 의사결정은 `AskUserQuestion`(저장 포맷·진행 방식·서식 범위)으로 분기. 핸드오프의 4단계(코어→분할→서식·통합→컷오버)를 그대로 채택, **"1단계 = 엔진 코어(분할 없음)"** 로 잡고 진행.
- 왜 그렇게: 핸드오프가 4단계로 제시했고 "코어부터"가 자연스러워 보였음 — 그러나 이 분해가 **양보 불가 핵심(분할)을 마지막으로 미루는** 함정이었다(§4).

## 3. 잘 된 점

1) **per-task spec + 코드품질 2단계 리뷰가 실제 버그를 차단** — 근거: `tr.split` 후 `pos += 1`(계획 버그)을 `pos += 2`로, `serializeFragment` 반환 타입 좁히기, bridge/input 빈-segments 가드 등을 리뷰가 잡음.
2) **§7 규율 준수** — subagent 의 "계획이 틀렸다/타입 조정했다" 자기진단을 무검증 수용하지 않고 직접 재현·git 확인 후 수용.
3) **IME 하드 게이트 자체는 GREEN** — 근거: dogfooding 에서 "맑핥곲" 등 겹받침 복잡 음절까지 정상 조합. 즉 핵심 난제(서버 없이 한글 IME)는 EditContext 접근이 유효함을 실측 확인.
4) **폐기가 깨끗** — 근거: 폐기 후 working tree 가 세션 시작 git status 와 정확히 일치, 이전 세션 untracked 자산(minimal.html·pagination 등) 보존.

## 4. 어긋난 점

- **(핵심) 목표 상실** — 작업 목표는 "실시간 진짜 페이지 분할"(사용자 양보 불가). 그러나 범용 편집 엔진(IME·커서·Enter·Backspace·화살표·클릭·서식)을 "1단계"로 통째로 짓고 **분할을 "2단계"로 미룸** → 세션 전체를 엔진 코어 + 잔버그에 소모, **분할은 단 한 줄도 시작 못 함**. 사용자: "이도저도 아닌작업중인데".
- **과잉 process weight** — "PoC 작게 + 조기 dogfooding"이 명시 가드레일인데, brainstorm→design→plan→6 subagent dispatch × (spec+품질 리뷰) ≈ **20 커밋을 첫 브라우저 dogfooding 전에** 쌓음. 유일하게 중요한 게이트(브라우저 한글)는 맨 마지막에 왔다.
- **false-alarm 디버깅(추측으로 근본원인 단정)** — dogfooding 스크린샷의 자모 분해를 "CRITICAL IME 버그"로 단정하고 H4 가설·수정안까지 제시. 실제론 사용자가 의도적으로 친 입력. systematic-debugging Phase 1("버그가 실재하는가 / 재현")을 건너뜀.
- **사용자 멈춤 신호 3회+** — "지금 뭘 확인하려는거야?" / "작업을 뭔가 잘못하고있는거같은데" / "이도저도 아닌작업중" → 전량 폐기로 귀결.
- **회피 가능했던 시점** — 설계 결정 직후. 4단계 분해를 작성하는 순간 "step 1 의 dogfooding 게이트가 분할(핵심)을 건드리는가" self-check 했다면, "1단계 = 분할되는 종이를 한글과 함께 띄우는 최소 PoC"로 잡았을 것. 그러면 핵심을 먼저 검증하고 process 도 가벼웠다.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

1. **분할(페이지네이션)이 핵심이다.** 다음 재시작의 첫 산출물은 "분할되는 종이 + 한글 IME"를 동시에 띄우는 **최소 평문 PoC** — 서식·저장 결선·범용 편집은 분할 GREEN 이후로 명시적으로 미룬다.
2. **핵심 미검증 상태에서 멀티에이전트/풀 SDD 금지.** 작은 PoC → 조기 브라우저 dogfooding 을 먼저.
3. **버그 보고는 "실재 확인"부터.** 스크린샷·로그 단편으로 근본원인 단정 금지(사용자 재현/확인 선행).

### 5-2. 룰 갱신 후보 (사용자 컨펌 영역 — 본 회고와 함께 사용자가 "지침 생성" 명시 요청)

- (1) 대상: 프로젝트 `.claude/rules/shared/agent-workflow-discipline.md` (회고 회귀 누적 룰의 정규 위치)
- (2) 추가 본문(§10 신설):
  > **양보 불가 핵심 기능은 첫 dogfoodable 산출물에서 증명 (HARD-GATE).** 사용자가 "양보 불가/필수/핵심"으로 못박은 기능이 있으면 첫 dogfooding 가능한 산출물이 그 기능을 실행해야 한다. 주변 인프라를 먼저 쌓고 핵심을 마지막 단계로 미루는 분해 금지. process weight 는 핵심 미검증까지의 거리에 반비례 — 핵심이 한 번도 dogfooding 안 된 상태에서 멀티에이전트/풀 SDD/다수 커밋 금지. 버그 보고 수신 시 "버그 실재"부터 재현·확인 후 원인 단정.
- (3) 근거 회귀 사례: 본 회고 §4 (목표 상실 + 과잉 process + false-alarm 디버깅).
