import { SuccessBlock } from "@/components/ui/SuccessBlock";
import { PanelLink } from "@/components/auth/PanelLink";
import { ResendVerificationButton } from "@/components/auth/ResendVerificationButton";

export default async function VerifyPendingPage({
    searchParams,
}: {
    searchParams: Promise<{ email?: string }>;
}) {
    const { email } = await searchParams;
    return (
        <div className="flex flex-col items-center gap-6">
            <SuccessBlock
                variant="info"
                title="메일로 마지막 단계를 보냈습니다"
                description="입력하신 이메일의 인증 링크를 클릭하면 가입이 완료됩니다."
            />
            <div className="flex flex-col items-center gap-2 text-center">
                <PanelLink href="/auth/login" variant="accent">
                    로그인하러 가기 →
                </PanelLink>
                <ResendVerificationButton email={email} />
            </div>
        </div>
    );
}
