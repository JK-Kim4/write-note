# Data Model — 집필실 3단 (Studio 3-panel)

**Phase 1 산출** · 본 기능은 **백엔드/영속 데이터 모델 변경 0**. 아래는 클라이언트 파생/표시 모델과 기존 엔티티 재사용 매핑이다.

## 1. OutlineItem (신규 — 클라이언트 파생, 비영속)

원고 본문의 한 제목(heading)을 가리키는 파생 표시값. 저장·전송되지 않으며 에디터 doc에서 매번 파생.

| 필드 | 타입 | 의미 |
|---|---|---|
| `level` | `1 \| 2` | heading 레벨(설계상 1·2만 대상) |
| `text` | `string` | heading의 텍스트(텍스트 노드 이어붙임). 빈/공백 가능 |
| `index` | `number` | 방출 순번(= doc 내 level1·2 heading 등장 순번). 점프 시 pos 해결 키 |

- **파생원**: `outlineFromDoc(bodyJson)` — ProseMirror **JSON 문자열**을 파싱해 level 1·2 heading을 등장 순서대로 수집(기존 `countCharsForManuscript` 컨벤션 정합, PM Node/schema 비의존).
- **검증 규칙**: level 3+ 제외. heading 외 노드 무시. 동일 text 중복은 `index`로 구분되는 별개 항목. 빈 문자열/파싱 실패/빈 문서 → `[]`.
- **점프 pos**: 순수함수가 산출하지 않음. StudioOutline이 클릭 시 라이브 `editor.state.doc`에서 `index`번째 heading pos를 해결(PM iteration 사용).
- **상태 전이 없음**(불변 파생값). 문서 변경 시 전체 재파생(디바운스).

## 2. Character (기존 재사용 — 신규 필드 0)

`src/types/api.ts`의 `CharacterResponse` 그대로 사용. 본 기능은 **읽기 + 생성(빠른 추가)** 만.

| 필드 | 타입 | 본 기능에서의 표시 |
|---|---|---|
| `id` | `number` | key / 상세 링크 |
| `projectId` | `number` | 쿼리 키 스코프 |
| `name` | `string` | 인물 이름(목록·빠른 추가 필수) |
| `shortDescription` | `string \| null` | 한 줄 설명(목록 표시 + 빠른 추가 선택 입력) |
| `notes` | `string \| null` | 상세 노트(펼침 시 표시) |
| `displayOrder` | `number` | 목록 정렬(서버가 부여, 본 기능 변경 X) |
| `createdAt` / `updatedAt` | `string` | 표시 안 함 |

- **생성 입력**(`CreateCharacterInput`): `{ name, shortDescription?, notes?, displayOrder? }`. 빠른 추가는 `name`(+선택 `shortDescription`)만 전송. `displayOrder`는 서버 기본값.
- **검증 규칙**(FR-016): `name` 빈 문자열/공백 → 제출 비활성. 생성 실패 → 에러 노출 + 입력값 보존.
- 상세 수정·삭제·재정렬은 본 기능 범위 밖 → `/projects/[id]/characters` 링크(FR-014).

## 3. 연결 메모 / 곁쪽지 (기존 재사용 — 동작 불변)

`InboxMemo`(`@/lib/types/domain`) + 기존 `useProjectMemos`/`useSetPinMemo`/`useRemoveLinkMemo`. `MemoPanel` 컴포넌트·props **불변**(FR-017). 우측 스택 하단에 위치만 이동.

## 4. UI 상태 (page 로컬, 비영속)

| 상태 | 기본값 | 의미 |
|---|---|---|
| `leftOpen` | `true` | 아웃라인 패널 펼침(사용자 확정: "아웃라인만 펼침") |
| `rightOpen` | `false` | 우측 맥락 패널(인물+곁쪽지) 펼침 |
| `editor` | `null` | `PaperEditor`가 `onEditorReady`로 올린 에디터 참조 |
| (스택 내부) 인물/곁쪽지 섹션 접힘 | 각 펼침 | 우측 스택 컨테이너 로컬 상태 |

영속화(localStorage 등)는 본 범위 밖.

## 5. React Query 키 (신규)

```
characterKeys = {
  all: ['characters'] as const,
  byProject: (projectId: number) => [...all, 'project', projectId] as const,
}
```
- `useProjectCharacters(projectId)` → `listCharacters(projectId, {size})`의 `.content`.
- `useCreateCharacter()` → `onSuccess` 시 `characterKeys.byProject(projectId)` 무효화(D3 invalidate).
