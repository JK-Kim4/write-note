# 새 세션 kickoff 프롬프트 — Phase 8 review → 다음 기능 SDD

> **용도:** 아래 코드블록을 **새 세션 첫 프롬프트로 그대로 붙여넣기**. Desktop write-note Phase 8(MVP review gate)을 마치고, 거기서 정한 다음 1순위 기능을 speckit 풀파이프(specify→plan→tasks→implement)로 구현하게 한다.
>
> **자동/수동 경계:** 흐름은 자동으로 이어지되, 프로젝트 룰상 **추측 자동결정이 금지된 3개 게이트(① 미커밋 변경 커밋 여부 ② D3 다음 1순위 ③ D4 WEB track)** 에서만 사용자 확정을 받는다. 그 외(읽기·게이트 재확인·review 문서·speckit 산출·구현·검증)는 멈추지 않고 진행.

---

```
Desktop write-note의 Phase 8(MVP review gate)을 마치고, 거기서 정한 다음 개발 1순위 기능을 speckit 풀파이프(specify→plan→tasks→implement)로 구현하는 작업을 이어간다. CLAUDE.md와 .claude/rules의 HARD-GATE를 모두 따른다(추측 금지/단정 금지, 한국어, TDD, 빌드·테스트 포어그라운드, 외부 vault SoT).

[0. 먼저 읽기 — 진입점/SoT]
- docs/phase/08-mvp-review/2026-06-06-work-order.md  (작업 지시서 = 본 작업의 진입점. Track A/B·SC 판정·D1~D4·진행현황)
- docs/qa/2026-06-06-009-us3-us6-dogfooding-result.md + docs/qa/2026-06-06-009-mvp-dogfooding.md  (실사용 기록)
- docs/qa/2026-06-06-009-contrast-measurement.md  (SC-006 대비 측정 결과)
- vault ~/obsidian/write-note/02-PROGRESS.md + 03-ISSUES.md(ISSUE-020·021)  ← 진척·이슈 답변 전 Read 의무(HARD-GATE)
- specs/009-workshop-redesign/spec.md  (SC-001~008 정의)

[1. 현재 상태 확인 — 재구현 금지]
- Track A(009 Polish fix)는 직전 세션에 이미 TDD로 구현 완료다(미커밋, working tree에 존재): QuickCapture 취소 확인 모달(confirmDiscard) / MemoInboxScreen 쪽지N장 카운터 제거 / .memo__pin 발견성(--muted) + 빈문구 단위테스트(ProjectWallCard·ReentryCard) + 대비 토큰 보정(app.css) + 룰 agent-workflow-discipline §9. 이 코드를 다시 구현하지 말 것.
- 게이트 재확인만 수행: cd desktop && export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" && node -v(v24 확인) → node_modules/.bin/vitest run(160 GREEN 기대) + node_modules/.bin/tsc --noEmit + node_modules/.bin/vite build. RED면 멈추고 보고.
- 【게이트 ①】 working tree에 미커밋 변경이 있다. speckit-git-feature가 새 브랜치를 만들기 전에 working tree를 정리해야 하므로, "직전 세션 산출물(빈문구 테스트·대비 보정·룰 §9·Track A fix)을 develop에 정리 커밋할지" 사용자에게 확인받고 진행. (커밋 메시지 끝에 Co-Authored-By 규칙 적용)

[2. Track A 잔여 확인 — 사용자 입력]
- A4(한국어 IME 4케이스, 실제 키보드)와 impeccable critique 재실행(P1 0건) 결과를 사용자에게 확인. 가이드: docs/qa/2026-06-06-009-us3-us6-dogfooding-guide.md.
- 둘 다 통과면 SC-007 + SC 8/8 마감으로 기록. 미수행이면 review에 "pending"으로 적고 차단 없이 진행.

[3. Phase 8 review 판정 — 작업 지시서 §5 Track B]
- SC-001~008 최종 체크(작업 지시서 §4 표 갱신).
- blocker / non-blocker 분리(F1~F4 + ISSUE-017~021). "사용 가능한 prototype인가" 명확 판정.
- review 문서 작성: docs/phase/08-mvp-review/ 또는 docs/retrospectives/. 근거는 실사용 기록(추측 아님).

[4. D3·D4 결정 — 사용자 확정(추측 자동결정 금지, Phase 8 README 준수)]
- 【게이트 ②】 D3 다음 1순위: "원고지 모드" vs "richer memo curation". 실사용 마찰 근거(어느 쪽 결핍이 더 컸나)를 정리해 제시하고 사용자에게 확정받는다. 절대 자동 선택하지 말 것.
- 【게이트 ③】 D4 WEB track: 계속 block vs 일부 재개. 근거 제시 후 사용자 확정(default: 계속 block).

[5. 다음 기능 SDD 풀파이프 — D3 확정 후]
- 먼저 design brief 작성: docs/superpowers/specs/<오늘날짜>-desktop-<feature>-design.ko.md. 형식은 docs/superpowers/specs/2026-06-06-desktop-workshop-redesign-design.ko.md 참고(목표/배경·근거/범위/비범위). 이게 프로젝트 SDD 진입 입력이다.
- 그 brief를 근거로 /speckit-specify → (필요시 /speckit-clarify) → /speckit-plan → /speckit-tasks → /speckit-analyze → /speckit-implement. feature 번호는 010 예상(009 다음), 브랜치는 speckit-git-feature가 부여.
- 구현 규율: TDD Red-Green-Refactor(.claude/rules), typescript/code-quality(RSC 경계·IME 회귀 cadence·any 금지 등). Desktop은 backend 없음 — node:sqlite(Node 24 내장) + Electron(electron/ main·preload·db) + renderer(src/). 변경 화면이면 SC-006 대비를 OKLCH→대비비로 재측정(이전 세션 docs/qa/2026-06-06-009-contrast-measurement.md 방식).
- 게이트: cd desktop, Node24 PATH 선행, 포어그라운드, node_modules/.bin/{vitest,tsc,vite} 직접 실행(corepack pnpm lockfile 충돌 회피).

[6. 마감]
- vault 02-PROGRESS.md(Phase 8 완료 + 010 진척) / 03-ISSUES.md 갱신. Phase 완료/merge 직후 vault 갱신은 HARD-GATE.
- 작업 단위 종료 시 retrospective 스킬로 5축 회고 제안.

[환경/주의 — HARD-GATE]
- Node 24 필수(node:sqlite): 셸 기본이 v20이면 export PATH="$HOME/.nvm/versions/node/v24.14.0/bin:$PATH" 선행. cd desktop. 빌드/테스트는 run_in_background=false(포어그라운드).
- 외부 DB/redis 쓰기·.env Read·시크릿 echo 금지(.claude/rules/infra/external-infra-safety.md). Desktop은 로컬 sqlite라 해당 적을 수 있으나 룰 준수.
- 모호하면 코드를 직접 읽어 확인하거나 사용자에게 질문. D3·D4·커밋은 사용자 결정 영역.

먼저 [0]을 읽고, [1] 게이트 재확인 결과 + 【게이트 ①】 커밋 여부 질문부터 보고하라.
```

---

## 사용 메모

- **3개 멈춤 게이트**: ① 미커밋 커밋 여부 → ② D3 다음 1순위 → ③ D4 WEB. 이 셋만 사용자 확정이 필요하고, 나머지는 자동 진행한다.
- D3는 Phase 8 review 근거가 모인 **뒤** 묻게 설계했다(실사용 기록 없이 추측으로 먼저 고르면 Phase 8 원칙 위반).
- 직전 세션 변경이 미커밋이라, 새 세션은 working tree에서 Track A 코드를 그대로 본다 → "재구현 금지"를 [1]에 명시했다.
