import Link from "next/link";
import { SuccessBlock } from "@/components/ui/SuccessBlock";

export default function VerifyDonePage() {
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="success"
                title="환영합니다"
                description="이제 소설비 에서 첫 프로젝트를 시작할 수 있습니다."
            />
            <Link
                href="/"
                className="px-6 py-3 rounded-button-pill font-semibold"
                style={{ backgroundColor: "var(--w-ink)", color: "var(--w-canvas)" }}
            >
                시작하기 →
            </Link>
        </div>
    );
}
