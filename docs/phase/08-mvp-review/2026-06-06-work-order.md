# Desktop Phase 8 — MVP Review Gate (작업 지시서)

> **용도:** 본 문서는 Phase 8(Desktop MVP review gate)을 **실행하기 위한 작업 지시서**다. `docs/phase/08-mvp-review/README.md`(phase 정의)를 이 세션의 입력·결정·산출물로 구체화한다. 본 문서를 근거로 (선택) 선행 Polish 마감 → MVP review 판정 → 다음 1순위 결정 → review 문서를 진행한다.
>
> **메타**
> - 트랙: Desktop MVP (Electron 로컬 우선 앱). Phase 7(009 작업실 재디자인) merge 완료 직후의 **review gate**.
> - 작성일: 2026-06-06
> - 기준 브랜치: `develop` (HEAD `e94ef6d` — 009 merge, origin 동기) + 본 세션 미커밋 변경(빈문구 테스트·대비 보정·룰 §9)
> - 상위 SoT: `docs/phase/08-mvp-review/README.md`(phase 정의) · vault `02-PROGRESS.md`·`03-ISSUES.md`(진척·이슈) · `specs/009-workshop-redesign/spec.md`(SC-001~008)
> - 근거 산출물(실사용 기록): `docs/qa/2026-06-06-009-mvp-dogfooding.md`(US1·US2) · `docs/qa/2026-06-06-009-us3-us6-dogfooding-result.md`(US3~US6+IME) · `docs/qa/2026-06-06-009-contrast-measurement.md`(SC-006) · `.impeccable/critique/2026-06-06T09-08-26Z__desktop-src.md`(31/40)

---

## 1. 목표

첫 Desktop MVP가 **"사용 가능한 prototype인가"**를 실사용 기록 기반으로 판정하고, 다음 개발 주기 1순위를 하나로 좁힌다. 추측이 아니라 dogfooding·자동화·대비 측정·impeccable 재실행으로 모인 증거로 판단한다.

비목표(README §제외 준수): review 없이 새 기능 착수 / 원고지 모드 즉시 구현 / WEB track 무조건 재개 / 실사용 기록 없는 추측 우선순위.

---

## 2. 현재 입력 (이미 확보된 증거)

| 입력 | 상태 | 출처 |
|---|---|---|
| 자동화 동작 보호 | `pnpm test` **155 GREEN** + typecheck + build | 본 세션(빈문구 테스트 +10) |
| 대비 WCAG (SC-006) | **양면 AA 100%** (측정 중 미달 발견 → 토큰 보정 → 0 FAIL) | `2026-06-06-009-contrast-measurement.md` |
| US1·US2 dogfooding | 통과 (작품 벽·다음 장면 영속·서랍형·재진입 한 장) | `2026-06-06-009-mvp-dogfooding.md` |
| US3~US6 dogfooding | 대부분 통과 + 이슈 4건(아래 §3) | `2026-06-06-009-us3-us6-dogfooding-result.md` |
| impeccable 재실행 (SC-007) | **31/40, P0 0 / P1 1 / P2 3** (직전 24/40·P1 2) | `.impeccable/.../2026-06-06T09-08-26Z__desktop-src.md` |

---

## 3. 배경 — dogfooding이 남긴 것 (실사용 기록)

US3~US6 주요 흐름은 동작했다(붙이기 즉시 반영·Esc 초안 보호·고정/해제·촛불 가독성·포커스 트랩 통과). 다만 4건이 남았다.

| # | 화면 | 무엇이 | 위반 기준 | 우선 | 코드 위치 |
|---|---|---|---|---|---|
| F1 | 빠른 메모 | `취소` 버튼이 초안 있어도 확인 없이 닫혀 **초안 소실** | FR-017 / SC-005 | **P1** | `QuickCapture.tsx:113`(`onClick={onClose}`) |
| F2 | 쪽지 책상 | 상단 `쪽지 N장` **카운터 문구** 잔존 → "관리 도구" 톤 회귀 | FR-012 / SC-003 | P2 | `MemoInboxScreen.tsx:127·131`(`countPhrase`/`memo-deck__count`) |
| F3 | 곁쪽지 서랍 | 고정(★) 버튼이 hover/focus 전 시각 신호 약해 **발견성 낮음** | FR-024 | P2 | `MemoPanel.tsx`(`.memo__pin` ☆) |
| F4 | 집필 본문 | 한국어 IME 4케이스 **자동화 미검증**(실제 키보드 필요) | typescript code-quality 회귀 cadence | P2 | — (검증 행위, 코드 아님) |

