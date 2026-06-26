# 보드 중심 전환 — 메모·인물 글로벌 UI 폐기 (데이터 보존) · 044

| 항목 | 내용 |
|------|------|
| 작성일 | 2026-06-26 |
| 트랙 | 보드 E (메모·인물 통합) — **1단계: 제거(가져오기 후속)** |
| 브랜치 | `038-memo-plot-board` (보드 미배포 — merge 전까지 운영 영향 0) |
| 성격 | **FE 중심 제거 + 홈 보드 패널 신설. BE·DB·스키마·iOS 캡처 무변경(비파괴, 되돌리기 가능)** |
| 상위 SoT | `board-prd.md` §0/§2(메모·인물 메뉴 폐기→보드 통합), `docs/board/board-track-e-design-draft.md` |

## 1. 결정 (사용자 확정)
- 메모·인물의 **앱 내 UI 전부 제거** → 보드가 이야기 요소의 유일한 자리.
- **데이터·스키마·iOS 캡처(`POST /api/capture`)·BE 컨트롤러/서비스 보존**(비파괴). FE만 제거 → 복원 가능.
- 기존 데이터 **"가져오기"(카드화)는 후속 spec**(이번엔 제거만).
- 홈 대시보드 오른쪽 **메모 패널 → 보드 패널로 교체**(제거가 아니라 교체).
- 집필실 우측 패널 **메모·인물 탭 제거, 보드 탭만**.

## 2. 범위 (실측 전수)

### 2-1. 홈 대시보드 `(main)/page.tsx`
- 오른쪽 메모 패널(`BMemoStrip`) → **신규 `BBoardStrip`(보드 패널)**: 최근 보드(`useBoardsMine`) + "모두 보기 →/boards" + "+ 새 보드"(→/boards).
- 모바일 메모 drawer → 보드 drawer 동일 교체. 홈 `QuickCapture`·메모 조회(`useInboxMemos`) 제거.
- 부제 "메모와 등장인물…" → 집필/보드 중심 문구.
- 왼쪽(작품 미니카드 + 집필 리듬) 불변.

### 2-2. 집필실 `BWorkSidePanel.tsx`
- `MemosTab`·`CharactersTab` 제거. 보드 목록(`InlineBoardList`)만 — 탭 전환 UI 제거, 헤더 "보드". wordCount 푸터·접기 보존.
- `BStudioShell` `panelTab` 상태 단순화(보드 단일).

### 2-3. 글로벌
- nav `(main)/layout.tsx` "메모"·"인물" 항목·아이콘 제거.
- `/memos`·`/characters` 라우트 삭제 + `next.config` redirect → `/boards`.
- `providers.tsx` 전역 ⌘+N `QuickCaptureModal` 제거.
- 온보딩 `onboardingSteps.ts` 메모·인물 단계 제거.

### 2-4. 고아 컴포넌트 정리(내 변경이 만든 orphan)
- `BMemoStrip`·`QuickCaptureModal`·`QuickCapture`·`components/memos/*` 제거.
- FE 메모/인물 api·query 훅은 **다른 곳에서 안 쓰면** 제거(서브에이전트 전수 조사로 잔존 경로 확인).

### 2-5. 보존 (변경 0)
- DB `memos`·`characters`·`memo_projects` 테이블·데이터·스키마.
- iOS 캡처 `POST /api/capture` + BE `MemoController`·`CharacterController`·서비스(웹 미사용이나 iOS·후속 가져오기 위해 유지).

## 3. 신규 컴포넌트
- `BBoardStrip.tsx`(표시 컴포넌트, props: `boards`, `onNew`, `onOpenAll`, `onOpen`) — `BMemoStrip` 패턴 동형. RTL 행위 테스트.

## 4. 검증
- FE: typecheck·lint0err·test(제거 surface 테스트 정리·BBoardStrip 신규)·build.
- 회귀 grep: 잔존 `/memos`·`/characters`·`BMemoStrip`·`QuickCapture`·nav 메모/인물 참조 0.
- **서브에이전트 전수 조사**: 메모·인물 기능에 도달 가능한 UI/라우트/단축키 경로 0 확인.
- BE 무변경(게이트 불필요, 회귀 0 확인).

## 5. 되돌리기 / 후속
- 되돌리기: FE 제거분 복원(BE·데이터 그대로라 안전).
- 후속: 보드 "가져오기"(기존 메모·인물 → 카드 복제) 별도 spec(045 후보).
