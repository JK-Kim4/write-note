import { SignupEmailForm } from "@/components/auth/SignupEmailForm";

/**
 * 회원가입 폼 — 에러 표시는 폼이 서버 응답 code 로 자체 처리(005 US5).
 * (002 의 정적 에러 데모 라우트를 실동작 폼으로 통일)
 */
export default function SignupErrorPage() {
    return <SignupEmailForm />;
}
