package com.writenote.nickname

/**
 * 닉네임 형식 정책.
 *
 * 길이 2~16자 + 허용 문자(한글·영문·숫자·밑줄). 길이 검증을 정규식에 포함해
 * 형식 위반은 단일 코드(`NICKNAME_INVALID_FORMAT`)로 처리한다.
 */
object NicknamePolicy {
    private val FORMAT = Regex("^[가-힣a-zA-Z0-9_]{2,16}$")

    /** 입력 앞뒤 공백 제거. */
    fun normalize(raw: String): String = raw.trim()

    /** 정규화된 닉네임이 길이·허용 문자 규칙을 만족하는가. */
    fun isValidFormat(nickname: String): Boolean = FORMAT.matches(nickname)
}
