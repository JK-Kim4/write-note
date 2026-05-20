import Link from "next/link";
import { BrandBlock } from "@/components/ui/BrandBlock";

/**
 * Not-found fallback — wireframe 미정의 surface (FR-011).
 *
 * Spec reference: contracts/route-surfaces.md §3
 * 본 spec 의 디자인 시스템 토큰 재활용한 minimal.
 */

export default function NotFoundPage() {
    return (
        <main
            className="flex min-h-screen items-center justify-center px-4 py-12"
            style={{ backgroundColor: "var(--w-parchment)" }}
        >
            <div
                className="w-full max-w-md rounded-card-project px-8 py-10 text-center"
                style={{
                    backgroundColor: "var(--w-canvas)",
                    border: "1px solid var(--w-hairline)",
                }}
            >
                <BrandBlock />
                <h1
                    className="font-display font-semibold"
                    style={{ fontSize: "22px", color: "var(--w-ink)", marginBottom: "12px" }}
                >
                    찾을 수 없는 페이지
                </h1>
                <p style={{ color: "var(--w-ink)", opacity: 0.7, marginBottom: "24px" }}>
                    요청하신 페이지가 존재하지 않거나 이동했습니다.
                </p>
                <Link
                    href="/"
                    className="inline-block px-6 py-3 rounded-button-pill font-semibold"
                    style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
                >
                    홈으로 가기 →
                </Link>
            </div>
        </main>
    );
}
