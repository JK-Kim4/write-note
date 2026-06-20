---
name: finish-work
description: 한 작업 단위(라운드·기능·버그픽스)가 GREEN 상태로 끝났을 때 통합·정리 마무리를 일괄 수행한다. ① 작업 브랜치를 develop 에 merge(--no-ff) + push + 머지된 브랜치 정리 ② sync-vault 스킬로 옵시디언 vault(02-PROGRESS·03-ISSUES) 갱신 ③ 관련 GitHub 이슈 일괄 갱신(완료 이슈 close + 완료 코멘트 + 마일스톤 진행률 확인). 사용자가 "작업 마무리", "마무리 작업 해줘", "끝내고 정리해", "merge하고 정리", "/finish-work" 라고 하거나 라운드/기능 구현이 게이트 GREEN 으로 끝난 직후 proactively suggest. **회고(retrospective) 와 구분** — 본 스킬은 통합·트래커 갱신 *메커니즘*이고, retrospective 는 5축 회고 *문서 작성*이다. 둘은 함께 쓸 수 있다(마무리 후 회고 제안). 출력 언어는 한국어(코드/명령어/고유명사 제외).
---

# 작업 마무리 (finish-work)

한 작업 단위가 끝났을 때 흩어진 마무리 작업(merge·push·vault·이슈)을 한 흐름으로 묶어 빠뜨림 없이 처리한다. 마무리는 작아 보이지만 누락되면 (a) 진척이 vault 에 안 박혀 다음 세션이 stale 한 정보로 진입하고 (b) 닫아야 할 이슈가 열린 채 남아 트래커가 현실과 어긋난다.

## 왜 이 스킬이 필요한가

마무리는 **여러 SoT 를 동시에 정합**시키는 일이다 — git(develop) / vault(브랜치 무관 진척) / GitHub 이슈(트래커). 하나만 갱신하고 나머지를 잊으면 SoT 들이 서로 모순된다. 본 스킬은 세 곳을 한 번에 정합시키는 절차를 고정해, 사람이 매번 순서를 기억하지 않게 한다.

본 repo `CLAUDE.md` §"외부 SoT — 옵시디언 vault (HARD-GATE)" + §"Claude 참조·갱신 의무"(Phase 완료 / PR merge 직후 vault 갱신 의무)와 정합한다.

## 전제조건 (HARD-GATE — 미충족 시 중단)

마무리는 **검증된 작업만** 통합한다. 진입 전 다음을 확인하고, 하나라도 아니면 멈추고 사용자에게 보고한다.

1. **게이트 GREEN** — 해당 작업의 전체 게이트가 통과했는가. (프론트 `pnpm typecheck && pnpm lint && pnpm test && pnpm build` / 백엔드 `./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`). RED 인 채 merge 금지.
2. **변경 커밋 완료** — 작업 브랜치에 미커밋 변경(`git status --short`)이 없는가.
3. **merge 대상 확인** — 사용자가 develop 직접 merge 를 원하는지, PR 을 원하는지 확정됐는가. (기본 default = 본 스킬은 develop 직접 merge. PR 원하면 §대안 참조)

추측 금지 — 게이트 미실행 상태면 "곧 통과하겠지"로 진행하지 말고 게이트를 먼저 돌린다.

## 절차

### 1. develop 직접 merge + push + 브랜치 정리

프로젝트 관례 = 머지 커밋 보존(`--no-ff`)으로 작업 단위를 한 덩어리로 남긴다.

```bash
cd <repo-root>
BRANCH=$(git rev-parse --abbrev-ref HEAD)   # 현재 작업 브랜치
git checkout develop
git merge --no-ff "$BRANCH" -m "merge: $BRANCH → develop — <한 줄 요약(무엇·관련 이슈 #N)>"
git push origin develop
git branch -d "$BRANCH"                       # 머지된 로컬 브랜치 정리(미머지면 -d 가 거부 → 안전)
```

- 머지 메시지 = 작업 요약 + 관련 이슈 번호(예: `#34~57`). 단순 브랜치명 나열 X.
- `git push origin develop` 직후 PostToolUse hook(`Bash(git push *)` matcher)이 다음 turn 에 sync-vault 신호를 주입할 수 있다 — 그래도 본 스킬은 2단계에서 sync-vault 를 **명시 실행**한다(중복 무해, 결정적 실행 보장).
- **주의:** develop 은 default 브랜치(main)가 아니므로 커밋 메시지의 `Closes #N` 이 **자동 발동하지 않는다**. 이슈 종료는 3단계에서 `gh` 로 명시 처리한다.

