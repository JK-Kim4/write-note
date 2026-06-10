# Client Contracts — 집필실 3단

본 기능은 **신규 외부 API(백엔드 endpoint)가 없다.** 인물은 기존 `/api/projects/{projectId}/characters` 계약(014/015 contracts)을 그대로 사용한다. 아래는 본 기능이 새로 도입하는 **클라이언트 내부 계약**(순수함수 시그니처 + React Query 훅) — TDD/구현의 기준.

## C1. 순수함수 — `outlineFromDoc`

```ts
// src/lib/editor/outline.ts
export type OutlineItem = {
  level: 1 | 2;
  text: string;
  index: number; // 방출된 항목의 순번(= doc 내 level1·2 heading 등장 순번). 점프 시 라이브 에디터에서 pos 해결에 사용
};

/**
 * ProseMirror JSON 본문에서 level 1·2 heading을 등장 순서대로 추출한다.
 * 순수함수 — DOM/React/네트워크/PM Node·schema 의존 없음. 기존 `countCharsForManuscript`(manuscript.ts) 컨벤션
 * (JSON 문자열 입력)과 정합. 백엔드 변경 없음(클라이언트 파생).
 */
export function outlineFromDoc(bodyJson: string): OutlineItem[];
```

**계약(테스트로 고정)**:
- 빈 문자열 / 파싱 실패 / 빈 문서(`{type:'doc',content:[]}`) → `[]`.
- level 1·2 heading만 포함, level 3+ 제외, heading 외 노드(paragraph/blockquote/list) 무시.
- 등장 순서 보존. `index`는 0부터 방출 순번. 동일 text 중복은 `index`로 구분되는 별개 항목.
- `text`는 heading의 텍스트 노드 이어붙임(빈/공백 가능, 항목은 유지).

**점프 시 pos 해결**(StudioOutline 책임, 순수함수 밖): 클릭 item의 `index` → 라이브 `editor.state.doc.descendants`로 level1·2 heading pos를 순서대로 수집해 `positions[index]` 사용. PM 자체 iteration을 쓰므로 위치 산술 재현 불필요(견고).

## C2. React Query 훅 — 인물

```ts
// src/lib/query/useCharacters.ts
export const characterKeys: {
  all: readonly ["characters"];
  byProject: (projectId: number) => readonly ["characters", "project", number];
};

/** 현재 작품의 등장인물 목록(빠른 추가 패널용). 내부에서 listCharacters(...).content 노출. */
export function useProjectCharacters(projectId: number): UseQueryResult<CharacterResponse[]>;

/** 빠른 추가. onSuccess 시 byProject(projectId) 무효화(invalidate). */
export function useCreateCharacter(): UseMutationResult<
  CharacterResponse,
  unknown,
  { projectId: number; input: CreateCharacterInput }
>;
```

**계약**:
- `useProjectCharacters`: `Number.isFinite(projectId)`일 때만 enabled. `Page<CharacterResponse>.content` → `CharacterResponse[]`.
- `useCreateCharacter`: 성공 시 해당 작품 인물 쿼리 무효화 → 목록 자동 갱신. 실패 시 호출부가 에러를 표시하고 입력 보존.

## C3. 컴포넌트 prop 계약

### `PaperEditor` (변경 — 추가 prop)
```ts
type PaperEditorProps = {
  // ...기존 props 불변...
  onEditorReady?: (editor: Editor | null) => void; // 에디터 준비/파기 시 참조 노출
};
```
- 기존 props(`title`/`initialBodyJson`/`onChange`/`onDraftUpdate`/`lined`/`zoom`)·내부 로직(IME 가드·자동저장·페이지분할) **불변**.

### `StudioOutline` (신규, presentational) + `useEditorOutline` (신규, 글루 훅)
구현 시 정제: **presentational 컴포넌트 + editor 글루 훅** 으로 분리(TS 룰 "표시 컴포넌트는 props만" + 테스트 용이성). 에디터 결선(구독/스크롤/점프)은 훅이, 렌더는 컴포넌트가 담당.
```ts
// StudioOutline.tsx — presentational
type StudioOutlineProps = {
  items: OutlineItem[];
  activeIndex: number | null;
  onSelect: (item: OutlineItem) => void;
};

// useEditorOutline.ts — editor 글루(page가 보유한 editor 주입)
function useEditorOutline(editor: Editor | null): {
  items: OutlineItem[];           // outlineFromDoc 디바운스 파생
  activeIndex: number | null;     // .editor-scroll 스크롤 추적
  selectItem: (item: OutlineItem) => void; // index→pos 해결 + 커서 이동 + 스크롤(reduced-motion)
};
```
- 행위: 훅이 에디터 doc → `outlineFromDoc`로 목차 파생(디바운스 재파생)·현재 섹션 추적, `selectItem`이 커서 이동+스크롤 점프(D2). 컴포넌트가 목차 렌더·빈 상태 안내(FR-009)·현재 섹션 `aria-current` 하이라이트.
- page 결선: `const outline = useEditorOutline(editor); <StudioOutline items={outline.items} activeIndex={outline.activeIndex} onSelect={outline.selectItem} />`.

### `CharacterPanel` (신규)
```ts
type CharacterPanelProps = {
  projectId: number;
};
```
- 행위: `useProjectCharacters`로 목록 렌더(이름·한 줄·상세 펼침), 빠른 추가(`useCreateCharacter`), 빈 상태(FR-015), 상세 화면 링크(FR-014).

### `MemoPanel` (불변)
- 기존 props 그대로. 우측 스택 하단 배치만 변경.
