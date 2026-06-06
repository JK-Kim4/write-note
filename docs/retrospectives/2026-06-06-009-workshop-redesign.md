# 009 작업실 재디자인 — QA fix → impeccable 재디자인 → speckit 풀파이프 → 구현 → dogfooding

- 일자: 2026-06-06
- 워크트리 / 브랜치: `write-note` / `009-workshop-redesign` (develop 분기, 미merge)
- 관련 커밋: `893f0e7`(008 fix) · `8b5d4f9`(문서) · `47ae36a`(MVP) · `3c309c7`(P2 fix) · `6b7904d`(US3·4·6 backend) · `ea16c84`(US6 토글·US5)
- 작업 시간: 2026-06-06 세션 전체 (한 세션 다중 사이클)

## 1. 무엇을 했는가 (사실)

- **008 잔여 QA fix**: 메모 연결/해제를 optimistic update 로 전환(`MemoInboxScreen.handleToggleLink`/`handleUnlink` + `applyLinkOptimistic`). 빠른메모 버튼 접근성은 코드 직접 검증 후 "결함 아님(Computer Use↔Electron 브리지 한계)"으로 종결, QA 리포트에 결론 기록.
- **impeccable 재디자인**: `critique desktop app`(24/40, P1 2건) → 물성 3안(원고 책상형/작업 벽형/조용한 서랍형) 목업(`workshop-materiality.html`) → 흐름 목업(`workshop-flow.html`) → 메모 목업(`memo-desk.html`) → "다음 장면" 비교 목업(`next-scene-options.html`). 방향 확정: 메인=작업 벽형 / 집필실=조용한 서랍형 / 메모=쪽지 책상형.
- **speckit 풀파이프**: design doc(`docs/superpowers/specs/2026-06-06-...`) → spec(US1~US6, FR-001~027) → plan(스키마 v5 + research R1~R8 + data-model + contracts) → tasks(40) → implement.
- **구현(US1~US6)**: 스키마 v5(`projects.next_scene` + `memo_projects.pinned`), backend `store.listProjectCards`/`pickReentryMemo`/`memoRepository.setPin`, `lastSentence` 순수함수, renderer 5화면/컴포넌트(작업 벽형 ProjectsScreen + ProjectWallCard, 서랍형 WriteStudioScreen + ReentryCard + ViewMenu, 쪽지 책상 MemoInboxScreen, 잉크 한 방울 Rail, QuickCapture hardening, 고정 토글 MemoPanel, 접근성 토큰/focus). 최종 `pnpm test` 145 GREEN + typecheck + build.
- **dogfooding**: 내 환경(headless)에서 Electron 창·screencapture 불가 확인 → 정직 보고. 사용자가 다른 환경(Computer Use)에서 수행한 `docs/qa/2026-06-06-009-mvp-dogfooding.md` 확인 → P2(보기 팝오버↔곁쪽지 서랍 stacking) 상호 배타로 fix.
- **외부 SoT 갱신**: vault `02-PROGRESS.md`(Phase 7 = 009) + `03-ISSUES.md`(ISSUE-020 미검증 잔여).

## 2. 어떻게 했는가 (접근)

- **impeccable → 목업 → speckit 순차**: 디자인 방향을 코드 전에 목업으로 확정(brainstorming visual companion). "구현하지 말고 목업부터"라는 핸드오프 게이트를 따라, 색/폰트는 목업 HEX 대신 실제 OKLCH 토큰·Gowun Batang 으로 매핑한다고 spec/plan 에 못 박음.
- **TDD + subagent 병렬**: Foundational(schema v5)은 직접 RED→GREEN. 이후 backend/renderer 를 subagent 에 위임 — 단 디자인 품질이 중요한 첫 화면(MVP renderer)은 상세 가이드로, US6 backend·US3/4 renderer 는 파일 영역(electron/db vs src)이 안 겹쳐 병렬로. 모든 subagent 결과는 통합 상태에서 직접 재현 검증(`agent-workflow-discipline §7`).
- **범위 결정은 목업/질문으로 확정 후 진행**: 재진입 쪽지 선정(고정→연결→캡처)·"다음 장면" 출처는 추측하지 않고 사용자에게 목업·선택지로 확정.

## 3. 잘 된 점

1) **사용자의 IA 통찰을 즉시 수용해 화면을 재구조화**: "작업 벽은 작업실이 아니라 메인(작품 고르기) 화면 아니냐"는 지적을, 추측으로 방어하지 않고 rail 구조(작품/집필 분리)와 연결해 "메인=벽 / 집필실=서랍"으로 분리 확정. 근거: 사용자가 그 분리에 동의하고 이후 흐름이 매끄럽게 이어짐.
2) **headless 한계를 숨기지 않고 정직 보고**: Computer Use 도구 부재·screencapture 실패(`could not create image from display`)를 "검증했다"고 꾸미지 않고 그대로 보고 → 사용자가 다른 환경에서 dogfooding 수행하는 분업으로 이어짐. 근거: 거짓 성공 주장 0.
3) **subagent §7 검증이 회귀를 차단**: 병렬 subagent 결과를 매번 통합 재현(145 GREEN 직접 확인). US3/4 renderer 의 "미연결" 2건 grep 매칭이 주석임을 확인해 거짓 회귀 보고를 막음.
4) **dogfooding P2 를 근본 원인으로 fix**: 증상(stacking)을 z-index 땜질이 아니라 독립 state 동시 노출이라는 근본으로 규명 → 상호 배타 + 테스트 2건. Phase 6 팝오버 stacking 회귀 계열임을 연결.

