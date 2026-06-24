package com.writenote.nickname

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class NicknamePolicyTest {
    @Test
    fun `2~16자 한글_영문_숫자_밑줄은 유효하다`() {
        assertThat(NicknamePolicy.isValidFormat("푸른고래")).isTrue()
        assertThat(NicknamePolicy.isValidFormat("my_name2")).isTrue()
        assertThat(NicknamePolicy.isValidFormat("작가")).isTrue()
    }

    @Test
    fun `1자는 무효다`() {
        assertThat(NicknamePolicy.isValidFormat("가")).isFalse()
    }

    @Test
    fun `17자는 무효다`() {
        assertThat(NicknamePolicy.isValidFormat("가".repeat(17))).isFalse()
    }

    @Test
    fun `허용되지 않은 특수문자는 무효다`() {
        assertThat(NicknamePolicy.isValidFormat("별★")).isFalse()
        assertThat(NicknamePolicy.isValidFormat("hi there")).isFalse()
    }

    @Test
    fun `앞뒤 공백은 정규화 후 검증한다`() {
        val normalized = NicknamePolicy.normalize("  필명  ")
        assertThat(normalized).isEqualTo("필명")
        assertThat(NicknamePolicy.isValidFormat(normalized)).isTrue()
    }
}
