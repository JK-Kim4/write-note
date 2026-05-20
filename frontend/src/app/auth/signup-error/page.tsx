import { SignupEmailForm } from "@/components/auth/SignupEmailForm";

export default function SignupErrorPage() {
    return (
        <SignupEmailForm
            emailError="이미 가입된 이메일입니다."
            emailHasLoginLink
            passwordError="비밀번호가 너무 약합니다. 8자 이상, 숫자·문자 조합을 사용하세요."
            submitDisabled
        />
    );
}
