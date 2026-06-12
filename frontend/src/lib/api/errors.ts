/**
 * 에러 code → 한국어 메시지 매핑 (FR-012, 005 R-6).
 *
 * backend `Result.error.code` 를 사용자 메시지로 변환. 화면별 폼은 이 테이블을 공유하되,
 * 필드 배치(이메일/비밀번호) 분기는 각 폼이 결정한다.
 */

export const ERROR_MESSAGES: Record<string, string> = {
    // 로그인
    LOGIN_FAILED: "이메일 또는 비밀번호가 올바르지 않습니다.",
    EMAIL_NOT_VERIFIED: "이메일 인증이 필요합니다. 메일함을 확인해주세요.",
    LOGIN_LOCKED: "로그인 시도가 너무 많아 계정이 잠겼습니다. 30분 후 다시 시도해주세요.",
    // 회원가입
    EMAIL_ALREADY_REGISTERED: "이미 가입된 이메일입니다.",
    PASSWORD_TOO_WEAK: "비밀번호가 너무 약합니다. 12자 이상, 영문·숫자·특수문자를 모두 포함해주세요.",
    EMAIL_INVALID_FORMAT: "이메일 형식이 올바르지 않습니다.",
    VALIDATION_FAILED: "입력값을 확인해주세요.",
    // 토큰(인증/재설정)
    AUTH_TOKEN_EXPIRED: "링크가 만료되었습니다. 다시 요청해주세요.",
    AUTH_TOKEN_ALREADY_USED: "이미 사용된 링크입니다.",
    // 리소스
    RESOURCE_NOT_FOUND: "대상을 찾을 수 없습니다.",
    // 카카오 연결
    KAKAO_ALREADY_LINKED: "이미 카카오가 연결되어 있습니다.",
    KAKAO_LINK_CONFLICT: "이 카카오 계정은 다른 사용자에 연결되어 있습니다.",
};

export function resolveErrorMessage(code: string, fallback = "요청을 처리하지 못했습니다."): string {
    return ERROR_MESSAGES[code] ?? fallback;
}
