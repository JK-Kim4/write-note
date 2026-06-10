# Research — 집필실 3단 (Studio 3-panel)

**Phase 0 산출** · 2026-06-10 · 설계 §10 미해결 3건 + 레이아웃·반응형·접근성 결정 확정.

검증된 코드 사실(grep/Read로 확인):
- 집필실 page: `frontend/src/app/projects/[id]/write/page.tsx` — `.app > .main > .screen-body > .studio > PaperEditor` 셸. `panelOpen`이 MemoPanel 렌더 제어.
- 에디터: `frontend/src/components/editor/PaperEditor.tsx` — `useEditor`가 **컴포넌트 내부**. `onUpdate`에서 `e.view.composing` 가드(IME)·자동저장(`onChange`/`onDraftUpdate`)·페이지분할(ResizeObserver)이 전부 결선됨.
- 인물 API: `frontend/src/lib/api/characters.ts`(핸드오프의 `electron-api/characters.ts`는 오기). `listCharacters(projectId)→Page<CharacterResponse>`, `createCharacter(projectId, {name, shortDescription?, notes?, displayOrder?})→CharacterResponse`. `apiFetch` 직접 호출.
- `CharacterResponse`(`src/types/api.ts`): `{id, projectId, name, shortDescription:string|null, notes:string|null, displayOrder, createdAt, updatedAt}`.
- **인물용 React Query 훅 부재** — `src/lib/query/`에 `useCharacters` 없음(useDocument/useLogs/useMemos/useProjects만). 신규 생성 필요.
- 기존 인물 화면: `frontend/src/app/projects/[id]/characters/page.tsx` 존재 → 상세/삭제/재정렬 링크 대상.
- 스타일: `frontend/src/styles/desktop-app.css` — `.screen-body{grid-template-columns: minmax(0,1fr) 320px}`(2열, line 237), `--solo` variant(238), `.studio{display:flex}`(242), `.side-panel`(409), 반응형 `@media(max-width:880px)`에서 side-panel 숨김(506).
- `node_modules/next/dist/docs` **현재 존재**(2026-05-21 회귀 시 부재였으나 복원됨). 본 작업은 Next 신규 API 미사용이라 영향 없음.

---

## D1. 에디터 인스턴스를 아웃라인 패널에 노출하는 방식

**Decision**: **콜백(`onEditorReady`)으로 에디터 참조만 상위로 노출.** `PaperEditor`는 `useEditor` 소유를 유지하고, 에디터 준비 시 `onEditorReady?(editor)`를 1회 호출. page가 `const [editor, setEditor] = useState<Editor|null>(null)`로 받아 `StudioOutline`에 전달.

**Rationale**:
- `useEditor`를 page로 끌어올리는 **lift(대안 A)는 IME 조합 가드(`e.view.composing`)·자동저장(`onUpdate`)·페이지분할(ResizeObserver)·BubbleMenu·언마운트 flush가 전부 에디터에 결선**돼 있어, 끌어올리면 이 결선을 page로 옮기거나 props로 재배선해야 함 → SC-005(회귀 0: IME·자동저장·페이지분할) 정면 위험. CLAUDE.md "Surgical Changes" 위배.
- 콜백은 `PaperEditor`에 **prop 1개 + effect 1개** 추가뿐 — 내부 로직 무변경. 에디터 참조(소유 아닌)만 상위 공유는 표준 React 패턴.
- 아웃라인 재파생은 `editor.on('update', …)` 구독으로 `StudioOutline`(에디터의 형제)에서 수행 → `PaperEditor`/`EditorContent` 리렌더 없음 → IME 무영향.

**Alternatives 기각**:
- (A) `useEditor` lift: 회귀 위험 큼(상기).
- (C) page가 이미 가진 `body` JSON 문자열만으로 파생: 목록 렌더는 가능하나 **점프는 에디터 인스턴스 필요**(pos→scroll/selection). 또 `body`는 IME 가드로 조합 중 미갱신 → 이중 소스. 단일 소스(에디터 doc)가 정확.

