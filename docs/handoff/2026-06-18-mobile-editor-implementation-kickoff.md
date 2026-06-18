# 핸드오프 — 026 모바일 에디터 구현 (입력 기반 확정 → 구현 본론 명세부터)

**작성**: 2026-06-18 / **브랜치**: `026-mobile-editor-support` / **HEAD**: `1c07175`(+ 미커밋 working tree)

## 한 줄 요약

iOS 자체에디터 **입력 기반은 textarea 프록시로 확정·실기기 검증 완료**(한글 IME·줄바꿈·받침·탭이동·작성 통과). 그러나 이번 세션이 입력 디버깅에 전부 소모돼 **정작 모바일 에디터 구현(편집 이식·반응형)은 시작 못 함**. 다음 세션은 **확정된 입력 기반 위에서 모바일 에디터 구현을 명세(spec) 갱신부터** 시작한다 — 추측 디버깅 트랙은 종료, 깔끔한 SDD로 본론 진입.

## 확정·검증된 것 (다음 세션의 전제 — 재논의 불필요)

| 항목 | 결정/상태 |
|---|---|
| **iOS 입력 아키텍처** | **hidden textarea 입력 프록시** (`textareaAdapter.ts`). contentEditable + diff 방식은 **PoC 실패 폐기**(iOS IME 상태 orphan). deep research 2종으로 확정, CodeMirror/Monaco 검증 패턴. |
| 한글 IME(받침·조합) | ✅ 실기기 통과 |
| 줄바꿈(Enter, 중복 0) | ✅ — `\n`이 value diff→`insertText`로 블록분할 자동(별도 Enter 라우팅 불필요) |
| 글자 크기(모바일 reflow) | ✅ — `mobilePageGeometry`(페이지 폭=화면 폭, A4 비율), 글자 18px |
| 탭으로 캐럿 이동 + 작성 | ✅ — `pointToCaret`이 `elementsFromPoint`로 textarea 아래 페이지 hit-test |
| 데스크탑 EditContext 경로 | ✅ 무수정(무회귀) |
| 게이트 | vitest 296 + textareaAdapter 10 / typecheck / build GREEN |

**절대 회귀 금지**: iOS 입력을 contentEditable로 되돌리지 말 것. textarea 프록시가 채택 아키텍처(ISSUE-037, 메모리 [[custom-editor-024]]).

## 진입 절차 (다음 세션 — 순서대로)

### 0. 미커밋 기반 먼저 커밋
working tree에 입력 기반 변경이 미커밋 상태다. **이걸 먼저 단위 커밋**해 깨끗한 출발점 확보:
```
git status   # textareaAdapter.ts/.test.ts(신규), CustomEditor.tsx, geometry.ts(+mobilePageGeometry),
             # inputAdapter.ts(onSelectionChange), poc/mobile-editor·ios-textarea-probe, contentEditableAdapter 삭제
git add -A && git commit   # 예: "feat(mobile): iOS textarea 입력 프록시 — contentEditable 폐기, IME·줄바꿈·탭 해결 (026)"
```
커밋 메시지에 "contentEditable 폐기 → textarea 프록시" 명시.

### 1. 명세(spec) 갱신 — textarea 결정 반영
`specs/026-mobile-editor-support/`는 **Phase 3(US1) tasks가 contentEditable 기준**(T006~T012, `contentEditableAdapter`)이라 **현실과 어긋남**. 갱신 필요:
- **US1(iOS 한글 입력)** = textarea 프록시로 **재해결됨** → tasks.md Phase 3을 "textarea 어댑터로 superseded, dogfooding 통과" 상태로 정정.
- **US2(편집 이식)·US3(반응형)** = tasks Phase 4·5 그대로 유효(아직 미착수, contentEditable 무관).
- 권장: `speckit-specify`/`speckit-plan`/`speckit-tasks`로 026 spec을 **textarea 아키텍처 전제**로 갱신하거나, 최소한 tasks.md를 직접 정정 + research.md에 "Decision: contentEditable → textarea 프록시(2026-06-18)" 추가. (§6 tasks.md 실제 코드 grep 의무 적용.)

### 2. US2 — 모바일 편집 이식 + dogfooding (본 세션의 진짜 목적)
textarea 입력 위에서 데스크탑 편집 기능이 iOS에서 동작하는지 **점검·이식**(tasks T013~T021):
- 선택/드래그(`onSelectionChange` 경로 활용), 캐럿 이동, 마크(B/I/U/S), 블록(heading/quote/list/hr), undo/redo, 복사/잘라내기/붙여넣기(PM JSON), 목차 점프, 자동저장(`useDocumentSession`), 페이지 분할 — **각각 iOS 실기기 dogfooding**.
- ⚠️ host의 `copy/cut/paste` 리스너가 textarea 네이티브 클립보드와 충돌할 수 있음(현재 미점검) — US2에서 확인.
- ⚠️ host `onKey`(EditContext용)는 textarea가 keydown `stopPropagation`으로 차단 중 — 화살표/Home/End 등 캐럿 이동이 iOS에서 정상인지 확인(현재 `selectionchange`로 캐럿 추종).

### 3. US3 — 모바일 반응형 (독립·병렬 가능, tasks T022~T023)
헤더 nav 가로 overflow 제거(`b/layout.tsx`), `BStudioShell` 880px 분기 정합, body 가로 스크롤 방지.

