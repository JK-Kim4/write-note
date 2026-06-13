"use client";
import { goalProgress } from "@/lib/goalGauge";

export function GoalGauge({ wordCount, targetLength }: { wordCount: number; targetLength: number | null }) {
    const p = goalProgress(wordCount, targetLength);
    if (p === null) return null;
    return (
        <div
            role="progressbar"
            aria-valuenow={Math.min(100, p.percent)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-gray-200"
        >
            <span className="block h-full bg-indigo-600" style={{ width: `${p.ratio * 100}%` }} />
        </div>
    );
}