**구현 메모**: `onEditorReady`는 `useEditor`가 비동기 준비되므로 effect에서 `if (editor) onEditorReadyRef.current?.(editor)`. 언마운트 시 `onEditorReady?.(null)` 또는 page가 editorKey 리마운트(복구/충돌)에 대응해 재설정.

---

## D2. 아웃라인 점프 시 커서 이동 여부

**Decision**(사용자 확정): **커서 이동 + 스크롤.** 항목 클릭 → 해당 heading pos로 `setTextSelection` + DOM 스무스 스크롤. 작가가 그 자리에서 바로 이어쓰기 가능.

**Rationale / 검증**:
- 선택(selection) 변경은 TipTap `onUpdate`(doc 변경)가 **아닌** `onSelectionUpdate`를 발동 → 자동저장(`onChange`→`body`)을 트리거하지 않음(검증: `PaperEditor.onUpdate`는 doc 직렬화만). 따라서 점프로 인한 거짓 저장 없음.
- 클릭 시점엔 사용자가 에디터에서 포커스를 뗀 상태(아웃라인 클릭) → IME 조합 중 아님 → `focus()`가 IME 가드와 무관.

**구현 메모**:
- 점프 = `editor.chain().setTextSelection(jumpPos).focus().run()` + 대상 heading DOM 요소로 스크롤.
- `jumpPos`: `outlineFromDoc`가 주는 `pos`(heading 노드 시작)에서 선택 가능한 위치로 보정(예: `pos + 1`, 문서 경계 클램프).
- 스크롤: `editor.view.domAtPos(pos)`로 heading DOM을 얻어 `el.scrollIntoView({ behavior, block:'start' })`. `behavior`는 `prefers-reduced-motion: reduce`면 `'auto'`(즉시), 아니면 `'smooth'`(FR-020).
- `focus()`의 브라우저 기본 caret-into-view(즉시 스크롤)와 스무스 스크롤이 충돌할 수 있으므로, 스크롤은 selection 설정 직후 한 프레임 뒤(rAF) 또는 `scrollIntoView`로 최종 위치 보정. 상세는 구현에서 PoC.

---

## D3. 인물 빠른 추가 후 동기화 방식

**Decision**: **invalidate.** 신규 `useCreateCharacter` mutation의 `onSuccess`에서 `characterKeys.byProject(projectId)` 무효화 → 목록 재조회.

**Rationale**:
- 기존 코드베이스 컨벤션(`useMemos.ts`)이 전부 `invalidateQueries`(낙관적 갱신 0). 일관성.
- 빠른 추가는 저빈도(작가가 가끔 인물 1명 추가) → 낙관적 갱신의 temp-id 생성/롤백/`displayOrder` 추정 복잡도가 가치 대비 과함. 패널은 지연 민감 surface 아님.
- `createCharacter`가 생성된 `CharacterResponse`(서버 확정 `id`/`displayOrder`)를 반환 → 무효화 후 재조회가 정확.

**신규 훅 설계**:
```
characterKeys = { all: ['characters'], byProject: (id) => [...all, 'project', id] }
useProjectCharacters(projectId): useQuery(byProject, () => listCharacters(projectId, {size: 큰값}), {enabled: finite})
useCreateCharacter(): useMutation(({projectId, input}) => createCharacter(projectId, input), onSuccess: invalidate byProject)
```
- `listCharacters`는 `Page<CharacterResponse>` 반환 → 훅이 `.content`만 노출하거나 select. 작품당 인물 수 적음 → `size`를 충분히 크게(예: 100) 한 페이지로.
- mutation 실패 시(FR-016): 에러를 패널에 노출하고 입력값 보존(낙관적 아님이라 자연히 보존). 빈 이름은 제출 비활성.

---

## D4. 레이아웃 — `.screen-body` 3열화

