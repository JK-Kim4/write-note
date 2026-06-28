package com.writenote.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

@DisplayName("공유 토큰 생성기(046 R-6)")
class ShareTokenGeneratorTest {
    private val generator = ShareTokenGenerator()

    @Test
    fun `토큰은 base62 32자다`() {
        val token = generator.generate()

        assertThat(token).hasSize(32)
        assertThat(token).matches("[A-Za-z0-9]{32}")
    }

    @Test
    fun `반복 생성 시 충돌하지 않는다(추측불가 경향)`() {
        val tokens = (1..2000).map { generator.generate() }.toSet()

        assertThat(tokens).hasSize(2000)
    }
}
