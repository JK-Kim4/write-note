import type { Metadata } from "next";

/**
 * 공개 공유 페이지(046 R5) 레이아웃 — 인증벽 밖(비로그인 200 열람).
 *
 * `(main)` 그룹의 useAuthGuard 를 상속하지 않도록 최상위 `/shared` 세그먼트에 둔다. React Query Provider 는
 * 루트 layout 의 Providers 가 제공한다. noindex 메타데이터를 여기서 박아 capability URL(공유 토큰)이
 * 검색 엔진에 색인되지 않게 한다(/shared/** 전체 상속).
 */
export const metadata: Metadata = {
    robots: { index: false, follow: false },
};

export default function SharedLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex-1 bg-surface-2 font-sans text-ink antialiased">
            <header className="border-b border-border bg-surface">
                <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
                    <span
                        role="img"
                        aria-label="소설비"
                        className="block"
                        style={{ width: "120px", height: "44px", background: "url('/soseolbi-logo.png') left center / contain no-repeat" }}
                    />
                </div>
            </header>
            <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
        </div>
    );
}