**Decision**: `.screen-body`를 3열 그리드로: `[아웃라인 auto | 원고 minmax(0,1fr) | 우측 auto]`. 좌·우 패널은 **조건부 렌더**(접힘 시 DOM 제거) + 접힘 상태에 따른 `grid-template-columns` 4분기.

- 원고 = 기존 `.studio`(그대로 가운데 열).
- 좌 = 신규 `StudioOutline`(`aside`, `--surface-sunken` 톤, 폭 ~240px).
- 우 = 신규 **우측 스택 컨테이너**(`aside`, 폭 ~320px): 상단 `CharacterPanel` + 하단 기존 `MemoPanel`. 각 섹션 헤더로 개별 접기(스택 내부 로컬 상태).

**상태/클래스**:
- page state: `leftOpen`(default **true**), `rightOpen`(default **false**) — 사용자 확정 "아웃라인만 펼침".
- 4조합 → `grid-template-columns`:
  - 둘 다: `240px minmax(0,1fr) 320px`
  - 좌만: `240px minmax(0,1fr)`
  - 우만: `minmax(0,1fr) 320px`
  - 둘 다 접힘: `minmax(0,1fr)` (현 `--solo` 계승, 원고 몰입)
- modifier 클래스(예: `.screen-body--left` / `.screen-body--right` 조합) 또는 data-attr로 매핑.

**Titlebar 토글 확장**: 현재 `right` JSX의 단일 `panel-toggle`(곁쪽지) → **좌(아웃라인)·우(맥락 패널) 2개 토글**로 확장. 각 버튼 `aria-pressed`/`aria-label`. 기존 곁쪽지 토글 어휘 계승하되 우측은 "맥락 패널(인물·곁쪽지)" 의미로.

**Rationale**: `.studio`를 건드리지 않고(에디터·페이지분할 영역 보존) `.screen-body` 그리드만 확장 → surgical. MemoPanel은 우측 스택 하단으로 위치만 이동(컴포넌트 불변, FR-017).

---

## D5. 반응형 / 모바일

**Decision**(FR-004):
- 넓은 폭: 3열 전부.
- 중간 폭(예: ≤1100px): 아웃라인 먼저 자동 접힘(좌 열 제거).
- 좁은 폭(예: ≤880px, 기존 분기 계승): 우측 패널도 물러남.
- 모바일 폭: 패널을 **오버레이/시트**로(원고 우선) — 토글 시 원고 위에 떠서 열림.
- **유동(fluid) 타이포 금지**(product 레지스터) — 폰트 크기 vw 기반 금지, 기존 고정 토큰 유지.

**구현 메모**: 자동 접힘은 CSS media query로 그리드 열을 줄이되, page의 `leftOpen`/`rightOpen` 사용자 의도와 충돌하지 않게 — CSS는 "표시 가능 폭"을, JS state는 "사용자 토글 의도"를 담당. 좁은 폭에선 CSS가 우선해 패널을 오버레이로. 정확한 브레이크포인트·오버레이 메커니즘은 구현에서 시각 검증(핸드오프 §5 정적 하니스 스크린샷).

---

## D6. 아웃라인 파생 — 순수함수 `outlineFromDoc`

**Decision**: `outlineFromDoc(bodyJson: string): OutlineItem[]` 순수함수. ProseMirror **JSON 문자열**을 파싱해 트리를 walk, `node.type === 'heading' && node.attrs.level ∈ {1,2}`인 노드를 등장 순서대로 수집. `{ level, text, index }`(index = 방출 순번).

**정합 근거(tasks 진입 grep으로 확정)**: 기존 에디터 순수함수 `countCharsForManuscript`(`manuscript.ts`)가 **ProseMirror JSON 문자열 입력** 컨벤션 — 테스트도 plain JSON 객체 → `JSON.stringify`. `outlineFromDoc`도 동일 컨벤션. PM Node/`getSchema`/`Node.fromJSON` 불필요 → 테스트 단순·견고. PM `pos` 위치 산술을 JSON에서 재현하면 fragile하므로 **점프 pos는 라이브 에디터에서 해결**(아래).

