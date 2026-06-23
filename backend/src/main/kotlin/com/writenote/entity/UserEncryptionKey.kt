package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * 사용자별 DEK(데이터 암호화 키) 봉투.
 *
 * [wrappedDek] = KEK(마스터 키)로 AES-256-GCM wrap한 DEK 바이트 (iv‖ct‖tag = 60B).
 * [keyVersion] = KEK 회전 구조 지원용 버전 식별자 (현재 1 고정).
 * PK = [userId] (사용자 1:1 대응).
 */
@Entity
@Table(name = "user_encryption_keys")
class UserEncryptionKey(
    @Id
    @Column(name = "user_id", nullable = false)
    val userId: Long,
    @Column(name = "wrapped_dek", nullable = false)
    var wrappedDek: ByteArray,
    @Column(name = "key_version", nullable = false)
    var keyVersion: Int = 1,
    @Column(name = "created_at", nullable = false, updatable = false)
    val createdAt: Instant = Instant.now(),
)
