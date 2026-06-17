/**
 * 집필실 로딩 스켈레톤 — 라우트 전환(loading.tsx)과 셸 데이터 로딩 분기 공용.
 *
 * product 규칙: 콘텐츠 가운데 스피너 대신 스켈레톤. 브랜드: 종이 위 빈 원고 줄이 차분히 맥동해
 * 실제 에디터(원고)로 매끄럽게 이어진다(같은 형태 → 전환 점프 최소화). 모션은 상태 전달용,
 * prefers-reduced-motion 에서 정지.
 */
const LINE_WIDTHS = [62, 90, 78, 95, 70, 88, 52] as const;

export function StudioSkeleton() {
    return (
        <div className="studio-skeleton" role="status" aria-live="polite" aria-busy="true">
            <div className="studio-skeleton__sheet" aria-hidden="true">
                {LINE_WIDTHS.map((width, i) => (
                    <span
                        key={i}
                        className="studio-skeleton__line"
                        style={{ width: `${width}%`, animationDelay: `${i * 90}ms` }}
                    />
                ))}
            </div>
            <p className="studio-skeleton__label">집필실 여는 중…</p>
        </div>
    );
}
