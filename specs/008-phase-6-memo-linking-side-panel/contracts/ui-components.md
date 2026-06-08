# UI 컴포넌트 계약 (Phase 6)

renderer 컴포넌트 props 경계. DESIGN.md 토큰 재사용(신규 비주얼 언어 없음). 이벤트 핸들러/hook 보유 컴포넌트는 모두 renderer(Electron — RSC 경계 무관).

## 1. `LinkPopover` (신규) — `src/components/LinkPopover.tsx`

메모 하나에 대해 전체 작품 연결 상태를 체크리스트로 보여주고 토글한다.

```ts
type LinkPopoverProps = {
  projects: { id: string; title: string }[];   // 전체 작품(연결 후보)
  linkedProjectIds: string[];                   // 현재 이 메모가 연결된 작품 id
  onToggle: (projectId: string, next: boolean) => void;  // next=true 연결 / false 해제
  onClose: () => void;
};
```

- 작품 목록 각 항목: 제목 + 연결 상태(체크). 클릭 → `onToggle(id, !현재상태)`.
- `projects` 가 비면 "먼저 작품을 만들어 주세요" 빈 상태(FR-013), 토글 없음.
- Esc/바깥 클릭으로 `onClose`. 스타일: DESIGN §세그먼트 토글·§Card·§연결 칩 토큰.

## 2. `MemoInboxScreen` (수정) — `src/screens/MemoInboxScreen.tsx`

- 메모 행: 연결 작품들을 **칩 목록**(복수)으로 표시. 각 칩 ✕ → `removeLink` 후 재조회(FR-003, FR-005).
- 삭제 버튼 옆 **"연결" 버튼** 신설 → 해당 메모 `LinkPopover` 토글.
- `LinkPopover.onToggle` → `true` 면 `memos.addLink`, `false` 면 `memos.removeLink`, 후 `load()` 재조회.
- `load()` 는 기존대로 `memos.list()` + `projects.list()` 로 `InboxMemo`(linkedProjects 복수) 구성.
- 필터(전체/미연결) 기준: `linkedProjects.length === 0` 이면 미연결(기존 단수 → 복수 정합).
- 기존 soft delete + 되돌리기 토스트 동작 유지(회귀 0).

## 3. `MemoPanel` (전면 수정 — 더미 제거) — `src/components/MemoPanel.tsx`

집필 화면 우측 사이드 패널. 하드코딩 `MEMOS` + 구 `Memo`(date/tag) 제거.

```ts
type MemoPanelProps = {
  memos: InboxMemo[];                       // 현재 작품 연결 메모(listByProject 결과 → view)
  loading: boolean;
  onUnlink: (memoId: string) => void;       // 패널 내 빠른 해제(FR-007)
};
```

- `memos` 를 조용한 카드로 나열(DESIGN "에디터보다 약하게(HARD)" 유지, FR-008). 각 카드에 칩 ✕ → `onUnlink`.
- `loading` 중 스켈레톤(기존). 빈 배열이면 "이 작품에 연결된 메모가 아직 없어요" 빈 상태(FR-015).
- 표시 항목: 본문 + `dateLabel`(연결 작품 칩은 패널에선 현재 작품 자명하므로 생략 가능 — 본문 중심).

## 4. `WriteStudioScreen` (수정) — `src/screens/WriteStudioScreen.tsx`

- `memos: MemoState`(문자열 enum) prop 제거 → `MemoPanel` 에 실데이터 props 전달.
- 현재 작품 연결 메모 조회/상태는 App 또는 화면이 보유(아래 4·5 참조). 패널 토글(PanelToggle) 동작 유지.

## 5. `App` (수정) — `src/App.tsx`

- 더미 `const [memos] = useState<MemoState>("loaded")` 제거.
- 현재 작품 연결 메모 상태 보유: `activeProject.id` 로 `memos.listByProject` 조회 → `InboxMemo[]` + loading.
  - 조회 트리거: `activeProject` 변경 시 + `memoRefresh` 변경 시(캡처/Inbox 연결 변경 교차 갱신, FR-009).
- 패널 내 해제 핸들러: `memos.removeLink(activeProject.id, memoId)` → 즉시 재조회(FR-009 즉시 반영).
- 기존 `memoRefresh` 카운터 브리지 재사용(QuickCapture 캡처 시 증가 — 유지).

## 6. `QuickCapture` (소폭 수정) — `src/components/QuickCapture.tsx`

- `memos.create({ body, linkedProjectId: activeProjectId })` → `memos.create({ body, linkProjectId: activeProjectId })` (입력 키 정리, store.captureMemo 결선). 동작(active 작품 자동연결/없으면 미연결) 동일(FR-010).

## 불변식 / 회귀 가드

- `MemoPanel` 은 글쓰기 영역보다 시각적으로 약하게(FR-008, DESIGN HARD).
- 패널/Inbox 빈 상태 항상 제공(FR-015).
- 기존 Phase 5 동작(캡처 2진입점·필터·soft delete·토스트) 회귀 0.
- 한국어 본문 렌더 영역 변경 — dogfooding 라이트/다크 확인(typescript code-quality 한국어 cadence).
