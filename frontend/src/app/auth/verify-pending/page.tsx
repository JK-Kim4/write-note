import { SuccessBlock } from "@/components/ui/SuccessBlock";
import { PanelLink } from "@/components/auth/PanelLink";

export default function VerifyPendingPage() {
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="info"
                title="메일로 마지막 단계를 보냈습니다"
                description="입력하신 이메일의 인증 링크를 클릭하면 가입이 완료됩니다."
            />
            <div className="text-center">
                <PanelLink href="/auth/verify-pending" variant="muted">
                    다시 보내기
                </PanelLink>
            </div>
        </div>
    );
}
