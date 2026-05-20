import { LoginForm } from "@/components/auth/LoginForm";
import { AlertError } from "@/components/ui/AlertError";

export default function LoginErrorPage() {
    return (
        <div className="flex flex-col gap-5">
            <AlertError
                title="로그인에 실패했습니다"
                tries="남은 시도 4회. 5회 실패 시 30분 동안 로그인이 제한됩니다."
            >
                이메일 또는 비밀번호를 다시 확인해주세요.
            </AlertError>
            <LoginForm />
        </div>
    );
}
