package com.writenote.repository

import com.writenote.entity.AuthToken
import com.writenote.enums.AuthTokenType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Modifying
import org.springframework.data.jpa.repository.Query
import java.time.Instant

interface AuthTokenRepository : JpaRepository<AuthToken, Long> {
    fun findByTokenHashAndType(
        tokenHash: String,
        type: AuthTokenType,
    ): AuthToken?

    @Modifying
    fun deleteByTokenHashAndType(
        tokenHash: String,
        type: AuthTokenType,
    ): Int

    @Modifying
    fun deleteByUserIdAndType(
        userId: Long,
        type: AuthTokenType,
    ): Int

    @Modifying
    @Query(
        """
        DELETE FROM AuthToken t
         WHERE t.expiresAt < :now
            OR (t.type IN (com.writenote.enums.AuthTokenType.EMAIL_VERIFY,
                           com.writenote.enums.AuthTokenType.PASSWORD_RESET)
                AND t.usedAt IS NOT NULL)
        """,
    )
    fun cleanupExpiredAndUsed(now: Instant): Int
}
