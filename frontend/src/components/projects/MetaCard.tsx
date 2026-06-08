import type { ProjectResponse } from "@/types/api";

/**
 * MetaCard — 프로젝트 메타 표시 (US3, FR-019, contracts/screen-data-flow.md §3).
 *
 * 메타 5필드(genre/targetLength/toneNotes/synopsis/worldNotes) + 보관 상태 표시.
 * 빈 필드는 "비어 있음"으로 노출(작가가 무엇을 안 채웠는지 보이게).
 */

interface MetaCardProps {
    project: ProjectResponse;
}

export function MetaCard({ project }: MetaCardProps) {
    const rows: { label: string; value: string | null }[] = [
        { label: "장르", value: project.genre },
        { label: "목표 분량", value: project.targetLength !== null ? `${project.targetLength.toLocaleString()} 자` : null },
        { label: "톤·문체 노트", value: project.toneNotes },
        { label: "시놉시스", value: project.synopsis },
        { label: "세계관 메모", value: project.worldNotes },
    ];

    return (
        <section
            className="flex flex-col gap-5 p-6 rounded-card-project"
            style={{ backgroundColor: "var(--w-canvas)", border: "1px solid var(--w-hairline)" }}
        >
            {project.archivedAt !== null ? (
                <span
                    className="self-start text-xs px-2 py-1 rounded-button-utility font-semibold"
                    style={{ backgroundColor: "var(--w-parchment)", color: "var(--w-ink)", opacity: 0.7 }}
                >
                    보관됨
                </span>
            ) : null}
            {rows.map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                    <span style={{ color: "var(--w-ink)", opacity: 0.6, fontSize: "13px" }}>{row.label}</span>
                    {row.value !== null && row.value.length > 0 ? (
                        <span style={{ color: "var(--w-ink)", fontSize: "15px", whiteSpace: "pre-wrap" }}>
                            {row.value}
                        </span>
                    ) : (
                        <span style={{ color: "var(--w-ink)", opacity: 0.35, fontSize: "15px", fontStyle: "italic" }}>
                            비어 있음
                        </span>
                    )}
                </div>
            ))}
        </section>
    );
}
