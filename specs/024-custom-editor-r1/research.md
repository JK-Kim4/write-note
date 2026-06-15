# Phase 0 Research — 자체 에디터 엔진 1라운드

본 라운드의 설계 결정과 대안. 각 항목: **결정 / 근거 / 대안 / 미해결**. 코드 근거는 정독 완료(`PocEditorLive.tsx`·`geometry.ts`·`layoutEngine.ts`·`measure.ts`·`pageLayout.ts`·`outline.ts`·`b/works/[id]/page.tsx`·`BChapterEditor.tsx`).

---

## R1. 블록 속성(heading) 동기 — §4의 핵심 난점

**결정**: 내부모델 = **평문 버퍼(`\n`=블록 구분, `U+FFFC`=이미지) + 블록 인덱스에 정렬된 속성 배열 `blockAttrs: BlockAttr[]`**. `BlockAttr = { type: 'paragraph' | 'heading'; level?: 1|2|3 }`. heading-ness는 평문에 인코딩 불가하므로 별도 배열로 보유. 버퍼의 블록 수와 `blockAttrs.length`를 항상 일치시킨다.

**구조 편집 가로채기로 동기 유지**: 블록 수를 바꾸는 모든 편집을 명시 처리해 `blockAttrs`를 정확히 갱신한다.
- **Enter**(keydown, 기존 처리 확장): 현재 블록을 캐럿에서 분할 → 앞 블록은 속성 유지, **새 블록(뒤) = paragraph** 삽입(heading 안에서 Enter → 다음은 본문, TipTap 관습 일치). `blockAttrs`에 index+1 삽입.
- **블록 시작에서 collapsed Backspace**(신규 가로채기): 이전 블록과 병합 → 병합 결과는 **이전 블록 속성 유지**, 현재 블록 속성 제거. (현재는 EditContext 자동 처리 → 본 케이스만 keydown에서 가로채 속성 reconcile.)
- **블록 끝에서 collapsed Delete**(신규 가로채기): 다음 블록과 병합 → 현재 블록 속성 유지, 다음 속성 제거.
- **선택 삭제**(기존 처리): 선택이 여러 블록/개행을 지우면 블록 수 감소 → 삭제 후 블록 경계 재계산하여 `blockAttrs` 재구성(시작 블록 속성 유지).
- **붙여넣기**(신규): 평문 삽입, 개행 포함 시 새 블록들 = paragraph.
- **제목 토글**(신규 UI): 현재 캐럿이 속한 블록의 `BlockAttr`를 `{type:'heading', level}` ↔ `{type:'paragraph'}` 로 변경(버퍼 불변, 블록 수 불변).

**불변식 가드**: 모든 버퍼 변경 직후 `blockAttrs.length === buffer.split('\n').length` 검증. 불일치 시(의도 못 한 자동 편집) **fallback reconcile**(블록 수에 맞춰 길이 보정, 신규 블록=paragraph) — 데이터 깨짐 대신 graceful degrade.

**근거**: `PocEditorLive`는 이미 Enter·선택삭제를 keydown에서 명시 처리(L335·L350). collapsed Backspace/Delete만 자동(L358) → 블록 시작/끝 케이스만 추가 가로채면 동기 지점이 닫힌다. 평문 버퍼 유지는 캐럿·선택·측정 로직(buffer offset 기반)을 최대 재사용한다.

**대안**: (a) 블록을 1급 객체 배열(각 블록 own text)로 모델링 → EditContext의 flat-offset 자동 편집과 매핑이 더 복잡(블록↔offset 양방향 변환을 매 textupdate). 2라운드 마크 도입 시 재검토하되 본 라운드는 과함. (b) 안정 ID 부여 → 평문 버퍼에 ID 보유처가 없음. 기각.

**미해결**: 없음(구조 편집 집합이 닫힘). 2라운드 마크 도입 시 모델을 run-list로 승격할 때 본 결정 재검토.

---

## R2. 블록별 폰트(heading) — 측정·캐럿·렌더 일반화

