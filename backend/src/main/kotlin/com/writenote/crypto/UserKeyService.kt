package com.writenote.crypto

import com.writenote.entity.UserEncryptionKey
import com.writenote.repository.UserEncryptionKeyRepository
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.transaction.support.TransactionSynchronization
import org.springframework.transaction.support.TransactionSynchronizationManager
import java.security.SecureRandom
import java.util.Collections
import java.util.LinkedHashMap
import javax.crypto.SecretKey
import javax.crypto.spec.SecretKeySpec

/**
 * 사용자별 DEK(데이터 암호화 키) 관리 서비스.
 *
 * - [create]: 신규 DEK 랜덤 생성 → KEK wrap → DB 저장 (가입 시 동일 트랜잭션에서 호출).
 * - [getOrCreate]: 캐시 → DB unwrap → 없으면 create. 평문 DEK를 메모리에서만 유지.
 * - in-memory DEK 캐시: userId → SecretKey. bounded(MAX_CACHE_SIZE 초과 시 LRU 제거).
 */
@Service
class UserKeyService(
    private val userEncryptionKeyRepository: UserEncryptionKeyRepository,
    private val aesGcmCipher: AesGcmCipher,
    private val masterKey: SecretKey,
) {
    private val dekCache: MutableMap<Long, SecretKey> =
        Collections.synchronizedMap(
            object : LinkedHashMap<Long, SecretKey>(MAX_CACHE_SIZE, 0.75f, true) {
                override fun removeEldestEntry(eldest: Map.Entry<Long, SecretKey>): Boolean = size > MAX_CACHE_SIZE
            },
        )

    private val secureRandom = SecureRandom()

    /**
     * DEK 캐시 적재를 트랜잭션 **커밋 이후**로 미룬다 — "캐시에 있는 DEK 는 DB 에 반드시 존재한다"는
     * 불변식 강제. 저장 트랜잭션이 [encrypt] 이후 롤백되면 DB 의 DEK 는 사라지지만, 커밋 전 캐시 적재 시
     * 거짓 DEK 가 캐시에 잔존해 다음 저장이 DB 에 없는 DEK 로 암호문을 만든다(영구 복호 불가). afterCommit
     * 적재는 롤백 시 발동하지 않아 이를 차단한다. 트랜잭션 동기화가 없으면(이미 커밋된 경로) 즉시 적재.
     */
    private fun cacheAfterCommit(
        userId: Long,
        dek: SecretKey,
    ) {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                object : TransactionSynchronization {
                    override fun afterCommit() {
                        dekCache[userId] = dek
                    }
                },
            )
        } else {
            dekCache[userId] = dek
        }
    }

    /**
     * 신규 DEK 생성 → KEK wrap → DB 저장.
     * 가입 트랜잭션(signupEmail / KakaoUserRegistrar) 내에서 호출 — 동일 트랜잭션 참여.
     *
     * 동시성 방어: INSERT 전 행 존재 여부를 먼저 확인한다.
     * 이미 행이 있으면 기존 DEK 를 반환(화해 — 다른 스레드가 이미 생성한 것).
     * 두 스레드가 동시에 없음을 확인하고 INSERT 를 시도할 경우 DataIntegrityViolationException
     * 을 catch 해 기존 행을 재조회 반환한다(이중 방어).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun create(userId: Long): SecretKey {
        // 선행 조회 — 이미 존재하면 기존 DEK 반환(동시성 화해 1차 방어)
        val existing = userEncryptionKeyRepository.findById(userId).orElse(null)
        if (existing != null) {
            val existingDek = aesGcmCipher.unwrap(masterKey, existing.wrappedDek)
            cacheAfterCommit(userId, existingDek)
            return existingDek
        }

        val dekBytes = ByteArray(DEK_SIZE).also { secureRandom.nextBytes(it) }
        val dek = SecretKeySpec(dekBytes, "AES")
        val wrapped = aesGcmCipher.wrap(masterKey, dek)
        try {
            userEncryptionKeyRepository.saveAndFlush(UserEncryptionKey(userId = userId, wrappedDek = wrapped))
        } catch (ex: DataIntegrityViolationException) {
            // 동시 INSERT 로 PK 중복(선행 조회 통과 후 레이스) — 기존 행을 재조회해 반환(2차 방어).
            val raceExisting =
                userEncryptionKeyRepository.findById(userId).orElseThrow {
                    DataIntegrityViolationException("DEK row not found after PK conflict for userId=$userId", ex)
                }
            val raceExistingDek = aesGcmCipher.unwrap(masterKey, raceExisting.wrappedDek)
            cacheAfterCommit(userId, raceExistingDek)
            return raceExistingDek
        }
        cacheAfterCommit(userId, dek)
        return dek
    }

    /**
     * 캐시 히트 → 캐시 DEK 반환.
     * 캐시 미스 → DB에서 wrapped_dek 조회 → unwrap → 캐시 저장 후 반환.
     * DB에도 없으면 create(지연 생성 안전망).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun getOrCreate(userId: Long): SecretKey {
        dekCache[userId]?.let { return it }
        val stored = userEncryptionKeyRepository.findById(userId).orElse(null)
        if (stored != null) {
            val dek = aesGcmCipher.unwrap(masterKey, stored.wrappedDek)
            cacheAfterCommit(userId, dek)
            return dek
        }
        return create(userId)
    }

    /**
     * 읽기 전용 DEK 조회 — 캐시 또는 DB의 기존 wrapped_dek 를 unwrap 해 반환.
     * **절대 생성하지 않는다**(복호 경로 전용). 행이 없으면 null.
     *
     * 복호는 readOnly 트랜잭션(문서 로드/카드)에서 일어나므로 INSERT(create)를 유발해선 안 된다.
     */
    fun find(userId: Long): SecretKey? {
        dekCache[userId]?.let { return it }
        val stored = userEncryptionKeyRepository.findById(userId).orElse(null) ?: return null
        val dek = aesGcmCipher.unwrap(masterKey, stored.wrappedDek)
        cacheAfterCommit(userId, dek)
        return dek
    }

    companion object {
        private const val DEK_SIZE = 32
        private const val MAX_CACHE_SIZE = 500
    }
}
