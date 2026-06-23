package com.writenote.service

import com.writenote.crypto.BodyCipherService
import com.writenote.crypto.UserKeyService
import com.writenote.entity.User
import com.writenote.error.BodyDecryptionException
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.util.UUID

/**
 * 두 사용자 본문 키 격리 (US2).
 *
 * 사용자 A의 봉투를 B의 DEK로 복호 시도 → BodyDecryptionException(평문 미노출).
 */
@SpringBootTest
@ActiveProfiles("test")
class KeyIsolationIT {
    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var userKeyService: UserKeyService

    @Autowired private lateinit var bodyCipherService: BodyCipherService

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "key-iso-${UUID.randomUUID()}@example.com", passwordHash = "fixture-hash"),
        )

    @Test
    fun `A 작품 봉투를 B의 DEK로 복호하면 실패하고 평문이 노출되지 않는다`() {
        val userA = createUser()
        val userB = createUser()
        userKeyService.create(userA.id!!)
        userKeyService.create(userB.id!!)

        val secret = "격리비밀${UUID.randomUUID()}"
        val plain = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"$secret"}]}]}"""
        val sealedByA = bodyCipherService.encrypt(userA.id!!, plain)

        // A가 만든 봉투를 B의 userId로 복호 시도 → 실패
        assertThatThrownBy {
            bodyCipherService.decryptToPlain(userB.id!!, sealedByA)
        }.isInstanceOf(BodyDecryptionException::class.java)

        // 봉투 자체에는 평문이 없다(at-rest 격리)
        assertThat(sealedByA).doesNotContain(secret)
    }

    @Test
    fun `소유자 A는 자신의 봉투를 정상 복호한다`() {
        val userA = createUser()
        userKeyService.create(userA.id!!)
        val plain = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"내 본문"}]}]}"""

        val sealed = bodyCipherService.encrypt(userA.id!!, plain)
        val restored = bodyCipherService.decryptToPlain(userA.id!!, sealed)

        assertThat(restored).isEqualTo(plain)
    }
}
