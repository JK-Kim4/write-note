---
name: sync-vault
description: 브랜치 작업 내용을 정리해 옵시디언 vault (`~/obsidian/write-note/02-PROGRESS.md` + `03-ISSUES.md`) 를 갱신한다. 트리거 — 사용자가 "vault 갱신해", "옵시디언 정리", "/sync-vault" 라고 발언하거나, PostToolUse hook 의 additionalContext 에 "sync-vault skill 실행" 신호가 박힐 때 proactively 활성. git log + 본 repo `docs/plan/02-progress.md` 를 읽고 phase 단위 진척 / 다음 진입점 / 이슈 발견을 vault 노트에 박는다. 단순 commit 메시지 카피 X — 한국어로 정리 (코드/명령어/고유명사 제외).
---

# 옵시디언 vault 동기 (sync-vault)

브랜치 작업 진척과 발견된 이슈를 옵시디언 vault 에 박는다. vault 는 브랜치 무관 SoT — 다음 세션에서 진척·이슈 답변 시 vault 가 참조 진입점.

## 왜 vault 를 갱신하는가

본 repo `AGENTS.md` §"외부 SoT — 옵시디언 vault (HARD-GATE)" SoT.

- vault = **브랜치 무관 단일 진입점** — 본 repo `docs/plan/02-progress.md` 같은 브랜치 종속 문서가 여러 워크트리에서 conflict·누락되는 문제 우회
- Phase 단위 진척·이슈는 vault 에 박혀야 다른 워크트리·다음 세션의 Codex / 사용자가 일관 참조 가능
- 본 repo SoT 가 우선이지만 vault 는 인용·요약·링크 의무

## 언제 트리거하나

### 사용자 명시 호출
- "vault 갱신해" / "옵시디언 정리" / "vault sync"
- "/sync-vault"

### Proactive 트리거 (hook 신호)
- PostToolUse hook (`.Codex/settings.json` 의 `Bash(git push *)` matcher) 가 push 직후 `additionalContext` 로 본 스킬 호출 신호 + git context 박음
- 메인 Codex 는 다음 turn 에서 본 컨텍스트 보고 본 스킬 자동 실행

### Proactive suggest (사용자 명시 없이)
- Phase 완료 / PR merge 직후
- 큰 commit (10+ 파일 변경 또는 본질 결정 박힌 commit) 직후

## 입력 컨텍스트

본 스킬 활성 시 다음을 수집:

1. **git 상태** — `Bash` 로 직접 수집 (hook 이 박은 context 가 있어도 stale 가능성)
   ```bash
   git rev-parse --abbrev-ref HEAD          # 현재 브랜치
   git log -10 --oneline                     # 최근 10 commit
   git log -1 --format=%B                    # 최신 commit 메시지
   git status --short                        # 미커밋 변경
   git log origin/main..HEAD --oneline 2>/dev/null  # main 대비 ahead commit
   ```

2. **본 repo SoT** — 브랜치 종속 진척 자료
   - `docs/plan/02-progress.md` Read — 본 repo 의 상세 진척 (vault 입력 요약 자료)
   - `specs/{현재-spec}/plan.md` Read (있으면) — Phase 단위 plan
   - `specs/{현재-spec}/tasks.md` Read (있으면) — task 진척률 확인

3. **vault 현재 상태**
   - `~/obsidian/write-note/02-PROGRESS.md` Read
   - `~/obsidian/write-note/03-ISSUES.md` Read

## 갱신 절차

### 1. `02-PROGRESS.md` 갱신

vault `02-PROGRESS.md` 는 Phase 단위 진척 SoT. 다음 영역 갱신:

| 영역 | 갱신 기준 |
|---|---|
| **§현재 진입점** | 현재 작업 중인 Phase + 진행률 (task 단위 N/M 형식). 최신 commit / branch 반영 |
| **§완료 Phase** | Phase 완료 시 추가. 완료 일자 + PR / merge commit 링크 |
| **§다음 진입점** | 본 Phase 완료 후 다음 진입할 Phase / 작업 영역 |

**원칙:**
- 단순 commit 메시지 카피 X — Phase 단위로 의미 있는 진척만 박음
- 본 repo `docs/plan/02-progress.md` 의 상세 진척을 **요약·링크**. vault 가 본 repo 의 대체 X, 보강
- 한국어 (코드/명령어/고유명사 제외)

### 2. `03-ISSUES.md` 신규 entry (해당 시)

작업 중 발견된 이슈가 있으면 신규 entry. 다음 신호 시 추가:

- 작업 중 보류한 결정 (commit 메시지에 "후속", "TODO", "별도 트랙" 등 포함)
- vault `~/obsidian/write-note/retrospectives/` 의 최신 회고 §어긋난 점 / §룰 갱신 후보
- 본 작업이 분기 시킨 다른 작업 트랙 (트랜잭션 분기 보고된 영역)

이슈 entry 양식:

```markdown
## {일자} — {이슈 제목}

- **발견 시점:** {commit hash 또는 작업 단위}
- **우선순위:** 높음 / 중간 / 낮음
- **본질:** (한 줄)
- **후속:** {언제·어떻게 처리 예정}
- **링크:** {본 repo 의 관련 spec / retrospective / commit}
```

### 3. 정합 검증

갱신 후 self-check:

- vault `02-PROGRESS.md` 의 §현재 진입점 이 본 repo 최신 commit 의 brunch / Phase 와 일치
- vault `03-ISSUES.md` 신규 entry 가 본 repo 의 retrospective / commit 메시지와 정합
- 본 repo `AGENTS.md` 의 "Codex 참조·갱신 의무" 표의 갱신 시점 정합

## 금지 사항

- **단순 git log 카피** — Phase 단위 의미 추출 의무
- **본 repo SoT 우회 신규 정보 박음** — vault 는 인용·요약·링크. 새 결정·새 본질은 본 repo (DESIGN.md / docs/plan / specs/) 가 SoT
- **영어 박음** — 한국어 (코드/명령어/고유명사 제외)
- **민감 정보 박음** — commit hash / branch / file path 는 OK, credential / API key / `.env` 내용 X
- **다른 브랜치 작업 상태 추측 박음** — 본 작업 브랜치 한정 정보만

## 출력

작업 완료 후 한 줄 보고:

```
vault 갱신 완료 — 02-PROGRESS.md §{갱신 영역} + 03-ISSUES.md {신규 N건}
```

또는 갱신 없음 시:

```
vault 갱신 불필요 — 본 push 가 Phase 진척 신호 없음 (예: 단순 docs 수정)
```

## 인접 룰 / 출처

- 본 repo `AGENTS.md` §"외부 SoT — 옵시디언 vault (HARD-GATE)"
- 본 repo `.Codex/settings.json` `hooks.PostToolUse` (트리거)
- 본 repo `.Codex/skills/retrospective/SKILL.md` (회고 → vault 입력 흐름)