**결정**: 단일 `geo`(전 블록 동일 폰트) 가정을 깨고, **블록마다 폰트를 파생**한다. `headingFont(attr, baseGeo)` → `{ fontSizePx, lineHeightPx }`.
- 본문(paragraph): `baseGeo.fontSizePx` / `baseGeo.lineHeightPx`.
- heading 배율(초기값, 튜닝 가능): **H1 = 1.8×, H2 = 1.5×, H3 = 1.25×** of 본문 fontSize, 줄높이 배수는 본문과 동일 ratio(1.8) 적용.

**관통 경로**: `relayout`이 블록마다 해당 폰트로 `measureParagraphLines` 호출(줄별 height = 그 블록 lineHeightPx). `caretToScreen`/`screenToCaret`/`selectionRects`의 세로 계산은 **fragment가 속한 블록의 lineHeightPx**를 사용(fragment는 블록 단위라 fragment 내 줄높이 균일). `measureLineXs`도 블록 폰트로 호출. `PageBox` 렌더의 문단 div `fontSize`/`lineHeight`를 블록 폰트로.

**근거**: `layoutEngine.layout()`은 `MeasuredLine.height`만 보므로 **무수정**으로 가변 줄높이 분할 처리(설계문서 §3 확인). 변경은 measure·caret·render 경로에 폰트를 주입하는 것뿐. PoC가 `geo.lineHeightPx`를 직접 참조하는 지점(`caretToScreen` L105, `screenToCaret` L119, `selectionRects` L156)을 블록 폰트로 교체.

**대안**: heading을 "이미지 같은 고정높이 블록"으로 단순화 → 줄바꿈 안 되는 제목만 가능(긴 제목 깨짐). 기각.

**미해결**: heading 배율 구체값은 dogfooding 튜닝 대상(상수로 두고 조정). 본문과 heading 사이 **블록 간 수직 여백**(margin)은 본 라운드 단순화로 0 또는 소량 고정 — research R6 참조.

---

## R3. PM JSON ↔ 내부모델 변환기

**결정**: `pmConvert.ts`에 양방향 순수 함수.
- `pmJsonToModel(bodyJson: string) → { buffer, blockAttrs }`:
  - `JSON.parse` 후 `doc.content[]` 순회. 각 top-level 노드 →
    - `paragraph` → 블록(텍스트 노드 이어붙임, 마크 무시), attr `{type:'paragraph'}`.
    - `heading{attrs.level∈1..3}` → 블록(텍스트 이어붙임), attr `{type:'heading', level}`.
    - 그 외(`bulletList`/`orderedList`/`blockquote`/`codeBlock`/`horizontalRule`/`image` 등) → **평문 평탄화**: 깊이우선 텍스트 추출하여 paragraph 블록(들)로(리스트 항목은 항목별 블록). **lossy** — 프레시 테스트 챕터 전제(FR-019)라 안전.
  - 파싱 실패/빈 문서 → `{ buffer:'', blockAttrs:[{type:'paragraph'}] }`(빈 문단 1개).
- `modelToPmJson({ buffer, blockAttrs }) → string`:
  - 블록마다 `paragraph`/`heading{level}` 노드 생성, 텍스트는 단일 text 노드(마크 없음). 빈 블록 → 빈 `paragraph`/`heading`(content 생략). `image` 블록(U+FFFC)은 본 라운드 저장 시 **빈 문단으로 직렬화**(현행 B형 StarterKit에 image 노드 없음 → 상호운용 유지). `JSON.stringify({type:'doc', content})`.

**왕복 무손실 불변식**(SC-003): paragraph·heading(1~3)만으로 구성된 모델은 `pmJsonToModel(modelToPmJson(m))` 가 `m`과 동일(텍스트·타입·레벨). TDD로 보호.

**근거**: `outline.ts`의 `textOf`(L26)가 동일한 "텍스트 노드 깊이우선 이어붙임" 패턴 — 재사용/참조. heading `attrs.level` 형태 확인(`outline.ts` L48, B형 StarterKit heading levels 1~3).

**대안**: 미지원 노드를 opaque로 보존(원본 subtree 저장) → 편집 시 보존 불가능(R 서식 범위 결정). 본 라운드 비범위, 패리티 라운드로.

**미해결**: 없음(lossy 평탄화는 명시 수용).

---

## R4. 아웃라인 재결선 (TipTap 인스턴스 탈피)

