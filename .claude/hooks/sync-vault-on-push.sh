#!/bin/bash
# PostToolUse hook — git push 직후 메인 Claude 의 다음 turn 에 sync-vault 스킬 호출 신호 주입
# 트리거: .claude/settings.json 의 PostToolUse + Bash matcher + if "Bash(git push *)"
# 스킬 본체: .claude/skills/sync-vault/SKILL.md

set -u

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
RECENT_COMMITS=$(git log -5 --oneline 2>/dev/null | head -5 || echo "no commits")
LAST_COMMIT_HASH=$(git log -1 --format=%h 2>/dev/null || echo "unknown")
LAST_COMMIT_MSG=$(git log -1 --format=%s 2>/dev/null || echo "no commit")

# additionalContext 안의 줄바꿈/특수문자 JSON-safe escape
escape_json() {
    python3 -c 'import json, sys; print(json.dumps(sys.stdin.read()))'
}

CONTEXT=$(cat <<CTX_EOF
[자동 트리거] git push 직후 sync-vault 스킬 호출 신호.

push context:
- branch: $BRANCH
- last commit: $LAST_COMMIT_HASH — $LAST_COMMIT_MSG
- recent 5 commits:
$RECENT_COMMITS

다음 작업: \`.claude/skills/sync-vault/SKILL.md\` 절차 따라 옵시디언 vault (\`~/obsidian/write-note/02-PROGRESS.md\` + \`03-ISSUES.md\`) 갱신. 진척 신호 없으면 "vault 갱신 불필요" 보고만.
CTX_EOF
)

ESCAPED=$(printf '%s' "$CONTEXT" | escape_json)

cat <<EOF
{
  "continue": true,
  "additionalContext": $ESCAPED,
  "suppressOutput": false
}
EOF

exit 0
