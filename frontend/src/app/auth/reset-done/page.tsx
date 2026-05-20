import Link from "next/link";
import { SuccessBlock } from "@/components/ui/SuccessBlock";

export default function ResetDonePage() {
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="success"
                title="비밀번호가 변경됐습니다"
                description="새 비밀번호로 로그인할 수 있습니다."
            />
            <Link
                href="/auth/login"
                className="px-6 py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                로그인하기 →
            </Link>
        </div>
    );
}
