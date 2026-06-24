package com.writenote.components

import com.writenote.entity.User
import com.writenote.repository.ApiTokenRepository
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class UserAuthConverterTest {
    private val apiTokenRepository = mockk<ApiTokenRepository>()
    private val converter = UserAuthConverter(apiTokenRepository)

    @Test
    fun `passwordHash 가 있으면 passwordSet 은 true`() {
        every { apiTokenRepository.countByUserIdAndRevokedAtIsNull(any()) } returns 0L
        val user = User(id = 1L, email = "a@b.com", nickname = "닉네임", passwordHash = "hash")

        val response = converter.toAuthMeResponse(user)

        assertThat(response.passwordSet).isTrue()
    }

    @Test
    fun `passwordHash 가 없으면 passwordSet 은 false`() {
        every { apiTokenRepository.countByUserIdAndRevokedAtIsNull(any()) } returns 0L
        val user = User(id = 2L, email = "k@b.com", nickname = "카카오닉", passwordHash = null, kakaoId = "kakao-1")

        val response = converter.toAuthMeResponse(user)

        assertThat(response.passwordSet).isFalse()
    }
}