**점프 pos 해결**(StudioOutline, 순수함수 밖): 클릭 item의 `index` → `editor.state.doc.descendants`로 level1·2 heading pos 순차 수집 → `positions[index]` → `setTextSelection(pos+1).focus()` + heading DOM 스크롤. PM 자체 iteration 사용.

**TDD**(§5 글로벌, RED→GREEN, 한 번에 하나):
- 빈 문자열 / 파싱 실패 / 빈 문서 → `[]`
- H1·H2 혼합 순서 보존 + level 정확 + index 0..n
- level 3+ 제외(설계 §아웃라인은 1·2만)
- heading 아닌 노드(paragraph/blockquote/list) 무시
- 빈/공백 heading 텍스트 → 항목 유지(index 보존), 텍스트는 빈 문자열
- 동일 텍스트 중복 heading → 각각 별도 항목(index로 구분)

**테스트 doc 구성**: plain JSON 객체(`{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'1장'}]}, …]}`) → `JSON.stringify` → `outlineFromDoc`. DOM/스키마 불필요, mock 없음(`manuscript.test.ts` 패턴 재사용).

**현재 섹션 하이라이트**: `StudioOutline`이 `.editor-scroll` 스크롤/IntersectionObserver로 현재 뷰포트 상단 위 마지막 heading을 판정 → 해당 항목 `aria-current` + 굵기/배경(색만 아님, FR-007). RTL 테스트는 항목 렌더·클릭 점프 호출·빈 상태 행위 중심(스크롤 하이라이트는 시각/dogfooding).

---

## D7. 접근성 / 한국어

- 패널 텍스트 대비 ≥4.5:1 — 기존 `--ink`/`--surface` 토큰 계승(Scope A 웜 정합 완료).
- 토글: `aria-pressed`(현 곁쪽지 토글 패턴 계승). 아웃라인 항목: `<button>` 키보드 포커스 + 현재 섹션 `aria-current="true"`. 섹션 접기: 헤더 버튼 `aria-expanded`.
- `prefers-reduced-motion: reduce` → 점프 스크롤 즉시(D2), 패널 전환 애니메이션도 reduce 대체(기존 `--ease-*`/애니메이션 정책 계승).
- 한국어 heading 텍스트 → `node.textContent` 추출 정상(텍스트 기반).

---

## 신규/변경 파일 요약

| 파일 | 신규/변경 | 비고 |
|---|---|---|
| `frontend/src/lib/editor/outline.ts` | 신규 | `OutlineItem` 타입 + `outlineFromDoc` 순수함수 |
| `frontend/src/lib/editor/outline.test.ts` | 신규 | 순수함수 단위 테스트(TDD) |
| `frontend/src/components/editor/StudioOutline.tsx` | 신규 | `'use client'`. 목차 렌더·점프·하이라이트 |
| `frontend/src/components/editor/StudioOutline.test.tsx` | 신규 | RTL 행위 테스트 |
| `frontend/src/components/workspace/CharacterPanel.tsx` | 신규 | `'use client'`. 인물 보기 + 빠른 추가 |
| `frontend/src/components/workspace/CharacterPanel.test.tsx` | 신규 | RTL(HTTP 경계 mock) |
| `frontend/src/components/workspace/StudioRightStack.tsx` | 신규(또는 page 인라인) | 우측 스택(인물+곁쪽지) + 개별 접기 |
| `frontend/src/lib/query/useCharacters.ts` | 신규 | `useProjectCharacters` / `useCreateCharacter` |
| `frontend/src/components/editor/PaperEditor.tsx` | 변경(최소) | `onEditorReady?` prop + effect 1개 |
| `frontend/src/app/projects/[id]/write/page.tsx` | 변경 | 3단 결선·토글 2개·에디터 참조 보유 |
| `frontend/src/styles/desktop-app.css` | 변경 | `.screen-body` 3열화 + 아웃라인/우측스택 클래스 + 반응형 |

**백엔드 변경: 없음.**
