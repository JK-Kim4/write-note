# Desktop App QA Report — 2026-06-06

## 범위

- 대상: `desktop/` Electron 앱
- 브랜치: `develop`
- 기준 원격: `origin/develop`
- QA 방식: 자동화 게이트 + 실제 Electron 창 기반 Computer Use 수동 QA
- 주 검증 화면: 작품 목록, 집필실, 연결 메모 패널, 메모 inbox, 빠른 메모, 설정, 기록

## 환경

| 항목 | 값 |
|---|---|
| Node | `v24.14.0` |
| pnpm | `8.15.5` |
| Node 경로 | `/Users/jongwan-air/.nvm/versions/node/v24.14.0/bin/node` |
| pnpm 경로 | `/Users/jongwan-air/.nvm/versions/node/v24.14.0/bin/pnpm` |
| 앱 실행 | `cd desktop && pnpm dev` |

메모: `node:sqlite` 사용 때문에 `desktop` 검증은 Node 24 환경이 필요하다. `nvm alias default 24.14.0` 및 non-interactive shell 경로 정합 후 검증했다.

## 자동화 검증

| 명령 | 결과 |
|---|---|
| `pnpm test` | PASS — 16 files / 100 tests |
| `pnpm typecheck` | PASS |
| `pnpm build` | PASS |

빌드 참고: renderer bundle에서 Vite chunk size warning이 1건 발생했다. 실패는 아니며 별도 성능 최적화 후보로 분리 가능하다.

## 수동 QA 결과

| 시나리오 | 결과 | 확인 내용 |
|---|---|---|
| 앱 실행 | PASS | Electron 창이 정상 기동하고 작품 목록 화면으로 진입 |
| 작품 열기 | PASS | 기존 작품 `가가거걱` 클릭 시 집필 화면으로 전환 |
| 집필 화면 상태 | PASS | 저장 상태, 글자수, 확대/축소, 줄노트 토글, 연결 메모 토글 표시 |
| 연결 메모 패널 빈 상태 | PASS | 연결 메모가 없을 때 빈 상태 문구 표시 |
| 메모 inbox 진입 | PASS | 전체/미연결 필터, inline 입력, 메모 현황 패널 표시 |
| inline 메모 추가 | PASS | 메모 추가 후 전체 카운트 증가, 입력 필드 초기화 |
| 메모-작품 연결 | PASS with issue | 연결 자체는 성공. 단 UI 반영이 즉시 보이지 않는 지연 확인 |
| 집필 패널 반영 | PASS | 메모 화면에서 연결한 메모가 집필 화면 연결 패널에 표시 |
| 빠른 메모 | PASS with issue | 키보드 경로로 모달 열림, 입력/저장 정상, 현재 작품에 자동 연결 |
| 설정 테마 토글 | PASS | `종이`/`촛불` 전환 동작 확인 후 `종이`로 복원 |
| 자동저장 토글 | PASS | `켜기`/`끄기` 전환 동작 확인 후 `켜기`로 복원 |
| 기록 화면 | PASS | placeholder 안내와 요약 패널 정상 표시 |
| QA 데이터 정리 | PASS | QA 중 생성한 임시 메모 2개 삭제, 메모 수 원복 |

## 발견 이슈

### P2 — 메모 연결 후 UI 반영이 즉시 보이지 않음 — ✅ FIXED (2026-06-06)

- 위치: 메모 화면 `작품 연결` popover
- 재현:
  1. 메모 화면에서 미연결 메모의 `작품 연결`을 연다.
  2. 작품 `가가거걱`을 선택한다.
  3. 토글 값은 선택 상태로 바뀌지만, 카드의 `미연결` 표시와 오른쪽 미연결 카운트는 즉시 갱신되지 않는다.
  4. 다음 상호작용 후 연결 칩과 카운트가 반영된다.
