/**
 * SubmitLoading — submit.is-loading 상태의 16px 도넛 spinner + 라벨 변경.
 *
 * Spec reference: contracts/route-surfaces.md §1 (login-loading)
 * Source: DESIGN.md §추가된 디자인 시스템 컴포넌트 — `.panel.is-loading` 폼 전체 dim 동반.
 */

interface SubmitLoadingProps {
    label?: string;
}

export function SubmitLoading({ label = "처리 중…" }: SubmitLoadingProps) {
    return (
        <button
            type="button"
            disabled
            aria-busy="true"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-button-pill cursor-not-allowed"
            style={{
                backgroundColor: "var(--w-ink)",
                color: "var(--w-canvas)",
                opacity: 0.85,
            }}
        >
            <Spinner />
            <span>{label}</span>
        </button>
    );
}

function Spinner() {
    return (
        <span
            aria-hidden="true"
            className="inline-block animate-spin"
            style={{
                width: 16,
                height: 16,
                border: "2px solid color-mix(in srgb, var(--w-canvas) 30%, transparent)",
                borderTopColor: "var(--w-canvas)",
                borderRadius: "50%",
            }}
        />
    );
}
