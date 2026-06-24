/**
 * 마이페이지 계정 정보(읽기 전용) — 이메일·가입 방식·가입일 (036 US3).
 *
 * 가입 방식은 `kakaoLinked` 기준 근사 표기(이메일 가입 후 카카오 연결 시 "카카오"로 보일 수 있음 — v1 허용).
 * 모든 값은 `["auth","me"]` 응답에서 옴(신규 조회 없음).
 */
function formatJoinedDate(createdAt: string | null): string {
    if (!createdAt) return "—";
    const date = new Date(createdAt);
    if (Number.isNaN(date.getTime())) return "—";
    return new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function AccountInfoSection({
    email,
    kakaoLinked,
    createdAt,
}: {
    email: string;
    kakaoLinked: boolean;
    createdAt: string | null;
}) {
    return (
        <section className="mt-4 rounded-xl border border-border bg-surface p-5">
            <h2 className="text-base font-semibold text-ink">계정 정보</h2>
            <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                    <dt className="text-muted">이메일</dt>
                    <dd className="text-ink">{email}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted">가입 방식</dt>
                    <dd className="text-ink">{kakaoLinked ? "카카오" : "이메일"}</dd>
                </div>
                <div className="flex justify-between">
                    <dt className="text-muted">가입일</dt>
                    <dd className="text-ink">{formatJoinedDate(createdAt)}</dd>
                </div>
            </dl>
        </section>
    );
}