**결정**: 엔진 모델에서 직접 아웃라인 파생 + 점프. `custom-editor/outline.ts`:
- `outlineFromModel({ buffer, blockAttrs }) → OutlineItem[]` — heading 블록을 등장순으로 `{ level, text, index }`(기존 `lib/editor/outline.ts`의 `OutlineItem` 타입 재사용 → 아웃라인 패널 마크업 호환).
- 점프: `index`번째 heading 블록의 레이아웃 좌표(page·offsetY)를 엔진이 보유 → 스크롤 컨테이너를 그 위치로 스크롤(엔진 좌표 → 화면 px). `useEditorOutline`의 TipTap `setTextSelection`/`scrollIntoView` 대체.
- 활성 추적: 스크롤 시 뷰포트 상단에 가장 가까운 heading 블록을 `activeIndex`로(레이아웃 좌표 비교). 기존 `useEditorOutline`의 IntersectionObserver-유사 추적 대체.

**근거**: `page.tsx`(L243)는 `useEditorOutline(editor, ".b-editor-scroll")` 결과를 `outline.items`/`outline.selectItem`/`outline.activeIndex`로 패널에 소비(L297~319). 동일 인터페이스(`items`/`selectItem`/`activeIndex`)를 엔진 파생 훅이 제공하면 패널 마크업 재사용. 자체 엔진은 레이아웃 좌표를 1급으로 보유(`LaidOutPage.fragments[].offsetY`)하므로 점프·추적이 PM 위치 산술보다 견고.

**대안**: 저장된 bodyJson에 기존 `outlineFromDoc` 사용 → 항목은 얻지만 **점프 좌표 부재**(PM 위치를 자체 렌더에 매핑 불가). 항목 파생만 공유하고 점프는 엔진 좌표로 — 결국 엔진 파생이 단순. 기각.

**미해결**: 없음.

---

## R5. 신규 라우트 + B형 셸 재사용 전략

**결정**: **공유 셸 추출(Option A)**. `BWorkDetailPage`의 챕터 관리·세션 오케스트레이션·3패널 셸을 `BStudioShell`로 추출하고, **에디터 슬롯**과 **아웃라인 소스**를 주입받게 한다. 기존 B형 라우트 = `BStudioShell` + `{ editor: BChapterEditor(TipTap), outline: useEditorOutline }`. 신규 라우트 = 동일 셸 + `{ editor: BCustomChapterEditor(자체엔진), outline: useCustomOutline }`.

**근거**: 셸은 마크업(~250줄)뿐 아니라 **챕터 생성/삭제/순서/이름·URL `?chapter`·work session·end-work·drawer·충돌 모달** 등 ~150줄 로직을 포함(page.tsx L40~241). 신규 라우트가 이를 복제하면 유지비·드리프트 큼. 추출은 행위 보존 리팩토링이며, **full 대체 라운드에서 동일 셸에 자체 엔진을 끼우는 종착점과 정합**(전방 호환).

**무회귀 보장(SC-007)**: 추출은 기존 B형 라우트를 `BStudioShell` 얇은 래퍼로 만들고 동작 동일 검증(기존 라우트 dogfooding + 있으면 기존 테스트 GREEN 유지). 아웃라인 소스 차이는 셸이 `outline = { items, selectItem, activeIndex }` 인터페이스를 prop으로 받게 해 흡수.

**대안**:
- **Option B(신규 라우트가 셸 복제)**: 기존 100% 무수정이나 ~400줄 로직+마크업 복제 → 기각(유지비).
- **Option C(기존 라우트에 `?engine=custom` 토글)**: 코드 최소이나 사용자 결정("자체 엔진 전용 신규 라우트")과 어긋남 + 기존 page에 분기 주입 → 기각.

**라우트 경로**: `/b/works/[id]/custom` (또는 `?...`가 아닌 명시 경로). 구현 시 확정하되 별도 path로 둔다(데이터 안전·기본 B형 무간섭).

**미해결**: 추출 리팩토링의 정확한 prop 경계(에디터 슬롯이 `currentChapterId`·`paperSize`·`onEditorReady`/`onSyncStatus`/`onConflict`를 어떻게 받는지)는 tasks 단계에서 확정. 추출이 과하게 번지면(회귀 위험) **B안(복제)로 후퇴 가능** — tasks에서 추출 비용 재평가 게이트.

---

