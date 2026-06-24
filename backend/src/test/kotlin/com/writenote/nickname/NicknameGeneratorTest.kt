package com.writenote.nickname

import com.writenote.repository.UserRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class NicknameGeneratorTest {
    private val userRepository = mockk<UserRepository>()
    private val generator = NicknameGenerator(userRepository)

    @Test
    fun `생성된 닉네임은 형식 규칙을 만족한다`() {
        every { userRepository.existsByNickname(any()) } returns false
        repeat(100) {
            val nickname = generator.generate()
            assertThat(nickname).matches("^[가-힣a-zA-Z0-9_]{2,16}$")
            assertThat(NicknamePolicy.isValidFormat(nickname)).isTrue()
        }
    }

    @Test
    fun `고유성 충돌 시 다른 닉네임으로 재추첨한다`() {
        // 첫 후보는 이미 사용 중(true), 두 번째 후보는 미사용(false).
        every { userRepository.existsByNickname(any()) } returnsMany listOf(true, false)

        val nickname = generator.generate()

        assertThat(nickname).matches("^[가-힣a-zA-Z0-9_]{2,16}$")
        verify(atLeast = 2) { userRepository.existsByNickname(any()) }
    }
}
