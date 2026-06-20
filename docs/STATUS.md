# 프로젝트 상태 — Active Track

**최종 갱신:** 2026-06-08 — **소설비 브랜드 디자인 결정본 확정 + 적용**(이름·펜촉+날개 로고·평평한 양피지·한글 개행 교정) + **집필 가드 버그픽스**(작품 미선택 시 빈 상태). develop merge `5f22b04`.

> 이 문서는 repository를 처음 보는 사람이 "지금 무엇이 active track인지" 한 번에 알 수 있게 하는 단일 진입점이다.

## 현재 active track: Desktop MVP

지금부터의 우선 작업은 **새 Electron 데스크탑 MVP**다. 기존 WEB(`frontend/` + `backend/`)
개발은 **일시 중단(paused)** 상태이며, 코드는 삭제·이동 없이 그대로 보존된다.

| 트랙 | 상태 | 위치 |
|---|---|---|
| **Desktop MVP** | 🟢 **ACTIVE** | `desktop/` (브랜드 = **소설비**(평평한 양피지·펜촉+날개 로고). Phase 10 진짜 페이지 분할 구현 완료 — CSS `column-wrap` 실시간 분할, 한글 IME 4케이스 통과) |
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
| 2 | 로컬 persistence (Project/Document/Memo) | ✅ **완료** (2026-06-03, PR #28) — **`node:sqlite`**(Node 24 내장, better-sqlite3 대체로 네이티브 모듈 함정 제거) + 4테이블 + repository/Store + IPC 경계. TDD 24 tests, dev 실측 `.db`+WAL 생성. renderer DB 직접접근 차단 |
| 3 | Projects workspace | ✅ **완료** (2026-06-04, merge `5aab0fe`) — renderer 실데이터 결선(`window.electronAPI.projects.list/create`) + 작품 화면 3상태 craft + genre 확장(schema v1→v2) + preload 회귀 수정(sandbox:true). TDD 44 tests + build GREEN |
| 4 | Write Studio + 일반 에디터 autosave | ✅ **완료** (2026-06-04, develop merge `ee503ab`) — TipTap 본문 결선 + debounce autosave + **자동저장 on/off**(off 시 ⌘S·저장 버튼 수동 저장, app_settings 영속) + **줄노트 토글** + **IME 조합 guard**(composing 중 부모 갱신 skip) + 본문 재진입 반영(editorKey remount). **추가**: 작품 삭제(FK cascade) + Dock→설정 패널 전환 |
| 5 | Quick memo capture + inbox | ✅ **완료** (2026-06-05, merge `386aac1`) — quick capture(모달+인라인) + inbox(전체/미연결 필터) + soft delete·되돌리기 토스트 |
| 6 | 메모-프로젝트 연결 + studio side panel | ✅ **완료** (2026-06-06, merge `aad06d7` + fix `ee19683`) — 메모↔작품 **다대다 연결**(연결 테이블 `memo_projects`, 스키마 v4) + Inbox 연결 버튼·체크리스트 팝오버·칩 복수/✕ + 집필 사이드 패널 실데이터·패널 내 해제. TDD vitest 100 GREEN. **dogfooding 통과** |
| 7 | 작업실 재디자인 (009) | ✅ **완료** (2026-06-06, merge `e94ef6d`) — 작품 벽·서랍형 집필실·쪽지 책상. "사용 가능한 프로토타입" 도달 |
| 8 | Desktop MVP review gate | ✅ **완료** (2026-06-06, `9579f78`) — 판정 YES, blocker 0, SC 8/8, 한글 IME 4케이스 통과 |
| 9 | 원고지 모드 (010) | ❌ **폐기** — PoC RED(라이브 칸 CSS `text-transform`가 한글 자모 분해) → 줄노트로 피벗 |
| 9' | 줄노트 집필 개선 | ✅ **완료** (2026-06-07, `968b0e0`) — 줄노트 default ON·줄선 미리 그림·문단 간격 0·하단 쪽번호 |
| 10 | 진짜 페이지 분할 | ✅ **구현 완료** (2026-06-07, `feat/page-split-editor`) — **CSS `column-wrap`** 로 A4 장 단위 실시간 분할(낱장 종이·상하 패딩·장별 쪽번호·노트식 빈 줄 클릭·줄노트 토글=줄선만). 저장구조 불변. vitest 179+tsc+build GREEN. **한글 IME 4케이스 통과**. PoC=`docs/poc/0-4-page-split-poc-plan.md` |

> Desktop MVP는 Phase 8(review gate)에서 "사용 가능한 프로토타입 = YES" 판정. Phase 10(진짜 페이지 분할)까지 구현 완료. **다음 = develop merge 후 후속(쪽 네비게이션·메모↔본문 위치 앵커) 또는 WEB 재개 검토.** 굵게 토글-IME papercut은 별도 이슈([[03-ISSUES]]) 후속.

## WEB 트랙 재개 조건

WEB 재개 여부는 Desktop MVP Phase 8(review gate)에서 다시 판단한다.
그 전까지 `frontend/`·`backend/`·`specs/00x-*`는 기능 수정하지 않는다.

## 보존된 WEB 트랙 진척 (참고)

WEB 트랙의 Phase 단위 진척은 그대로 유효하다. 상세는 다음을 참조한다.

- 본 repo: [`docs/plan/`](./plan/README.md) (paused)
- 외부 vault: `~/obsidian/write-note/02-PROGRESS.md` (Phase 단위 요약)