---

## 4. SC 8개 현재 판정 (009 spec 성공 기준)

| SC | 내용 | 현재 | 근거 |
|---|---|---|---|
| SC-001 | 작품 카드만으로 마지막 내용 재구성(날짜·카운터 없이) | ✅ | US1 dogfooding |
| SC-002 | 집필 진입 상시 조작 ≤1(접힌 보기 메뉴) | ✅ | MVP dogfooding |
| SC-003 | 메모 화면 통계 패널·세그먼트 필터 없음 | ⚠️ **부분** | 필터는 없으나 `쪽지 N장` 잔존(F2) |
| SC-004 | 붙이기 1초 내 반영 | ✅ | US3 dogfooding |
| SC-005 | 캡처 모달 초안 유실 X + 포커스 복귀 | ⚠️ **부분** | Esc/backdrop·복귀 통과, 취소 실패(F1) |
| SC-006 | 대비 양면 AA 100% | ✅ | 정밀 측정 보정 후 0 FAIL |
| SC-007 | impeccable P1 0건 + 24/40 초과 | ⚠️ **부분** | 31>24 충족, **P1=1 미충족**(F1) |
| SC-008 | 고정 재진입 표시(+해제 fallback) | ✅ | US6 dogfooding |

**관찰:** 미충족 3건(SC-003·005·007)이 전부 **F1·F2** 두 fix로 닫힌다 — F1(취소 초안) 해소 시 SC-005 충족 + impeccable P1→0으로 SC-007 충족, F2(쪽지 N장) 제거 시 SC-003 충족. F3는 hard SC blocker는 아니나 impeccable 점수·발견성 개선. → **작은 마감으로 5/8 → 8/8 도달 가능.**

---

## 5. 작업 트랙

### Track A — 009 Polish 마감 (선행 fix, 권장)

> 근거: F1은 **데이터(초안) 소실**이고 SC-005/007이 정의한 갭이다. 새 기능이 아니라 기존 FR에 대한 **defect fix**라 README §제외("새 기능 착수")에 걸리지 않는다. 범위가 작고 TDD 가능.

| 항목 | 작업 | 검증 | TDD |
|---|---|---|---|
| A1 (F1, P1) | 빠른 메모 `취소` 버튼이 초안 있을 때 **확인/보존 경로**를 타게(`requestSoftClose`와 동일 정책 또는 확인) — FR-017 충족 | QuickCapture 단위 테스트(취소+초안 시 미닫힘/확인) | RED→GREEN |
| A2 (F2, P2) | 쪽지 책상 `쪽지 N장` 카운터 제거 또는 **비카운터 작업실 톤 문구**로 교체 — SC-003 충족 | MemoInboxScreen 테스트(카운터 부재) | RED→GREEN |
| A3 (F3, P2) | 고정(★) 버튼 hover 전에도 알아볼 affordance(상시 약한 외곽선/라벨 등) — FR-024 발견성 | 시각 dogfooding 재확인(사용자) | — |
| A4 (F4, P2) | **사용자 수동 IME 4케이스**(빠른타자/조합 중 mark/한자/Backspace 자모) — 실제 키보드 | `docs/poc/0-1-tiptap-korean.md` 4케이스 | 수동 |

검증 게이트: `cd desktop && PATH=v24 선행`, `pnpm test`(155+α) / typecheck / build 포어그라운드. fix 후 **impeccable 재실행으로 P1 0건 확인**(SC-007 마감).

### Track B — Phase 8 review gate 판정 (README §작업 지침)

Track A 마감(또는 F1을 non-blocker로 분류) 후, 아래를 review 문서로 남긴다.

1. **prototype 완료 조건 체크** — §4 SC 8개 최종 판정(Track A 후 갱신).
2. **blocker / non-blocker 분리** — F1~F4 + 기존 이슈(ISSUE-017~020)를 "사용 불가 차단" vs "불편하나 사용 가능"으로 분류.
3. **다음 phase 1순위 결정(하나로)** — **원고지 모드 vs richer memo curation**. 실사용 기록(어느 마찰이 더 컸나)을 근거로 좁힘.
4. **WEB track 재판단** — 계속 block vs 일부 재개. 판단 근거 명시(`006-phase-3-4-editor-memo` develop 미merge 상태 포함).
5. **review 문서 기록** — `docs/retrospectives/` 또는 `docs/phase/08-mvp-review/`에 판정·근거.

