package com.writenote.service

import com.writenote.auth.KakaoUserRegistrar
import com.writenote.model.request.SignupEmailRequest
import com.writenote.nickname.NicknamePolicy
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

/**
 * US1 — 가입 시 닉네임 자동 부여(이메일·카카오 경로).
 */
@SpringBootTest
@ActiveProfiles("test")
class SignupNicknameIT {
    @Autowired private lateinit var authService: AuthService

    @Autowired private lateinit var kakaoUserRegistrar: KakaoUserRegistrar

    @Autowired private lateinit var userRepository: UserRepository

    @Test
    fun `이메일 가입 시 형식에 맞는 닉네임이 자동 부여된다`() {
        val email = "signup-nick-${UUID.randomUUID()}@example.com"

        authService.signupEmail(SignupEmailRequest(email = email, password = "Password123"))

        val user = userRepository.findByEmail(email)
        assertThat(user).isNotNull
        assertThat(user!!.nickname).isNotBlank()
        assertThat(NicknamePolicy.isValidFormat(user.nickname)).isTrue()
    }

    @Test
    fun `카카오 가입 시 형식에 맞는 닉네임이 자동 부여된다`() {
        val email = "kakao-nick-${UUID.randomUUID()}@example.com"
        val kakaoId = "kakao-${UUID.randomUUID()}"

        val user = kakaoUserRegistrar.registerAndCreateKey(email = email, kakaoId = kakaoId)

        assertThat(user.nickname).isNotBlank()
        assertThat(NicknamePolicy.isValidFormat(user.nickname)).isTrue()
    }
}
