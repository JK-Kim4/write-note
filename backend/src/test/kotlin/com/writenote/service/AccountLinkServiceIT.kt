package com.writenote.service

import com.writenote.entity.User
import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class AccountLinkServiceIT
    @Autowired
    constructor(
        private val accountLinkService: AccountLinkService,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
        private val entityManager: EntityManager,
    ) {
        private fun savedKakaoOnlyUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "link-${UUID.randomUUID()}@example.com",
                    kakaoId = "kakao-${UUID.randomUUID().toString().take(16)}",
                    passwordHash = null,
                    emailVerifiedAt = Instant.now(),
                ),
            )

        private fun savedEmailOnlyUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "link-${UUID.randomUUID()}@example.com",
                    passwordHash = requireNotNull(passwordEncoder.encode("Old!Pass1234")),
                    emailVerifiedAt = Instant.now(),
                ),
            )

        @Test
        @DisplayName("linkEmail happy — 카카오 가입자 비밀번호 추가 등록 (FR-024)")
        fun `linkEmail happy`() {
            val user = savedKakaoOnlyUser()
            entityManager.flush()
            entityManager.clear()

            accountLinkService.linkEmail(requireNotNull(user.id), "Strong!Pass1234")
            entityManager.flush()
            entityManager.clear()

            val updated = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(updated.passwordHash).isNotNull()
            assertThat(passwordEncoder.matches("Strong!Pass1234", requireNotNull(updated.passwordHash))).isTrue()
            // kakaoId 보존
            assertThat(updated.kakaoId).isEqualTo(user.kakaoId)
        }

        @Test
        @DisplayName("linkEmail — 이미 비밀번호 설정됨 거부 (PASSWORD_ALREADY_SET)")
        fun `linkEmail 이미 비밀번호 설정됨 거부`() {
            val user = savedEmailOnlyUser()
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                accountLinkService.linkEmail(requireNotNull(user.id), "Strong!Pass1234")
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_ALREADY_SET)
        }

        @Test
        @DisplayName("linkEmail — 약한 비밀번호 거부 (PASSWORD_TOO_WEAK)")
        fun `linkEmail 약한 비밀번호 거부`() {
            val user = savedKakaoOnlyUser()
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                accountLinkService.linkEmail(requireNotNull(user.id), "weak")
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.PASSWORD_TOO_WEAK)
        }

        @Test
        @DisplayName("linkKakao happy — 이메일 가입자 카카오 추가 연결 (FR-023)")
        fun `linkKakao happy`() {
            val user = savedEmailOnlyUser()
            entityManager.flush()
            entityManager.clear()
            val newKakaoId = "kakao-fresh-${UUID.randomUUID().toString().take(16)}"

            accountLinkService.linkKakao(requireNotNull(user.id), newKakaoId)
            entityManager.flush()
            entityManager.clear()

            val updated = userRepository.findById(requireNotNull(user.id)).orElseThrow()
            assertThat(updated.kakaoId).isEqualTo(newKakaoId)
            // passwordHash 보존
            assertThat(updated.passwordHash).isNotNull()
        }

        @Test
        @DisplayName("linkKakao — 다른 user 에 묶인 kakaoId 거부 (KAKAO_ALREADY_LINKED, FR-025)")
        fun `linkKakao 다른 user 에 묶인 kakaoId 거부`() {
            val other = savedKakaoOnlyUser() // 본 user 가 kakaoId 박혀있음
            val self = savedEmailOnlyUser()
            entityManager.flush()
            entityManager.clear()

            assertThatThrownBy {
                accountLinkService.linkKakao(requireNotNull(self.id), requireNotNull(other.kakaoId))
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.KAKAO_ALREADY_LINKED)

            // self 상태 변경 없음
            val unchanged = userRepository.findById(requireNotNull(self.id)).orElseThrow()
            assertThat(unchanged.kakaoId).isNull()
        }

        @Test
        @DisplayName("linkKakao — 본인이 이미 다른 kakaoId 박힘 거부 (KAKAO_LINK_CONFLICT)")
        fun `linkKakao 본인이 이미 다른 kakaoId 박힘 거부`() {
            val user = savedKakaoOnlyUser() // 본인이 이미 kakaoId 박혀있음
            entityManager.flush()
            entityManager.clear()
            val differentKakaoId = "kakao-different-${UUID.randomUUID().toString().take(16)}"

            assertThatThrownBy {
                accountLinkService.linkKakao(requireNotNull(user.id), differentKakaoId)
            }.isInstanceOf(AuthException::class.java)
                .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.KAKAO_LINK_CONFLICT)
        }
    }
