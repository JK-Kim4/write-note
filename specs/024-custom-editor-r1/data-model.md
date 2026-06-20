# Phase 1 Data Model — 자체 에디터 엔진 1라운드

본 라운드는 **백엔드/DB 변경 0**. 본 문서는 **프론트 메모리 내부모델**과 **디스크(PM JSON) 경계 표현**, 그리고 그 사이 변환·기하 파생을 규정한다. 영속 스키마는 기존과 동일(`documents.bodyJson` 문자열).

## 1. 디스크 표현 (영속 — 기존, 무변경)

- **`documents.bodyJson`**: ProseMirror JSON 문자열. `{ type:'doc', content: Node[] }`.
  - 본 라운드가 읽고/쓰는 노드: `paragraph`, `heading{attrs:{level:1|2|3}}`, 그리고 텍스트 노드 `text`.
  - 본 라운드가 **읽되 평탄화**(lossy)하는 노드: `bulletList`/`orderedList`/`listItem`/`blockquote`/`codeBlock`/`horizontalRule` 등(프레시 테스트 챕터 전제라 실제로는 드묾).
- **버전 토큰 `version`**: 불투명 ISO8601 문자열. 저장마다 서버 발급. 공동집필 충돌 감지 기준. **무변경·무력화 금지**.

## 2. 메모리 내부모델 (휘발 — 신규)

### 2.1 `DocModel`
```
DocModel = {
  buffer: string          // 평문. '\n' = 블록 구분, U+FFFC = 이미지 마커
  blockAttrs: BlockAttr[] // 길이 = buffer.split('\n').length 와 항상 일치(불변식)
}
```

### 2.2 `BlockAttr`
```
BlockAttr =
  | { type: 'paragraph' }
  | { type: 'heading'; level: 1 | 2 | 3 }
```
- 이미지 블록(버퍼 세그먼트 === U+FFFC)은 별도 attr 불필요 — 렌더/측정 시 세그먼트 내용으로 판별(`type:'image'` 파생). `blockAttrs[i]`는 이미지 블록 자리에 `{type:'paragraph'}`(무의미 placeholder)로 채워 인덱스 정렬 유지.

### 2.3 `Selection`
```
Selection = { anchor: number; focus: number }  // buffer offset (PoC 동일)
```

### 2.4 불변식 (TDD 보호 — `model.test.ts`)
- **INV-1 정렬**: `blockAttrs.length === buffer.split('\n').length`. 모든 편집 연산 후 성립.
- **INV-2 heading level 범위**: `type==='heading'`이면 `level ∈ {1,2,3}`.
- **INV-3 빈 모델**: 빈 챕터 = `{ buffer:'', blockAttrs:[{type:'paragraph'}] }`(빈 문단 1블록, 빈 페이지 렌더·입력 가능).

## 3. 편집 연산 (`model.ts` — buffer/blockAttrs 동기 유지)

| 연산 | 입력 | buffer 변화 | blockAttrs 변화 |
|---|---|---|---|
| `insertText(model, sel, text)` | 캐럿/선택 | 선택 치환 삽입(개행 포함 가능) | 개행 수만큼 블록 증가분 = paragraph 삽입, 시작 블록 attr 유지 |
| `splitBlock(model, caret)` (Enter) | 캐럿 | 캐럿 위치에 `\n` | index+1에 `{type:'paragraph'}` 삽입(앞 블록 attr 유지) |
| `mergeWithPrev(model, blockIdx)` (블록시작 Backspace) | 블록 인덱스 | 이전 `\n` 제거 | 이전 블록 attr 유지, 현재 attr 제거 |
| `mergeWithNext(model, blockIdx)` (블록끝 Delete) | 블록 인덱스 | 다음 `\n` 제거 | 현재 attr 유지, 다음 attr 제거 |
| `deleteSelection(model, sel)` | 선택 | 선택 제거 | 삭제 후 경계 재계산, 시작 블록 attr 유지 |
| `toggleHeading(model, blockIdx, level)` | 블록·레벨 | 불변 | 해당 블록 attr ↔ `{type:'heading',level}`/`{type:'paragraph'}` |

- 모든 연산은 **순수**(새 `DocModel` 반환), 호출부가 `EditContext` 동기.
- 연산 후 INV-1 가드. 위반(미가로챈 자동 편집) 시 fallback: 블록 수에 맞춰 `blockAttrs` 길이 보정(신규=paragraph).

## 4. 측정/레이아웃 파생 (휘발)

### 4.1 `BlockFont` (신규 — `geometry.ts`)
```
blockFont(attr: BlockAttr, base: PageGeometry) → { fontSizePx: number; lineHeightPx: number }
```
- paragraph → `{ base.fontSizePx, base.lineHeightPx }`
- heading level 1/2/3 → fontSize `× {1: 1.8, 2: 1.5, 3: 1.25}`, lineHeight = fontSize × ratio(1.8). (배율은 상수, dogfooding 튜닝 대상.)

### 4.2 `PageGeometry` (기존 — A2 추가)
```
PageGeometry = { pageWidthPx, pageHeightPx, contentWidthPx, contentHeightPx, fontSizePx, lineHeightPx }
PaperSize = 'A5' | 'A4' | 'B4' | 'A3' | 'A2'   // ★ A2(420×594mm) 추가
```
- 프로젝트 `paperSize`(A4/A3/A2/B4) → `pageGeometry(size, fontSizePx)`. A5는 엔진 보유(프로젝트 미사용).

### 4.3 `MeasuredBlock` / `LaidOutPage` (기존 — 무변경)
- `layoutEngine.ts`의 `MeasuredBlock`(paragraph: `MeasuredLine[]`, image: height) / `LaidOutPage`(fragments + usedHeight). `layout()`은 줄/이미지 height만 보므로 heading 가변 줄높이를 **무수정** 처리.
- `MeasuredLine = { height, start, end }` — height가 블록 폰트의 lineHeightPx.

## 5. 아웃라인 파생 (휘발 — `custom-editor/outline.ts`)
```
OutlineItem = { level: 1|2|3; text: string; index: number }   // lib/editor/outline.ts 타입 재사용
outlineFromModel(model) → OutlineItem[]                         // heading 블록 등장순
headingLayoutCoord(model, layout, index) → { pageIndex, offsetY } // 점프용 엔진 좌표
```

## 6. 히스토리 (휘발 — `history.ts`)
```
Snapshot = { buffer: string; blockAttrs: BlockAttr[]; selection: Selection }
History = { undo: Snapshot[]; redo: Snapshot[] }
```
- push: 구조 편집 경계마다 새 스냅샷, 연속 타이핑은 직전 스냅샷 교체(coalesce).
- undo/redo: 스냅샷 복원 → `EditContext` 동기.

## 7. 저장 경계 흐름

```
[로드]  documents.bodyJson(문자열) ──pmJsonToModel──▶ DocModel ──relayout──▶ 화면
[입력]  키/IME/마우스 ──model 편집 연산──▶ DocModel ──relayout──▶ 화면 + EditContext 동기
[저장]  DocModel ──modelToPmJson──▶ bodyJson(문자열) ──useDocumentSession(body=문자열)──▶ PUT {body, version}
[draft] 입력마다 modelToPmJson 결과를 session.flushDraft(문자열) → localStorage(wn:draft:doc:{id})
```
- `useDocumentSession`의 `body`/`serverBody`/`restoredBody`는 모두 **문자열(bodyJson)** → 경계에서 `modelToPmJson`/`pmJsonToModel`만 끼우면 plumbing 무수정.
