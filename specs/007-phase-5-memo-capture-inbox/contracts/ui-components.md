# Contract: Renderer 컴포넌트 (props 경계)

본 Phase에서 결선/신설하는 컴포넌트의 props 계약. props는 함수 파라미터에 직접 타입(React.FC 금지 — TS 룰).

## QuickCapture (수정) — `src/components/QuickCapture.tsx`

빠른 메모 모달. 어느 화면에서든 Rail 캡처 버튼으로 열림.

```ts
type QuickCaptureProps = {
  activeProjectId: string | null;   // 있으면 기본 연결, null이면 미연결
  onClose: () => void;
  onCaptured: () => void;           // 저장 성공 시(App memoRefresh 증가 트리거)
};
```
**행위**
- textarea 제어 상태. `body.trim() === ""`이면 저장 비활성/무시(FR-003).
- 저장: `memos.create({ body, linkedProjectId: activeProjectId })` → 성공 시 `onCaptured()` + `onClose()`.
- Escape 닫기·backdrop 닫기(기존 유지).

## MemoInboxScreen (수정) — `src/screens/MemoInboxScreen.tsx`

```ts
type MemoInboxScreenProps = {
  refresh: number;                  // App memoRefresh — 증가 시 재조회
  panelOpen: boolean;
  onTogglePanel: () => void;
};
```
**행위**
- mount + `refresh` 변경 시 `memos.list` + `projects.list` 자체 fetch → `toInboxMemoView`로 매핑(projectTitleById 맵 주입).
- 정렬: captured_at DESC(repository 보장).
- 필터: `전체 / 미연결`(미연결 = `linkedProjectId == null`).
- 인라인 입력란: 본문 한 줄 → `memos.create({ body, linkedProjectId: ??? })` → 로컬 `load()` 재조회.
  - ⚠️ 인라인 캡처의 연결 대상: inbox 화면에는 activeProject 개념이 직접 없음 → **미연결로 저장**(inbox는 정리 공간). (모달은 activeProject 연결, 인라인은 미연결 — 구현 시 확정/문서화)
- 각 메모 카드: 본문 · `dateLabel` · 연결 칩(작품 제목 또는 "미연결") · 삭제 버튼.
  - 연결 칩 클릭(연결/해제)은 **Phase 6** — 본 Phase는 표시 전용(클릭 no-op 또는 비활성).
- 삭제: 낙관적 제거 + `memos.delete(id)` + `Toast` 표시.
- 우측 패널(메모 현황 통계)은 기존 외관 유지하되 실데이터 수치로.

## Toast (신설) — `src/components/Toast.tsx`

되돌리기 가능한 단일 토스트.

```ts
type ToastProps = {
  message: string;
  actionLabel: string;              // "되돌리기"
  onAction: () => void;
  onDismiss: () => void;
  durationMs?: number;              // 기본 5000
};
```
**행위**
- 마운트 시 `durationMs` 후 `onDismiss` 자동 호출(`setTimeout`). unmount 시 `clearTimeout`.
- `onAction`(되돌리기) 클릭 → 호출부가 `memos.restore` + 재조회 + 토스트 제거.
- 새 삭제가 오면 호출부가 토스트를 교체(가장 최근 삭제 1건 대상).

## App (수정) — `src/App.tsx`

- `memoRefresh: number` state 추가.
- `<QuickCapture activeProjectId={activeProject?.id ?? null} onClose={...} onCaptured={() => setMemoRefresh(n => n + 1)} />`
- `<MemoInboxScreen refresh={memoRefresh} ... />`

## types (수정) — `src/types.ts`

`InboxMemo`를 data-model §4-1 형태로 교체. `MemoState`/`Screen` 등 기존 유지. `MemoPanel`용 `Memo`(tag)는 Phase 6이라 유지.
