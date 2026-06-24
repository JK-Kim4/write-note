package com.writenote.crypto

import com.writenote.entity.User
import com.writenote.repository.UserEncryptionKeyRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.extension.ExtendWith
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.junit.jupiter.SpringExtension
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate

/**
 * UserKeyService 통합 테스트.
 * 실제 DB + 실제 암호 연산(mock 금지).
 *
 * FK: user_encryption_keys.user_id → users.id 이므로 User를 먼저 생성 후 테스트.
 */
@SpringBootTest
@ExtendWith(SpringExtension::class)
@ActiveProfiles("test")
class UserKeyServiceTest {
    @Autowired
    private lateinit var userKeyService: UserKeyService

    @Autowired
    private lateinit var userEncryptionKeyRepository: UserEncryptionKeyRepository

    @Autowired
    private lateinit var userRepository: UserRepository

    @Autowired
    private lateinit var transactionManager: PlatformTransactionManager

    private var userIdA: Long = 0L
    private var userIdB: Long = 0L

    @BeforeEach
    fun setUp() {
        userEncryptionKeyRepository.deleteAll()
        // FK 제약: user_encryption_keys.user_id → users.id 이므로 User를 먼저 생성
        val userA =
            userRepository.saveAndFlush(
                User(email = "uks-test-a-${System.nanoTime()}@example.com", passwordHash = "fixture"),
            )
        val userB =
            userRepository.saveAndFlush(
                User(email = "uks-test-b-${System.nanoTime()}@example.com", passwordHash = "fixture"),
            )
        userIdA = userA.id!!
        userIdB = userB.id!!
    }

    @Test
    fun `create 시 user_encryption_keys 행이 생성된다`() {
        userKeyService.create(userIdA)
        assertThat(userEncryptionKeyRepository.existsById(userIdA)).isTrue()
    }

    @Test
    fun `getOrCreate - 행이 없을 때 DEK를 생성하고 반환한다`() {
        val dek = userKeyService.getOrCreate(userIdA)
        assertThat(dek).isNotNull()
        assertThat(dek.encoded).hasSize(32)
        assertThat(userEncryptionKeyRepository.existsById(userIdA)).isTrue()
    }

    @Test
    fun `getOrCreate - 행이 이미 있을 때 동일한 DEK를 반환한다`() {
        val dek1 = userKeyService.getOrCreate(userIdA)
        val dek2 = userKeyService.getOrCreate(userIdA)
        assertThat(dek1.encoded).isEqualTo(dek2.encoded)
    }

    @Test
    fun `두 사용자의 DEK는 다르다`() {
        val dekA = userKeyService.getOrCreate(userIdA)
        val dekB = userKeyService.getOrCreate(userIdB)
        assertThat(dekA.encoded).isNotEqualTo(dekB.encoded)
    }

    @Test
    fun `wrap unwrap 왕복 - 동일 DEK 복원`() {
        userKeyService.create(userIdA)
        val dek1 = userKeyService.getOrCreate(userIdA)
        // 캐시 우회를 위해 직접 레포에서 읽어 wrappedDek 비어있지 않음 검증
        val stored = userEncryptionKeyRepository.findById(userIdA).get()
        // UserKeyService가 내부에서 unwrap하므로 getOrCreate 재호출로 동일 값 검증
        val dek2 = userKeyService.getOrCreate(userIdA)
        assertThat(dek1.encoded).isEqualTo(dek2.encoded)
        assertThat(stored.wrappedDek).isNotEmpty()
    }

    @Test
    fun `롤백된 트랜잭션에서 생성한 DEK는 이후 조회되지 않는다 - 캐시 잔존 방지`() {
        // 본문 저장 트랜잭션이 encrypt(DEK 생성) 이후 롤백되는 상황 재현.
        TransactionTemplate(transactionManager).execute { status ->
            userKeyService.create(userIdA)
            status.setRollbackOnly()
        }

        // DB 는 롤백으로 행이 없어야 하고(원자성), 캐시도 거짓 DEK 를 들고 있으면 안 된다.
        // 캐시가 롤백을 따라가지 않으면 find 가 잔존 DEK 를 반환 → 이후 그 DEK 로 암호문이 생성되나
        // DB 엔 DEK 가 없어 재부팅(캐시 소실) 시 영구 복호 불가가 된다.
        assertThat(userEncryptionKeyRepository.existsById(userIdA)).isFalse()
        assertThat(userKeyService.find(userIdA)).isNull()
    }

    @Test
    fun `롤백 후 재생성 시 DEK가 DB에 정상 영속된다`() {
        TransactionTemplate(transactionManager).execute { status ->
            userKeyService.create(userIdA)
            status.setRollbackOnly()
        }

        // 롤백 이후 다음 저장 — 캐시 히트로 DB 미영속 DEK 를 재사용하지 않고, 새로 생성해 DB 에 영속해야 한다.
        val dek = userKeyService.getOrCreate(userIdA)
        assertThat(userEncryptionKeyRepository.existsById(userIdA)).isTrue()
        // 영속된 DEK 와 조회 DEK 가 일치(캐시·DB 정합).
        assertThat(userKeyService.find(userIdA)?.encoded).isEqualTo(dek.encoded)
    }

    @Test
    fun `create 중복 호출 시 두 번째 호출도 예외 없이 동일 DEK를 반환한다`() {
        // 첫 번째 create — 정상 INSERT + DEK 생성
        val dek1 = userKeyService.create(userIdA)

        // 두 번째 create — 행 이미 존재 → 선행 조회에서 감지 → 기존 DEK unwrap 반환.
        // (동시성 레이스는 선행 조회 + saveAndFlush catch 이중 방어로 처리)
        val dek2 = userKeyService.create(userIdA)

        // 두 호출 모두 같은 DEK (동일 사용자의 암호화 키)
        assertThat(dek1.encoded).isEqualTo(dek2.encoded)
        // DB 행은 여전히 1개
        assertThat(userEncryptionKeyRepository.count()).isEqualTo(1L)
    }
}