- 실제 결과: 연결은 성공하지만 사용자가 즉시 성공 여부를 판단하기 어렵다.
- 기대 결과: 선택 직후 카드 상태, 연결 칩, 미연결 카운트가 같은 프레임 또는 명확한 loading 상태 후 동기화된다.
- 영향: 연결 성공 여부에 대한 피드백이 늦어져 사용자가 재클릭하거나 동작 실패로 오해할 수 있다.
- 권장 조치: 연결/해제 mutation 완료 후 해당 memo row와 summary count를 즉시 갱신하거나 optimistic update를 적용한다.
- **해결 (2026-06-06):**
  - 원인 규명: stale read·데이터 정합 버그가 아님. `node:sqlite`는 동기 API라 `addLink`→`load()`의 `list` 가 순차 await되어 데이터는 정상 갱신된다. 실제 원인은 **optimistic update 부재** — 클릭 → `addLink` IPC 왕복 → `load()` 전체 재조회 IPC 왕복 → `setMemos` 의 pessimistic 경로 동안 화면이 멈춰 "다음 상호작용 후 반영"으로 체감된 것. 같은 파일 `handleDelete` 는 이미 optimistic 이라 연결/해제만 패턴이 어긋나 있었다.
  - 조치: `applyLinkOptimistic` 헬퍼 추가 → `handleToggleLink`(연결/해제)·`handleUnlink`(칩 ✕)가 IPC 왕복 전에 해당 memo row 를 즉시 갱신. 미연결 라벨·연결 칩·우측 미연결 카운트가 같은 `memos` state 라 한 프레임에 동기화. 실패 시 `load()` 로 롤백.
  - 검증: 신규 테스트 2건(`should_link_optimistically_and_show_chip_without_reload`, `should_unlink_optimistically_and_remove_chip_without_reload`) RED→GREEN. `pnpm test`(102) / `pnpm typecheck` / `pnpm build` 전체 PASS.
  - 변경 파일: `desktop/src/screens/MemoInboxScreen.tsx`, `desktop/src/screens/MemoInboxScreen.test.tsx`

### P2 — 빠른 메모 버튼의 접근성 frame이 불안정함

- 위치: 왼쪽 rail 하단 `빠른 메모` 버튼
- 재현:
  1. Computer Use 접근성 트리에서 `빠른 메모` 버튼 노드를 확인한다.
  2. 해당 element action으로 클릭을 시도한다.
- 실제 결과: 접근성 노드는 존재하지만 `elementHasNoFrame`으로 직접 클릭이 실패했다. 좌표 클릭도 일부 상황에서 `noWindowsAvailable` 오류가 발생했다.
- 보완 확인: 키보드 포커스 경로에서는 빠른 메모 모달이 열리고, 입력/저장/현재 작품 자동 연결은 정상 동작했다.
- 기대 결과: 버튼의 접근성 frame이 안정적으로 노출되어 보조기술과 자동화 도구가 직접 조작할 수 있다.
- 영향: 마우스 사용자에게는 드러나지 않을 수 있으나, 보조기술/자동화/키보드 QA에서 조작 신뢰도가 낮아진다.
- 권장 조치: rail 하단 floating button의 실제 button hit area와 accessible bounds가 일치하는지 확인한다. 필요하면 버튼을 overflow/transform 영향을 덜 받는 구조로 옮기고 명시적 accessible name을 유지한다.
- **결론 (2026-06-06): 코드 결함 아님 — 종결 (수정 보류).**
  - 권장 조치(hit area ↔ accessible bounds 일치 여부)를 코드로 검증한 결과 둘은 이미 일치한다. `Rail.tsx:62` 의 버튼은 "floating" 이 아니라 flex column 내 일반 버튼으로 `position: static`, transform 없음(`:active` scale 만), `aria-label="빠른 메모"` 명시. 부모 `.rail` 도 `overflow`/`transform` 없음.
  - `elementHasNoFrame`/`noWindowsAvailable` 은 "키보드 경로 정상 / 마우스 사용자엔 비노출" 정황상 렌더러 결함이 아니라 Computer Use 자동화 도구 ↔ Electron 접근성 브리지의 frame 조회 한계로 판단. 추측 기반·검증 불가 변경을 피하기 위해 버튼 구조는 변경하지 않는다.
  - 한계: 런타임 Electron 접근성 트리를 직접 들여다본 검증은 아니므로, 실제 frame 누출 가능성을 100% 배제하지는 않는다. 재발 시 Electron accessibility inspector 로 실측 후 재판단.

## 비이슈로 확인한 항목

- QA 중 생성한 `QA 임시 메모`, `QA 빠른 캡처 메모`는 삭제 완료.
- 테마는 `종이`, 자동저장은 `켜기`로 복원.
- dev 서버와 Electron 프로세스는 QA 종료 후 종료했다.

## 후속 권장

1. ✅ P2 메모 연결 UI 갱신 지연 수정 — 완료 (optimistic update).
2. ✅ P2 빠른 메모 버튼 접근성 bounds 점검 — 완료. 코드 결함 아님으로 종결.
3. ✅ 수정 후 `pnpm test`(102) / `pnpm typecheck` / `pnpm build` 재실행 — 전체 PASS.
4. ⬜ 같은 수동 QA 경로로 메모 연결 재검증 — 자동화 테스트로 행위는 보호됨. 실제 Electron 창 dogfooding 은 별도 권장.