### 4. Phase 6 — 정리 (tasks T024~)
- `ios-textarea-probe` 검증 라우트 제거.
- `CustomEditor` `debugNoZoom` prop 제거(미사용 진단 잔재).
- `poc/mobile-editor` 진단 헤더 최종 정리(현재 buffer 한 줄만 남김).

### 5. 마무리
develop merge 결정 + 라이브 배포 검증 + vault/회고 갱신.

## 핵심 파일 맵 (이번 세션 변경)

```
frontend/src/components/custom-editor/
├── input/
│   ├── inputAdapter.ts            # InputHandlers에 onSelectionChange 추가
│   ├── editContextAdapter.ts      # 무변경(데스크탑) / .test.ts에 onSelectionChange no-op
│   ├── textareaAdapter.ts         # ★ 신규 — iOS textarea 입력 프록시 (채택 아키텍처)
│   ├── textareaAdapter.test.ts    # ★ 신규 — 10 테스트
│   └── (contentEditableAdapter.ts/.test.ts — 삭제됨, 폐기)
├── CustomEditor.tsx               # iOS 어댑터=textarea 분기 + onSelectionChange 핸들러
│                                  #   + pointToCaret elementsFromPoint(탭 hit-test)
│                                  #   + isMobile/mobilePageGeometry/availWidth(reflow)
├── geometry.ts                    # ★ mobilePageGeometry 추가 (+ test 5건)
└── CustomEditor.test.tsx          # textarea 표면 부착 검증으로 갱신

frontend/src/app/poc/
├── mobile-editor/page.tsx         # 진단 정리됨(buffer 한 줄). 실제 CustomEditor dogfooding 라우트
└── ios-textarea-probe/page.tsx    # ★ 신규 — textarea IME 검증 probe(Phase 6에서 제거)
```

## 검증된 동작 / 미검증(US2 잔여)

- **검증됨**: 한글 입력(받침)·줄바꿈(중복0)·글자크기·탭 이동+작성.
- **미검증(US2)**: 선택/드래그·마크·블록·undo·복붙·목차·자동저장·페이지분할·화살표 이동 — **전부 iOS 실기기 dogfooding 필요**(textarea 경로에서 동작 보장 안 됨).

## 참고 자료

- 회고: `docs/retrospectives/2026-06-18-026-ios-textarea-input-pivot.md` (추측 디버깅 반복 교훈 §4, 룰 후보 §5-2)
- 이슈: vault `03-ISSUES.md` ISSUE-037 (입력 아키텍처 전환 + 잔여)
- 진척: vault `02-PROGRESS.md` 026 entry
- 직전 핸드오프(렌더 잔여 시점, 이후 진전됨): `docs/handoff/2026-06-18-mobile-ios-editor-render.md`
- deep research 산출(세션 transcript): iOS contentEditable IME 해법 / 대안 입력 아키텍처(hidden textarea 1순위)

## 다음 세션 첫 프롬프트 (복사해서 붙여넣기)

```
026 모바일 에디터 구현을 이어서 진행한다. 먼저 docs/handoff/2026-06-18-mobile-editor-implementation-kickoff.md 와 vault 03-ISSUES.md ISSUE-037 을 읽어라.

확정 전제(재논의 금지): iOS 자체에디터 입력은 textarea 입력 프록시(textareaAdapter.ts)로 해결·실기기 검증 완료(한글 IME·줄바꿈·받침·탭이동·reflow). contentEditable 방식은 폐기됨 — 절대 회귀 금지. 데스크탑 EditContext 경로 무수정(MUST). 입력 기반은 끝났고 이미 커밋·push 됨(브랜치 026-mobile-editor-support).

이번 세션 목적 = 모바일 에디터 구현 본론(편집 이식 + 반응형). 입력 재디버깅으로 빠지지 말 것.

1단계부터 시작: specs/026-mobile-editor-support/ 의 spec/tasks 를 textarea 아키텍처 전제로 갱신한다(현재 Phase 3 tasks 가 contentEditable 기준이라 어긋남 — T006~T012 를 'textarea 어댑터로 superseded, dogfooding 통과'로 정정, research.md 에 contentEditable→textarea 결정 추가). speckit(specify/plan/tasks)로 진행하되, tasks 의 파일명·시그니처는 실제 코드 grep 으로 검증(§6). 그 다음 US2(편집 이식: 선택/마크/블록/undo/복붙/목차/자동저장/페이지분할 — 각각 iOS 실기기 dogfooding) → US3(반응형) → Phase 6(정리: ios-textarea-probe·debugNoZoom 제거).

iOS 동작 점검 시 계측(이벤트·value 덤프) 먼저, 추측 수정 금지(§11, 직전 세션 교훈).
```

## 절대 잊지 말 것

- **목적 = 모바일 에디터 구현**. 입력 기반은 끝났다 — 다음 세션은 편집 이식(US2)·반응형(US3)이 본론. 입력 재디버깅 트랙으로 다시 빠지지 말 것.
- 데스크탑 EditContext 경로 **무수정**(MUST 게이트).
- iOS 입력 동작 점검 시 **계측 먼저**(이벤트 카운터·value 덤프) — 추측 수정 금지(§11, 이번 세션 교훈).
- 배포 = `cd frontend && vercel deploy --yes`(프리뷰). 로컬 3커밋이 origin 앞설 수 있음(자동배포 X).
