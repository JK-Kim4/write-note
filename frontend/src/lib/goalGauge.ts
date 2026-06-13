export type GoalProgress = { ratio: number; percent: number };

/** 목표 분량(자) 대비 글자수 달성. targetLength 미설정(null/0)이면 null = 게이지 숨김(opt-in). */
export function goalProgress(wordCount: number, targetLength: number | null): GoalProgress | null {
    if (targetLength === null || targetLength <= 0) return null;
    const percent = Math.round((wordCount / targetLength) * 100);
    return { ratio: Math.min(1, wordCount / targetLength), percent };
}
