package com.writenote.crypto

import com.writenote.error.BodyDecryptionException
import org.springframework.stereotype.Service

/**
 * 본문 봉투 암복호 파사드.
 *
 * [encrypt]: userId에 해당하는 DEK로 [plain]을 AES-256-GCM 봉투 암호화.
 * [decryptToPlain]: 저장된 [stored] 봉투(또는 레거시 평문)를 복호하여 평문 반환.
 *
 * 복호 실패 시 [BodyDecryptionException] throw — fail-closed 원칙(평문/빈값 반환 금지).
 * 실패 경로에서 [DecryptionFailureNotifier]로 best-effort 운영자 알림 후 rethrow.
 */
@Service
class BodyCipherService(
    private val aesGcmCipher: AesGcmCipher,
    private val userKeyService: UserKeyService,
    private val decryptionFailureNotifier: DecryptionFailureNotifier,
) {
    /**
     * [plain]을 [userId]의 DEK로 AES-256-GCM 봉투 암호화하여 저장용 문자열 반환.
     */
    fun encrypt(
        userId: Long,
        plain: String,
    ): String {
        val dek = userKeyService.getOrCreate(userId)
        return aesGcmCipher.seal(dek, plain)
    }

    /**
     * [stored] 봉투(또는 레거시 평문)를 [userId]의 DEK로 복호하여 평문 반환.
     * 복호 실패 시 [BodyDecryptionException] throw.
     */
    fun decryptToPlain(
        userId: Long,
        stored: String,
    ): String {
        // 레거시 평문은 키 없이 통과 — 복호 경로가 DEK 생성을 유발하지 않도록(readOnly 트랜잭션 INSERT 금지).
        if (aesGcmCipher.isLegacyPlaintext(stored)) {
            return stored
        }
        return try {
            // 복호는 절대 DEK 를 생성하지 않는다 — 기존 DEK 만 조회(없으면 fail-closed).
            val dek =
                userKeyService.find(userId)
                    ?: throw BodyDecryptionException("사용자 DEK 미존재 — 암호문 복호 불가 (userId=$userId)")
            aesGcmCipher.openOrPassthrough(dek, stored)
        } catch (e: BodyDecryptionException) {
            decryptionFailureNotifier.notify(userId = userId, documentId = null, reason = e.message ?: "복호 실패")
            throw e
        }
    }
}
