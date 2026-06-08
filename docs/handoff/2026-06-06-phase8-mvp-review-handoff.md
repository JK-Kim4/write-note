# Desktop Phase 8 (MVP Review Gate) 진입 핸드오프

- 작성일: 2026-06-06
- 브랜치: `develop` (009 작업실 재디자인 merge 완료)
- 현재 HEAD: `e94ef6d` (Merge: 009 작업실 재디자인 US1~US6) — origin/develop 동기
- 목적: 새 세션에서 Phase 8(Desktop MVP review gate)을 바로 이어가기

## 1. 현재 상태 (어디까지 왔나)

- **Phase 7 = 009 작업실 디자인 고도화 ✅ 완료 + develop merge + push**(`e94ef6d`). 구 계획의 "Phase 7 Prototype usability pass"를 009 작업실 재디자인이 대체.
- 내용: impeccable critique(24/40) 기반 재진입 강화 재디자인. **US1~US6 전부 구현.**
  - US1 작품 벽형(마지막 문장이 카드 얼굴 + "다음 장면" 직접 입력·영속)
  - US2 서랍형 집필실(보기 팝오버로 zoom/줄노트/테마/자동저장 통합 + 재진입 한 장 = 고정→최근연결→최근캡처)
  - US3 쪽지 책상(통계·필터·"미연결" 제거), US4 잉크 한 방울 + 모달 hardening(focus trap/restore/초안)
  - US5 접근성(대비 상향 + focus ring), US6 곁쪽지 고정(`memo_projects.pinned`, 작품당 1개)
- 데이터: 스키마 **v5**(`projects.next_scene` + `memo_projects.pinned`), backend `store.listProjectCards`/`pickReentryMemo`/`memoRepository.setPin`, `lastSentence` 순수함수.
- 검증: `pnpm test` **145 GREEN** + typecheck + build. MVP dogfooding(US1·US2) 통과 + P2(보기 팝오버↔곁쪽지 서랍 stacking) 상호 배타로 fix.

## 2. 다음 = Phase 8 (MVP Review Gate)

SoT: `docs/phase/08-mvp-review/README.md`. **review 없이 새 기능 착수 금지** — 실제 사용 기록 기반 판정.

Phase 8 범위:
- MVP 성공 기준 체크리스트 작성 + 통과 판정("사용 가능한 prototype인가")
- 실제 사용 중 마찰 기록(추측 아님)
- **다음 개발 주기 1순위 결정**: 원고지 모드 vs richer memo curation(하나로 좁힘)
- WEB track 재개 조건 재판단(계속 block vs 일부 재개)
- blocker / non-blocker 이슈 분리
- 결과를 `docs/retrospectives/` 또는 별도 desktop review 문서에 기록

## 3. Phase 8 진입 전 선행 — 009 Polish 잔여 (실환경 dogfooding)

Phase 8은 "실제 사용 기록"이 입력이다. 그런데 009 dogfooding은 **MVP(US1·US2)만 통과**했고 나머지는 미검증([[vault 03-ISSUES]] ISSUE-020). **Phase 8 판정 전에 이 실사용 기록 수집이 필요.**

⚠️ **환경 제약**: 이전 세션의 Claude 환경은 **headless(디스플레이 없음)** 라 Electron 창·screencapture·Computer Use 가 불가였다. 새 세션도 같으면 **시각/IME dogfooding 은 사용자 실환경(`cd desktop && pnpm dev`) 몫**이다. 동작은 145 자동화 테스트로 보호됨.

미검증 잔여(ISSUE-020 + 확장):
- US3 쪽지 책상 / US4 잉크 한 방울·모달 / US5 접근성 / US6 고정 토글·재진입 우선 — dogfooding 미수행
- 한국어 IME 4케이스(빠른타자/한자변환/Backspace 자모삭제) — 실제 키보드 필요
- 빈 본문 작품의 "아직 첫 문장을 기다리는 중" 빈 문구 — fixture 부재(컴포넌트 단위 테스트로 자동 보호 가능, 미작성)
- 대비 WCAG 정밀 측정 — OKLCH L값 추정 상향만 적용
- `impeccable critique desktop app` 재실행 — SC-007(P1 0건 + 24/40 초과) 확인

**dogfooding 가이드**: `docs/qa/2026-06-06-009-mvp-dogfooding.md`(MVP 결과 + 후속조치). US3~US6 가이드는 그 형식 확장.

## 4. 새 세션에서 바로 할 일

1. vault `02-PROGRESS.md`(Phase 7=009 merge 완료) + `03-ISSUES.md`(ISSUE-020) 먼저 Read — 진척·이슈 SoT.
2. 환경 확인: headless 여부(`screencapture` 가능한지) → headless면 시각/IME는 사용자 분업 합의.
3. **선행**: 009 Polish — 사용자에게 US3~US6 dogfooding 가이드 제시(있으면 받기). 빈 작품 빈 문구는 `ProjectWallCard`/`ReentryCard` 단위 테스트로 자동 보호 가능(미작성, 착수 후보).
4. 실사용 기록이 모이면 **Phase 8 진입**: `docs/phase/08-mvp-review/README.md` 작업 지침대로 성공기준 체크 → 마찰 기록 → 다음 1순위(원고지 vs memo curation) → WEB 재판단 → blocker 분리 → review 문서.

## 5. 환경 / 주의

- **Node 24 필수**(node:sqlite): test/build 는 `export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH"` 선행, `cd desktop`. 빌드/테스트 포어그라운드.
- 검증 게이트: `pnpm test`(145) / `pnpm typecheck` / `pnpm build`.
- 외부 SoT(HARD-GATE): 진척·이슈 답변 전 vault `~/obsidian/write-note/02-PROGRESS.md`·`03-ISSUES.md` Read. Phase 완료/merge 직후 vault 갱신 의무.

## 6. 참조 (SoT 위치)

- 진척(브랜치 무관): vault `~/obsidian/write-note/02-PROGRESS.md`
- 이슈: vault `~/obsidian/write-note/03-ISSUES.md`(ISSUE-020)
- 009 상세: `specs/009-workshop-redesign/`(spec/plan/research/data-model/contracts/tasks) + design doc `docs/superpowers/specs/2026-06-06-desktop-workshop-redesign-design.ko.md`
- 회고: `docs/retrospectives/2026-06-06-009-workshop-redesign.md`
- dogfooding: `docs/qa/2026-06-06-009-mvp-dogfooding.md`
- Phase 8 지침: `docs/phase/08-mvp-review/README.md`

## 7. 룰 갱신 후보 (사용자 컨펌 대기 — 회고 §5-2)

다음 세션에서 사용자 컨펌 시 반영:
1. `agent-workflow-discipline.md` — 화면 표시값의 출처(저장 입력 vs 파생 표시, 어떤 IPC/필드)를 spec/plan에 명시 (009 "다음 장면" R1 뒤집기 + `listProjectCards` 구현 중 신설 근거).
2. `CLAUDE.md`/`agent-workflow-discipline.md` — GUI 검증 필요 작업은 착수 시 headless 여부 확인 + dogfooding 분업 합의 (009 headless 한계 근거).

## 8. 정리 안 한 잔존 (다음 세션 판단)

- `009-workshop-redesign` 브랜치(로컬+원격) — merge 후 미삭제. 삭제: `git branch -d 009-workshop-redesign && git push origin --delete 009-workshop-redesign`.
- `.impeccable/`(critique 산출물) — gitignore 후보(`.superpowers/`처럼).
- `docs/retrospectives/2026-06-06-phase6-memo-linking-side-panel.md` — 이전 Phase 6 회고, untracked.
