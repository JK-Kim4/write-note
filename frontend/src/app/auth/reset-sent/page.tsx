import { SuccessBlock } from "@/components/ui/SuccessBlock";
import { PanelLink } from "@/components/auth/PanelLink";

export default function ResetSentPage() {
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="info"
                title="메일을 보냈습니다"
                description="입력하신 이메일로 비밀번호 재설정 링크를 보냈습니다. 메일함을 확인해주세요."
            />
            <div className="text-center">
                <PanelLink href="/auth/reset-request" variant="muted">
                    메일을 받지 못했나요? 다시 보내기
                </PanelLink>
            </div>
        </div>
    );
}