## R6. 기하(geometry) 정합 + 블록 간 여백

**결정**: 자체 엔진은 **자체 `geometry.ts`(실제 mm 비율)** 사용 — `pageLayout.ts`의 stylized 28줄 모델은 미사용(그 모델이 폐기 대상). 프로젝트 `paperSize`(A4/A3/A2/B4) → 엔진 geometry 매핑. **`geometry.ts`에 A2(420×594mm) 추가**(현재 A5/A4/B4/A3 → 프로젝트가 A5 미사용, A2 미보유 → A2 추가). 여백은 PoC 균일 25mm 유지(pageLayout도 좌우 25mm와 정합).

**블록 간 수직 여백**: 본 라운드는 **블록 간 margin 0**(문단·제목이 줄높이만으로 이어짐) 으로 단순화. 제목 전후 여백은 dogfooding 후 필요 시 소량 고정값 도입(레이아웃 엔진은 블록 height에 margin을 더하면 되므로 확장 용이). 명시: 본 라운드 비범위 아님이나 최소화.

**근거**: `geometry.ts` 주석이 "stylized 28줄 모델 폐기 = A4 비율 불만 해소" 명시. `pageLayout.ts`는 `sheet=28줄≈256mm≠297mm` 자인 → 자체 엔진이 그걸 쓰면 동기 폐기 무의미.

**대안**: `pageLayout.ts` 재사용 → 폐기 대상 모델 답습. 기각.

**미해결**: 줌(zoom) — 기존 B형은 CSS zoom 사용(pageLayout `pageCount`에 zoom 인자). 자체 엔진은 본 라운드 zoom 미지원(고정 배율) — 비범위로 명시, 후속.

---

## R7. undo/redo + plain paste

**결정**:
- **history.ts** — 스냅샷 스택. 스냅샷 = `{ buffer, blockAttrs, selection }`. 연속 타이핑은 coalesce(직전 스냅샷이 같은 "타이핑 런"이면 교체), 구조 편집(Enter/병합/토글/paste/선택삭제)은 새 스냅샷 경계. Cmd+Z=pop→복원, Cmd+Shift+Z=redo. 복원 시 `EditContext.updateText(0, len, restoredBuffer)` + `updateSelection`으로 EditContext 동기.
- **plain paste** — host의 `paste` 이벤트에서 `clipboardData.getData('text/plain')` → 현재 선택을 `updateText(lo, hi, plain)`로 치환 + 블록 동기(개행 포함 시 R1 붙여넣기 처리). `e.preventDefault()`로 네이티브 붙여넣기 억제.

**근거**: EditContext는 자체 undo 히스토리를 강제하지 않음(텍스트 상태를 우리가 소유) → 자체 스택이 단일 진실원. PoC가 이미 `updateText`/`updateSelection`로 EditContext를 양방향 동기(L337·L454).

**대안**: 브라우저 `document.execCommand`/네이티브 undo → EditContext 모델과 불일치. 기각.

**미해결**: redo 후 새 편집 시 redo 스택 폐기(표준 동작)로 단순화.

---

## R8. 검증 수단

**결정**:
- **순수 TDD(Vitest)**: `layoutEngine.test.ts`(기존 7 + heading 가변 줄높이 분할 케이스), `pmConvert.test.ts`(paragraph/heading 왕복 무손실·lossy 평탄화·빈 문서), `model.test.ts`(Enter 분할/병합/heading 토글 시 blockAttrs 동기 불변식).
- **헤드리스 CDP**: 클릭 캐럿 정확·`caretRangeFromPoint` diff 0·드래그 선택·Cmd+화살표·undo/redo·plain paste·자동저장 발생(PUT 관찰)·재로드 무손실. PoC가 쓴 CDP 패턴 재사용(스크립트화, CI 필수는 아님).
- **사용자 dogfooding**: IME 조합(빠른 타자·겹받침·한자·Backspace 분해 — `code-quality.md` 4케이스) + 실제 집필 체감. 헤드리스 불가 영역.

**근거**: 설계문서 §6 + 핸드오프 §검증. IME는 PoC에서도 사용자 dogfooding이 게이트였음(2026-06-15 통과).

**미해결**: CDP 자동화의 CI 편입 여부는 본 라운드 비결정(로컬 스크립트로 충분).
