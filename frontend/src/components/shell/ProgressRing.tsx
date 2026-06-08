/**
 * ProgressRing — 분량 진행 ring (작성 / 홈 프로젝트 카드 공용).
 *
 * Spec reference: contracts/route-surfaces.md §2-2 + DESIGN.md §분량 카운터
 * 본 spec 단계는 정적 시각 골격. 실제 분량 카운팅은 Week 3 영역.
 */

interface ProgressRingProps {
    value?: number; // 0..1
    size?: number; // px
    label?: string;
}

export function ProgressRing({ value = 0, size = 36, label }: ProgressRingProps) {
    const stroke = 3;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const clamped = Math.max(0, Math.min(1, value));
    const offset = circumference * (1 - clamped);

    return (
        <div className="inline-flex items-center gap-2">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--w-hairline)"
                    strokeWidth={stroke}
                />
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="var(--w-accent)"
                    strokeWidth={stroke}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                />
            </svg>
            {label ? (
                <span style={{ fontSize: "13px", color: "var(--w-ink)", opacity: 0.7 }}>
                    {label}
                </span>
            ) : null}
        </div>
    );
}
