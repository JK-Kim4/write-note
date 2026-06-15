# Phase 0 Research — 자체 에디터 엔진 2라운드 (마크·혼합폰트)

본 라운드 설계 결정과 대안. 각 항목: **결정 / 근거 / 대안 / 미해결**. 1라운드 모듈(`custom-editor/model.ts·measure.ts·pmConvert.ts·CustomEditor.tsx`) 정독 + 업계 표준 리서치(1차 출처) 완료.

---

## R1. 마크 데이터 구조 — flat run-list vs dense vs tree (#65 열린 질문)

**결정**: **블록별 마크 run-list(정규형 비트마스크 run)**. 평문 `buffer`는 텍스트·offset의 단일 진실원으로 유지하고, 마크는 블록마다 연속 run 분할로 보유. 각 run = `{ len, mask }`(mask = bold/italic/underline/strike 비트마스크). 정규형 불변식: 인접 동일 mask run 병합, 0길이 run 제거 → 표현이 유일.

**근거**:
- 업계 표준 — production 에디터 4종 전부 run/span 리스트: Lexical `TextNode.format` 비트마스크(per-run, 글자별 배열 아님), ProseMirror 마크 가진 text node 시퀀스(flat fragment), Slate `{text, bold:true}` leaf, Quill Delta `{insert, attributes}` ops. dense per-char 배열을 쓰는 production 에디터는 확인 못 함.
- 우리 기질(substrate) 정합 — EditContext `updateText(start, len, …)`/`updateSelection`은 **flat-offset API**다(contenteditable 트리가 아님). 그래서 텍스트·offset SoT로 평문 buffer 유지가 맞고(1라운드 캐럿/선택/편집 코드 재사용), 마크만 offset에 정렬된 run-list로 얹는다 = Quill Delta(시퀀스+attributes)와 동형.
- idempotence(HARD-GATE) — 정규형 run-list는 표현이 유일 → `pmJsonToModel(modelToPmJson(m)) === m`이 자명. 1라운드 회고 §4의 거짓 dirty 함정 차단.
- pmConvert 단순화 — PM text node = 마크 가진 run. run-list ↔ PM marks가 1:1 매핑.

**대안**:
- **(a) dense per-char 비트마스크 배열** — 편집이 buffer와 병렬 splice라 가장 단순하나, production 선례 없음 + run은 어차피 측정/렌더/pmConvert에서 파생 필요 + 메모리 O(글자수). 브레인스토밍 초기 권장이었으나 리서치로 기각.
- **(c) 블록별 run 트리(run이 텍스트 보유)** — ProseMirror/Lexical/Slate full 모델. 가장 표준이나 평문 buffer를 폐기 → 1라운드 offset 기반 캐럿/선택/EditContext 동기 전부 재작성. EditContext가 offset API라 과도. 기각.

**미해결**: run-list를 "블록별 `MarkRun[][]`"로 둘지 "buffer 전역 단일 run-list"로 둘지는 data-model에서 확정(블록별이 measure/render/pmConvert 경계와 정합 → 블록별 채택).

---

## R2. 혼합 스타일 줄 측정/캐럿/선택 (#66 — 최난도)

**결정**: 1라운드 `measure.ts`(단일 `fontSizePx`/`fontFamily` 파라미터)를 **run 인지**로 일반화. 한 줄(블록)을 **run마다 실제 스타일(`font-weight`/`font-style`/`text-decoration`) 적용한 `<span>`** 들로 오프스크린 div에 렌더하고, 기존처럼 글자별 `Range.getBoundingClientRect().top`으로 줄 그룹핑 + `Range(lineStart→i).width`로 x 측정. Range가 여러 span을 가로질러도 한 시각 줄 안이면 누적 폭 정확.

**근거**:
- 업계 표준 — production 에디터는 기하를 DOM(`Range.getClientRects()`·`caretPositionFromPoint`)으로 질의. 수동 측정 시 canvas `measureText`는 CJK 커닝·`font-feature-settings`·optical sizing 등 CSS 셰이핑을 못 잡아 오차(1라운드 사용자 보고: 한글 폭 폴백 → 캐럿 드리프트). 실제 스타일 적용된 DOM에 Range를 거는 것이 정확.
- 1라운드 `layoutEngine.layout()`은 `MeasuredLine.height`만 보므로 **무수정**(가변 줄높이 이미 처리). bold/italic은 글자 폭만 바꾸고 줄높이는 블록 폰트(heading) 단위라 그대로.
- 밑줄·취소선은 `text-decoration`(폭 불변) → 측정/줄바꿈에 영향 없음(장식 마크). 측정은 weight/style만 반영하면 됨.

