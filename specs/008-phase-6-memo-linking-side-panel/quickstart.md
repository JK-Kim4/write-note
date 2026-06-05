# Quickstart — 검증 / dogfooding (Desktop Phase 6)

## 환경 (회귀 방지 — HARD)

셸 기본 Node 는 v20 이나 node:sqlite 는 Node 24 필요. 모든 명령 전 PATH 선행:

```bash
cd desktop
export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"
node -v   # v24.14.0 확인
```

## 자동화 게이트

corepack 최신 pnpm lockfile 충돌 회피를 위해 바이너리 직접 실행:

```bash
node_modules/.bin/vitest run        # 단위/컴포넌트 TDD (repository·store·schema·매퍼·UI)
node_modules/.bin/tsc --noEmit      # 타입 게이트
node_modules/.bin/vite build        # 빌드 게이트
```

전부 GREEN + Phase 3/4/5 회귀 0 확인 후 dogfooding 진입.

## TDD 순서 (Red → Green)

1. **schema** — v3→v4 마이그레이션: 기존 단일 연결 메모가 `memo_projects` 행으로 보존(SC-006) + `linked_project_id` 제거 확인.
2. **memoRepository** — `addLink` 멱등 / `removeLink` / `listByProject`(soft-delete 제외·정렬) / `list` 의 `linkedProjectIds` 집계.
3. **store** — `captureMemo` 트랜잭션(메모+연결 원자성, linkProjectId 없으면 미연결).
4. **memoView** — `linkedProjects` 복수 매핑 + 사라진 작품 id 필터.
5. **renderer (RTL, 행위 기준)** — `LinkPopover` 토글 / `MemoInboxScreen` 칩 복수·연결·해제 / `MemoPanel` 실데이터·빈 상태·칩 해제.

## preload smoke (agent-workflow §8)

dev 기동 후 renderer 콘솔에서 신규 IPC 노출 1회 확인(첫 호출 전):

```js
typeof window.electronAPI.memos.listByProject  // "function"
typeof window.electronAPI.memos.addLink        // "function"
typeof window.electronAPI.memos.removeLink     // "function"
```

## 수동 dogfooding 시나리오 (spec 정합)

```bash
node_modules/.bin/vite build && pnpm dev   # 또는 dev 직접
```

1. **기본 연결/해제 (US1)**: 메모 2개 생성. 하나를 작품 A 에 연결(연결 버튼 → 팝오버 체크), 하나는 미연결 유지. 메모 행에 작품 A 칩 표시 확인. 칩 ✕ 로 해제 → 미연결 복귀 확인.
2. **필터**: "미연결" 필터에서 방금 연결한 메모가 빠지는지 확인.
3. **집필 패널 (US2)**: 작품 A 집필 화면 진입 → 패널에 A 연결 메모만 표시. 작품 B 집필 화면 → 그 메모 안 보임. 패널 칩 ✕ 로 해제 → 패널에서 즉시 사라짐(FR-009).
4. **다중 연결 (US3)**: 한 메모를 작품 A·B 양쪽에 연결 → 메모 행에 두 칩. A 패널·B 패널 양쪽에 그 메모 표시 확인. A 만 해제 → B 패널엔 유지.
5. **캡처 자동연결 (FR-010)**: 작품 A 집필 중 빠른 메모 캡처 → 새 메모가 A 에 자동 연결되어 A 패널/Inbox 칩에 보임. 작품 없이 캡처 → 미연결.
6. **빈 상태 (FR-015)**: 연결 메모 0인 작품 패널이 어색하지 않은 빈 상태인지.
7. **작품 삭제 (FR-011)**: 연결 작품 삭제 → 메모는 Inbox 에 남고 그 연결만 사라짐.
8. **한국어/테마**: 라이트·다크 양쪽 + 한국어 본문 메모 렌더 확인.

## 완료 판정

- 자동화 게이트 3종 GREEN + 회귀 0.
- dogfooding 1~8 통과.
- 문서 정정: `docs/phase/06/README.md` 제외에서 "다중 프로젝트 연결" 제거 / `docs/STATUS.md`·vault `02-PROGRESS.md` Phase 6 반영.
