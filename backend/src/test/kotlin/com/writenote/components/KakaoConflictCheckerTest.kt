package com.writenote.components

import com.writenote.entity.User
import com.writenote.repository.UserRepository
import io.mockk.every
import io.mockk.mockk
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class KakaoConflictCheckerTest {
    private val userRepository = mockk<UserRepository>()
    private val checker = KakaoConflictChecker(userRepository)

    @Test
    fun `신규 카카오 사용자 — kakaoId 미존재 + 같은 이메일 user 없음 시 NewKakaoUser 반환`() {
        every { userRepository.findByKakaoId(eq("kakao-123")) } returns null
        every { userRepository.findByEmail(eq("new@example.com")) } returns null

        val decision = checker.evaluateForLogin(kakaoId = "kakao-123", email = "new@example.com")

        assertThat(decision).isEqualTo(
            KakaoLoginDecision.NewKakaoUser(kakaoId = "kakao-123", email = "new@example.com"),
        )
    }

    @Test
    fun `기존 카카오 연결 사용자 — findByKakaoId 결과 존재 시 ExistingKakaoUser 반환`() {
        val existing =
            User(
                id = 42L,
                email = "linked@example.com",
                kakaoId = "kakao-123",
                passwordHash = null,
            )
        every { userRepository.findByKakaoId(eq("kakao-123")) } returns existing

        val decision = checker.evaluateForLogin(kakaoId = "kakao-123", email = "linked@example.com")

        assertThat(decision).isEqualTo(KakaoLoginDecision.ExistingKakaoUser(existing))
    }

    @Test
    fun `이메일 충돌 — kakaoId 미존재 + 같은 이메일 user 존재 + 그 user kakaoId NULL 시 EmailConflictNotLinked 반환`() {
        val emailUser =
            User(
                id = 7L,
                email = "conflict@example.com",
                kakaoId = null,
                passwordHash = "bcrypt-hash",
            )
        every { userRepository.findByKakaoId(eq("kakao-999")) } returns null
        every { userRepository.findByEmail(eq("conflict@example.com")) } returns emailUser

        val decision = checker.evaluateForLogin(kakaoId = "kakao-999", email = "conflict@example.com")

        assertThat(decision).isEqualTo(KakaoLoginDecision.EmailConflictNotLinked)
    }
}