**대안**: canvas per-run `ctx.font` 동기 측정 — 빠르나 위 CSS 셰이핑·CJK 오차 + 1라운드 회귀룰 위반. 기각.

**미해결**: 없음(기법은 1라운드 measure의 자연 확장). 픽셀 정합은 jsdom 불가 → CDP/dogfooding 게이트.

---

## R3. 캐럿 affinity (#68)

**결정**: 캐럿을 `(offset, affinity ∈ {-1: 앞/줄끝, +1: 뒤/줄시작})` 튜플로 표현. 1라운드 `caretToScreen`의 `< vs <=` 워크어라운드(L103·112·125 주석)를 affinity 분기로 대체. 화살표/클릭/줄이동이 affinity를 이동 방향과 일관 갱신.

**근거**: 표준 용어 upstream/downstream(AppKit `NSSelectionAffinity`·Blink/WebKit `TextAffinity`·Flutter `TextAffinity`). ProseMirror position `bias`(-1/+1), CodeMirror6 `EditorSelection.cursor(pos, assoc)`. soft-wrap 경계에서 같은 offset이 앞 줄 끝/다음 줄 시작 두 시각 위치를 가지므로 정수 affinity로 구분.

**대안**: 1라운드 `<=` 단독 유지 — wrap 경계 캐럿 튐 잔존(스펙 US3가 제거 대상). 기각.

**미해결**: affinity의 기본값(미지정 시) = downstream(+1, 일반 이동)으로 두되, End/줄끝 도달·좌화살표 진입은 upstream(-1). 구체 전이는 data-model/구현에서 확정.

---

## R4. 마크 토글·보류 마크·입력 상속 동작

**결정**:
- **토글 규칙**(표준): 선택 `[lo,hi)`가 전부 그 마크면 해제, 아니면 적용.
- **보류 마크(pending marks)**: 선택 없이 토글 → `CustomEditor`의 `pendingMarksRef`에 마스크 보관(DocModel 밖 전이 상태, history·직렬화 비대상). 다음 입력이 소비, 캐럿 이동 시 폐기.
- **입력 상속**: 보류 마크가 있으면 그 마스크로, 없으면 **좌측 글자 마크 상속**(마크 구간 한가운데 타이핑 → 그 마크 이어받음). 평문 paste = 마스크 0.
- **툴바 활성**: `marksAt(model, caret)`(좌측 글자 기준, 보류 마크 있으면 그것) → 버튼 활성.

**근거**: 사용자 브레인스토밍 결정(표준 워드프로세서식 보류 마크). 1라운드가 `selection`을 모델 밖 컴포넌트 상태로 둔 것과 동형(전이 상태 분리).

**대안**: pendingMarks를 DocModel에 포함 — history/직렬화 오염, 순수성 저하. 기각.

**미해결**: 없음.

---

## R5. PM JSON 마크 왕복 (#67)

**결정**: `pmConvert`가 text node `marks` 배열을 무손실 왕복. 지원 마크 `type`: `bold`/`italic`/`underline`/`strike`(검증값). `modelToPmJson`: 블록의 `blockRuns`마다 text node 1개 생성, run.mask → `marks:[{type},…]`. `pmJsonToModel`: text node의 `marks`를 읽어 비트마스크로 환원, 인접 동일 마스크 run 병합(정규형). 미지원 마크(link·highlight 등)는 1라운드처럼 무시(평탄화).

**근거**: `@tiptap/starter-kit@3.23.5` grep 검증 — bold/italic/underline/strike 4종 포함, 각 mark `name` = `bold`/`italic`/`underline`/`strike`(ProseMirror의 `strong`/`em` 아님 — TipTap 리네임). 1라운드 `pmConvert.textOf`(텍스트 깊이우선 이어붙임) 패턴 재사용·확장.

**대안**: 마크를 `strong`/`em`으로 직렬화 — 현행 B형 StarterKit과 상호운용 깨짐. 기각.

**미해결**: 없음.

---

## R6. 무회귀 전략 (#69)

**결정**: 1라운드 모듈 일반화는 **마크 없는(마스크 0) 모델 = 1라운드와 동일 동작**이 되도록 하위호환 유지 — measure가 단일 run(전부 mask 0)이면 1라운드 단일 폰트 경로와 동일, pmConvert 마크 0이면 1라운드 출력과 동일(빈 marks 배열 생략), caret affinity 기본값이 1라운드 `<=` 동작과 정합. 기본 B형·layoutEngine·geometry·outline·BCustomChapterEditor 무수정.

**근거**: SC-007(1라운드 기능 무회귀)·SC-008(기본 B형 무회귀). 1라운드 page.test 7 + custom-editor 순수 테스트 115 GREEN 유지가 게이트.

**대안**: 없음(무회귀는 필수).

**미해결**: 없음.