### 2. vault 갱신 — sync-vault 스킬 호출

`Skill` 도구로 **sync-vault** 를 호출한다. 인자에 본 작업의 핵심(브랜치·merge 커밋·완료 항목·해결 이슈·다음 진입점)을 요약해 넘긴다. sync-vault 가 `02-PROGRESS.md`(진척) + `03-ISSUES.md`(이슈 상태) 를 갱신한다.

본 스킬에서 직접 vault 파일을 편집하지 말고 sync-vault 에 위임한다 — vault 갱신 규율(요약·링크·한국어·SoT 우선)은 sync-vault 가 SoT.

### 3. 관련 GitHub 이슈 일괄 갱신

완료된 이슈를 완료 코멘트와 함께 닫고, 마일스톤 진행률을 확인한다.

**gh 인증 경합 주의:** 본 환경은 `gh` 에 계정 2개가 붙어 간헐 `HTTP 401`(GraphQL/REST)을 낸다. 반드시 **`-R <owner>/<repo>` 명시 + 재시도**로 감싼다. `gh issue list/create` 보다 `gh api` 경로가 더 안정적이었다.

```bash
R="<owner>/<repo>"   # 예: JK-Kim4/write-note
close_done() {
  local num="$1" note="$2"
  for a in 1 2 3 4 5; do
    gh api -X POST "repos/$R/issues/$num/comments" -f body="✅ 완료 — $note" >/dev/null 2>&1 && \
    gh api -X PATCH "repos/$R/issues/$num" -f state="closed" -f state_reason="completed" \
      --jq '"closed #\(.number) \(.title)"' 2>/dev/null && return 0
    sleep 2
  done
  echo "FAILED close #$num — 수동 확인 필요"
}
# 완료 이슈마다 호출 — 커밋 해시·게이트 결과를 note 에 박는다.
close_done <issue#> "<커밋 해시> <한 줄 요약>. 게이트 GREEN."

# 마일스톤 진행률 확인(직접 카운트가 라벨 검색보다 정확 — 검색 인덱스 지연)
gh api "repos/$R/milestones/<n>" --jq '"\(.title) — 열림 \(.open_issues)/닫힘 \(.closed_issues)"'
```

- **이미 닫은 이슈를 다시 닫지 않는다** — 닫기 전 상태 확인. 본 작업과 무관한 이슈는 건드리지 않는다(컨펌 받은 범위만).
- vault `03-ISSUES.md` 의 해당 이슈 상태(✅ 해결)는 2단계 sync-vault 가 반영한다 — GitHub 와 vault 양쪽 정합.

## self-check (마무리 완료 전)

- [ ] develop 이 origin 과 동기인가 (`git log origin/develop -1`)
- [ ] vault `02-PROGRESS.md` §현재 진입점 / `03-ISSUES.md` 가 본 작업 반영했는가
- [ ] 완료 이슈가 GitHub 에서 closed, 마일스톤 진행률이 현실과 일치하는가
- [ ] gh 401 로 실패해 "수동 확인 필요"로 남은 이슈가 없는가

## 대안 / 분기

- **PR 경로(직접 merge 대신):** 사용자가 리뷰/CI 를 원하면 `gh pr create -R "$R" --base develop --head "$BRANCH" --title ... --body "...Closes #N..."`. 이 경우 develop merge·브랜치 정리는 PR 머지 후로 미룬다.
- **회고 제안:** 큰 작업 단위(라운드 완료·다중 라운드 구현·디버깅 사이클)면 마무리 후 **retrospective 스킬**을 proactively 제안한다. 본 스킬(통합 메커니즘)과 회고(5축 문서)는 별개 산출물이다.

## 금지

- 게이트 RED / 미커밋 상태에서 merge — 전제조건 위반
- vault 직접 편집(sync-vault 위임 대상) / 영어 박음 / 민감 정보(credential·`.env`) 박음
- 컨펌 범위 밖 이슈 종료 — "닫는 김에 비슷한 것도" 금지
- `gh` 401 을 무시하고 "닫혔겠지" 추측 — 재시도 + 진행률 확인으로 실제 종료 검증

## 인접 룰 / 출처

- 본 repo `CLAUDE.md` §"외부 SoT — 옵시디언 vault (HARD-GATE)" / §"Claude 참조·갱신 의무"
- 본 repo `.claude/skills/sync-vault/SKILL.md` (2단계 위임 대상)
- 본 repo `.claude/skills/retrospective/SKILL.md` (마무리 후 제안)
- 본 repo `.claude/settings.json` `hooks.PostToolUse` (`git push` → sync-vault 신호)