## 4. 어긋난 점

- **범위 2회 확장 (목업 재확인 시점에 드러남)**:
  - (1) "다음 장면" 출처: plan R1 에서 "곁쪽지로 대체(전용 필드 없음)"로 default 결정했으나, 사용자가 목업(`next-scene-options.html`)을 보고 "직접 적는 한 줄(B)"로 뒤집음 → `projects.next_scene` 신설로 spec/plan/data-model/contracts 전부 재갱신. **회피 가능 시점**: spec 단계에서 "다음 장면"이 표시값인지 입력값인지 먼저 목업으로 확정했더라면 plan 의 R1 default 와 그 뒤집기 비용이 없었다.
  - (2) 곁쪽지 고정(US6): 재진입 쪽지 선정 clarification 에서 사용자가 "C(고정) A B" 선택 → 데이터 모델 변경 없음 비범위가 깨지고 `memo_projects.pinned` 추가. 이건 clarification 으로 surfacing 후 확장이라 절차상 정상이나, 결과적으로 spec 작성 시점의 "표현만" 전제가 두 번 흔들림.
- **plan 이 화면 데이터 경로를 미박음**: "마지막 문장"을 작품 벽 카드가 표시하는데, `projects.list` 가 본문(document)을 안 줘서 구현 시점에야 "데이터 경로 부재"를 발견(`store.listProjectCards` 로 (a) backend 확장). **회피 가능 시점**: plan research/data-model 에 "화면별로 어떤 IPC·필드에서 표시값이 오는가"를 명시했더라면 구현 중 설계 결정이 안 생겼다.
- **사용자 멈춤/되돌림 신호**: "이딴식으로 보여주지말고 목업으로"(ASCII 스케치 거부) 1회, "B 직접 적는 한줄로 해야돼"(R1 default 뒤집기) 1회. 둘 다 추측·default 가 사용자 의도와 어긋난 지점.
- **dogfooding 을 내가 못 함**: 내 환경 headless 로 시각/IME 검증 불가 — 도구 한계라 회피 불가였으나, 작업 초반에 "이 환경에서 Electron 창을 띄울 수 있는가"를 먼저 확인했다면 dogfooding 분업을 더 일찍 합의할 수 있었다.
- 반복 디버깅·같은 에러 3+ 재시도: 없음. subagent 재시도 cap 내.

## 5. 다음 작업에 남길 교훈

### 5-1. 작업별 교훈 (이 프로젝트 한정)

- **표시값 vs 입력값을 spec 단계에서 목업으로 확정**: 화면에 보이는 값이 "저장된 입력"인지 "파생 표시"인지 모호하면, plan default 로 추측하지 말고 spec/디자인 단계에서 목업·질문으로 먼저 확정한다("다음 장면" 2회 갱신 회귀).
- **plan 에 화면별 데이터 출처 명시**: 각 화면의 표시값이 어떤 IPC·필드·파생에서 오는지 plan(data-model 또는 research)에 박는다. `projects.list` 에 본문이 없어 구현 중 `listProjectCards` 를 신설한 사례.
- **headless 환경 인지**: 이 세션 환경은 GUI 디스플레이가 없어 Electron 창·screencapture·Computer Use 가 불가하다. 시각/IME dogfooding 은 사용자 실환경 몫 — 작업 초반에 분업을 합의한다. 동작(behavior)은 RTL/단위 테스트로 보호.

### 5-2. 룰 갱신 후보 (사용자 컨펌 필요)

각 후보는 **사용자 컨펌 전 실제 룰 파일 수정 금지**.

1. **(대상)** `.claude/rules/shared/agent-workflow-discipline.md` (신규 섹션)
   **(본문)** "화면이 표시하는 값의 출처(저장 입력 vs 파생 표시, 어떤 IPC/필드)를 spec/plan 단계에서 명시한다. plan default 로 데이터 경로를 추측하면 구현 중 설계 결정·범위 갱신이 발생한다."
   **(근거)** §4 — "다음 장면" 표시값/입력값 미확정으로 R1 default 뒤집기 + `listProjectCards` 구현 중 신설.

2. **(대상)** `CLAUDE.md` 또는 `.claude/rules/shared/agent-workflow-discipline.md`
   **(본문)** "GUI 검증(Electron 창/스크린샷/Computer Use)이 필요한 작업은 착수 시점에 현재 환경이 headless 인지 확인하고, headless 면 시각/IME dogfooding 을 사용자 실환경 분업으로 합의한다. 동작은 자동화 테스트로 보호하고, 검증 못 한 항목은 정직히 미검증으로 남긴다."
   **(근거)** §4 — dogfooding headless 불가, ISSUE-020.

3. **(메모리 후보, feedback)** 사용자 선호 — "변경 최소보다 완성도 우선"(마지막 문장 데이터 경로에서 (a) backend 확장 선택). 다음 유사 결정에서 default 를 완성도 쪽으로.

**참고**: 위 1·2 는 기존 `agent-workflow-discipline.md` 의 회귀 사례 누적 정책과 정합. 사용자가 채택 항목을 지정하면 그것만 반영.
