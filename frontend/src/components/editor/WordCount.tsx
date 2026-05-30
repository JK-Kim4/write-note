/**
 * 자수 카운터 + 진행률 ring (006 T018).
 *
 * - wordCount: 서버 저장 응답 syncedWordCount 권위 값
 * - targetLength: 프로젝트 목표 분량 (null 이면 ring 0)
 * - ProgressRing 재사용
 */

import { ProgressRing } from "@/components/shell/ProgressRing";
import { calcProgress } from "./wordCountUtils";

interface WordCountProps {
    wordCount: number;
    targetLength: number | null;
}

export function WordCount({ wordCount, targetLength }: WordCountProps) {
    const progress = targetLength != null && targetLength > 0 ? calcProgress(wordCount, targetLength) : 0;
    const label =
        targetLength != null && targetLength > 0
            ? `${wordCount.toLocaleString()} / ${targetLength.toLocaleString()} 자`
            : `${wordCount.toLocaleString()} 자`;

    return <ProgressRing value={progress} label={label} />;
}
