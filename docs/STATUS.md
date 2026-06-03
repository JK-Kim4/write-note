# 프로젝트 상태 — Active Track

**최종 갱신:** 2026-06-03

> 이 문서는 repository를 처음 보는 사람이 "지금 무엇이 active track인지" 한 번에 알 수 있게 하는 단일 진입점이다.

## 현재 active track: Desktop MVP

지금부터의 우선 작업은 **새 Electron 데스크탑 MVP**다. 기존 WEB(`frontend/` + `backend/`)
개발은 **일시 중단(paused)** 상태이며, 코드는 삭제·이동 없이 그대로 보존된다.

| 트랙 | 상태 | 위치 |
|---|---|---|
| **Desktop MVP** | 🟢 **ACTIVE** | `desktop/` (Electron scaffold 완료 — Phase 1) |
| WEB frontend | ⏸️ paused | `frontend/` (보존, 기능 수정 안 함) |
| WEB backend | ⏸️ paused | `backend/` (보존, 기능 수정 안 함) |

## 기준 문서 (Desktop MVP)

| 문서 | 내용 |
|---|---|
| [전략 PRODUCT.md](../PRODUCT.md) | 누가/무엇을/왜 (register=product) |
| [비주얼 DESIGN.md](./DESIGN.md) | 색·타이포·컴포넌트 SoT (활성). ⚠️ 루트 DESIGN.md는 web-legacy |
| [설계 (영문)](./superpowers/specs/2026-05-31-desktop-mvp-design.md) | Desktop MVP 설계 원문 |
| [설계 (한글)](./superpowers/specs/2026-05-31-desktop-mvp-design.ko.md) | 설계 한글본 |
| [Phase 계획](./superpowers/plans/2026-05-31-desktop-mvp-phases.md) | Phase 0~8 분해 + 검증·커밋 기준 |
| [Phase 추적 index](./phase/README.md) | Phase 별 작업 지침 모음 |

## Phase 진행 현황

| Phase | 목표 | 상태 |
|---|---|---|
| 0 | WEB 일시 중단 선언 + Desktop 트랙 기준선 | ✅ 완료 |
| 0.5 | 디자인 정의 — PRODUCT.md/DESIGN.md + 4화면 + 페이지뷰 | ✅ 완료 (2026-06-03 승인) |
| 1 | Electron/Vite desktop app scaffold | ✅ **완료** (2026-06-03) — `desktop/` 에 Electron shell(main/preload + BrowserWindow + dev/prod 로드). 자동화 GREEN(typecheck/build/test/dev 기동), **PR #27** 리뷰 중, 육안 dogfooding 대기 |
| 2 | 로컬 persistence (Project/Document/Memo) | 🟡 **다음 진입점** — better-sqlite3 + main-process DB 경계 + renderer IPC. 배포 패키징(@electron/rebuild·asarUnpack 등 네이티브 모듈 호환)도 본 phase 범위 |
| 3 | Projects workspace | ⬜ 대기 |
| 4 | Write Studio + 일반 에디터 autosave | ⬜ 대기 |
| 5 | Quick memo capture + inbox | ⬜ 대기 |
| 6 | 메모-프로젝트 연결 + studio side panel | ⬜ 대기 |
| 7 | Prototype usability pass | ⬜ 대기 |
| 8 | Desktop MVP review gate | ⬜ 대기 |

> Phase 7까지 완료되면 "사용 가능한 데스크탑 프로토타입"으로 판정한다. Phase 8은 의사결정 gate다.

## WEB 트랙 재개 조건

WEB 재개 여부는 Desktop MVP Phase 8(review gate)에서 다시 판단한다.
그 전까지 `frontend/`·`backend/`·`specs/00x-*`는 기능 수정하지 않는다.

## 보존된 WEB 트랙 진척 (참고)

WEB 트랙의 Phase 단위 진척은 그대로 유효하다. 상세는 다음을 참조한다.

- 본 repo: [`docs/plan/`](./plan/README.md) (paused)
- 외부 vault: `~/obsidian/write-note/02-PROGRESS.md` (Phase 단위 요약)
