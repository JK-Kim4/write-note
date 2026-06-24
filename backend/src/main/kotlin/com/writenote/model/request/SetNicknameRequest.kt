package com.writenote.model.request

/**
 * 닉네임 변경 요청. 형식·금칙어·중복 검증은 서비스([com.writenote.service.UserService])에서
 * 단일 코드로 처리하므로(형식 위반 = `NICKNAME_INVALID_FORMAT`) DTO 에는 별도 Bean Validation 을 두지 않는다.
 */
data class SetNicknameRequest(
    val nickname: String,
)