---

## 6. 결정 포인트 (사용자 확정 필요 — 추측 진행 금지)

| ID | 결정 | 맥락 / 영향 | 확정 / default |
|---|---|---|---|
| D1 | **F1(취소) 처리 방식** — (a) 취소도 초안 보호(Esc와 동일) / (b) 취소 시 확인 모달 / (c) 취소 = 명시적 버림 유지(초안 소실 허용) | FR-017은 "보존하거나 확인". (a)·(b)는 SC-005·007 충족, (c)는 SC 미충족 유지 | ✅ **확정 (b) 취소 시 확인 모달** (2026-06-06) |
| D2 | **Track A 선행 여부** — 선행 fix 후 review / review 먼저 + F1을 non-blocker 기록 | 선행 시 SC 8/8 + impeccable P1 0으로 깨끗한 판정. 후행 시 데이터 소실 버그를 안고 "사용 가능" 판정 | ✅ **확정 선행 fix(Track A)** (2026-06-06) |
| D3 | **다음 1순위** — 원고지 모드 vs richer memo curation | Phase 8 핵심 산출. 실사용 마찰 근거로 결정(추측 금지) | ⬜ 미정 — review에서 근거 모은 뒤 사용자 확정 |
| D4 | **WEB track** — 계속 block / 일부 재개 | `006` develop 미merge. Desktop MVP 집중 중 | ⬜ 미정 (default 계속 block) |

---

## 7. 산출물 / 완료 기준

- (Track A 선택 시) A1·A2(+A3) fix + 테스트 + impeccable 재실행 P1 0건 → SC 8/8.
- **사용 가능한 prototype 여부 명확 판정**(README 완료 기준).
- **다음 phase 1순위가 문서로 남음**(D3 확정).
- **이슈 blocker/non-blocker 분리**가 실사용 기록 기반으로 정리(추측 아님).
- review 문서 + vault `02-PROGRESS.md`(Phase 8 완료) / `03-ISSUES.md`(F1~F4 entry) 갱신.

---

## 8. 진입 순서 (제안)

1. **D1·D2 확정** (사용자) → Track A 범위 잠금.
2. Track A 실행(TDD) → 게이트 GREEN → impeccable 재실행으로 SC-007 마감.
3. Track B 판정 → D3·D4 근거 정리 → 사용자 확정.
4. review 문서 + vault 갱신 → (권장) `develop` 커밋: 본 세션 변경(빈문구 테스트·대비 보정·룰 §9) + Track A fix를 묶어 정리.

---

## 9. 진행 현황 (2026-06-06)

| 항목 | 상태 | 비고 |
|---|---|---|
| A1 (F1 취소 확인 모달) | ✅ 코드 완료 | `QuickCapture.tsx` `confirmDiscard` 단계(취소+초안→"버릴까요?"·계속 쓰기/버리기). TDD +4 → **SC-005 충족** |
| A2 (F2 쪽지 N장 제거) | ✅ 코드 완료 | `MemoInboxScreen` `countPhrase` 제거 + orphan CSS(`memo-deck__count`) 삭제. TDD +1 → **SC-003 충족** |
| A3 (F3 고정 발견성) | ✅ 코드 완료(시각 재확인 대기) | `.memo__pin` rest `opacity:0`(투명) → `color:--muted`(상시 보임, AA 4.69/5.82). 사용자 dogfooding 재확인 |
| A4 (F4 IME 4케이스) | ⬜ 사용자 수동 | 실제 키보드 — `docs/qa/...us3-us6-dogfooding-guide.md` IME 표 |
| SC-007 impeccable 재실행 | ⬜ 사용자 실환경 | P1 원인(취소 초안)을 코드로 해소 → 재실행 시 P1 0건 예상. **재실행 확인은 사용자 live env** |
| 게이트 | ✅ | `pnpm test` **160 GREEN**(155→160) + typecheck + build. SC-006 재측정 0 FAIL 유지(pin·confirm 포함) |

**다음:** A4(수동 IME) + impeccable 재실행으로 SC-007 P1 0건 확인 → SC 8/8 마감 → **Track B(D3 다음 1순위 / D4 WEB) 판정 → review 문서**.
