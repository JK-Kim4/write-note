package com.writenote.service

import com.writenote.auth.KakaoUserRegistrar
import com.writenote.model.request.SignupEmailRequest
import com.writenote.repository.UserEncryptionKeyRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * 가입 시 DEK 자동 생성 통합 테스트.
 *
 * 이메일 가입 + 카카오 가입 두 경로 모두 user_encryption_keys 행이 생성되는지 검증.
 * 카카오 경로는 KakaoUserRegistrar(User INSERT + DEK 생성 트랜잭션 단위)를 직접 호출.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SignupKeyProvisioningIT {
    @Autowired
    private lateinit var authService: AuthService

    @Autowired
    private lateinit var kakaoUserRegistrar: KakaoUserRegistrar

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var userEncryptionKeyRepository: UserEncryptionKeyRepository

    @Test
    fun `이메일 가입 후 user_encryption_keys 행이 생성된다`() {
        val email = "signup-key-test-${UUID.randomUUID()}@example.com"
        val response = authService.signupEmail(SignupEmailRequest(email = email, password = "Strong!Pass123"))

        assertThat(userEncryptionKeyRepository.existsById(response.userId)).isTrue()
    }

    @Test
    fun `이메일 가입 시 생성된 DEK의 wrapped_dek는 60바이트이다`() {
        val email = "signup-key-size-${UUID.randomUUID()}@example.com"
        val response = authService.signupEmail(SignupEmailRequest(email = email, password = "Strong!Pass123"))

        val keyRow = userEncryptionKeyRepository.findById(response.userId).orElseThrow()
        // iv(12) + ct(32) + tag(16) = 60B
        assertThat(keyRow.wrappedDek).hasSize(60)
    }

    @Test
    fun `카카오 신규 가입 후 user_encryption_keys 행이 생성된다`() {
        val email = "kakao-key-test-${UUID.randomUUID()}@example.com"
        val kakaoId = "kakao-${UUID.randomUUID()}"

        val user = kakaoUserRegistrar.registerAndCreateKey(email, kakaoId)

        assertThat(userEncryptionKeyRepository.existsById(requireNotNull(user.id))).isTrue()
    }

    @Test
    fun `카카오 신규 가입 시 생성된 DEK의 wrapped_dek는 60바이트이다`() {
        val email = "kakao-key-size-${UUID.randomUUID()}@example.com"
        val kakaoId = "kakao-${UUID.randomUUID()}"

        val user = kakaoUserRegistrar.registerAndCreateKey(email, kakaoId)

        val keyRow = userEncryptionKeyRepository.findById(requireNotNull(user.id)).orElseThrow()
        // iv(12) + ct(32) + tag(16) = 60B
        assertThat(keyRow.wrappedDek).hasSize(60)
    }

    @Test
    fun `카카오 신규 가입 시 user와 DEK가 원자적으로 생성된다 — user 행과 key 행이 동시 존재`() {
        val email = "kakao-atomic-${UUID.randomUUID()}@example.com"
        val kakaoId = "kakao-${UUID.randomUUID()}"

        val user = kakaoUserRegistrar.registerAndCreateKey(email, kakaoId)
        val userId = requireNotNull(user.id)

        assertThat(userRepository.existsById(userId)).isTrue()
        assertThat(userEncryptionKeyRepository.existsById(userId)).isTrue()
    }
}
