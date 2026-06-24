package com.writenote.nickname

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class ForbiddenWordsTest {
    @Test
    fun `금칙어를 포함하면 차단한다`() {
        assertThat(ForbiddenWords.contains("씨발놈")).isTrue()
        assertThat(ForbiddenWords.contains("나는병신")).isTrue()
    }

    @Test
    fun `영어 금칙어는 대소문자 무시하고 차단한다`() {
        assertThat(ForbiddenWords.contains("MyFuckName")).isTrue()
        assertThat(ForbiddenWords.contains("SHIThead")).isTrue()
    }

    @Test
    fun `정상 닉네임은 통과한다`() {
        assertThat(ForbiddenWords.contains("푸른고래")).isFalse()
        assertThat(ForbiddenWords.contains("나의필명")).isFalse()
        assertThat(ForbiddenWords.contains("writer_2026")).isFalse()
    }
}
