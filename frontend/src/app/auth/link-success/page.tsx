import Link from "next/link";
import { SuccessBlock } from "@/components/ui/SuccessBlock";

/**
 * 카카오 추가 연결 완료 안내 (US6).
 * OAuth2SuccessHandler 의 link flow 가 `{frontend}/auth/link-success` 로 redirect.
 */
export default function LinkSuccessPage() {
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="success"
                title="카카오 계정이 연결됐습니다"
                description="이제 카카오로도 로그인할 수 있습니다."
            />
            <Link
                href="/settings"
                className="px-6 py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                설정으로
            </Link>
        </div>
    );
}
