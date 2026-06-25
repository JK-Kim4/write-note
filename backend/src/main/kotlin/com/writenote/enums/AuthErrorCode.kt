package com.writenote.enums

import org.springframework.http.HttpStatus

enum class AuthErrorCode(
    val httpStatus: HttpStatus,
    val defaultMessage: String,
) {
    // 401 — 5종 표준 매트릭스 (contracts/security-filter-chain.md §3)
    AUTH_TOKEN_MISSING(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다."),
    AUTH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "토큰이 유효하지 않습니다."),
    AUTH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "토큰이 만료되었습니다. 다시 로그인해주세요."),
    AUTH_TOKEN_REVOKED(HttpStatus.UNAUTHORIZED, "세션이 만료되었습니다. 다시 로그인해주세요."),
    LOGIN_LOCKED(HttpStatus.UNAUTHORIZED, "로그인 시도가 5회 실패했습니다. 30분 후 다시 시도해주세요."),

    // 401 — 도메인 추가
    LOGIN_FAILED(HttpStatus.UNAUTHORIZED, "이메일 또는 비밀번호가 일치하지 않습니다."),
    EMAIL_NOT_VERIFIED(HttpStatus.UNAUTHORIZED, "이메일 인증이 완료되지 않았습니다."),

    // 400 — 입력 검증
    EMAIL_INVALID_FORMAT(HttpStatus.BAD_REQUEST, "이메일 형식이 올바르지 않습니다."),
    PASSWORD_TOO_WEAK(HttpStatus.BAD_REQUEST, "비밀번호는 8자 이상, 영문·숫자를 포함해야 합니다."),

    // 400 — 회원 탈퇴 확인 문구 불일치
    WITHDRAWAL_CONFIRMATION_MISMATCH(HttpStatus.BAD_REQUEST, "확인 문구가 일치하지 않습니다."),

    // 400 — 닉네임 (036)
    NICKNAME_INVALID_FORMAT(HttpStatus.BAD_REQUEST, "닉네임은 2~16자의 한글·영문·숫자·밑줄만 사용할 수 있습니다."),
    NICKNAME_FORBIDDEN_WORD(HttpStatus.BAD_REQUEST, "사용할 수 없는 단어가 포함되어 있습니다."),

    // 400 — 플롯 보드 연결 (038)
    BOARD_LINK_INVALID(HttpStatus.BAD_REQUEST, "연결할 수 없는 카드입니다(자기 연결·다른 보드·없는 카드)."),

    // 409 — 충돌
    EMAIL_ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 가입된 이메일입니다."),
    NICKNAME_ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 사용 중인 닉네임입니다."),

    // 409 — 플롯 보드 (038)
    BOARD_PROJECT_ALREADY_MAPPED(HttpStatus.CONFLICT, "이미 보드가 연결된 작품입니다."),
    BOARD_CATEGORY_ALREADY_MAPPED(HttpStatus.CONFLICT, "이미 보드가 연결된 시리즈입니다."),
    BOARD_LINK_DUPLICATE(HttpStatus.CONFLICT, "이미 존재하는 연결입니다."),
    AUTH_TOKEN_ALREADY_USED(HttpStatus.CONFLICT, "이미 사용된 토큰입니다."),
    KAKAO_EMAIL_ALREADY_REGISTERED(
        HttpStatus.CONFLICT,
        "이미 이메일로 가입된 계정입니다. 로그인 후 카카오를 추가 연결해주세요.",
    ),
    KAKAO_ALREADY_LINKED(HttpStatus.CONFLICT, "이미 다른 계정에 연결된 카카오입니다."),
    KAKAO_LINK_CONFLICT(HttpStatus.CONFLICT, "이미 카카오가 연결되어 있습니다."),
    PASSWORD_ALREADY_SET(HttpStatus.CONFLICT, "비밀번호가 이미 설정되어 있습니다."),
}
