package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.IdClass
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.io.Serializable
import java.time.Instant

/**
 * 사용자 환경설정 한 항목 (019 US2 / #37). (userId, settingKey) 복합 PK 의 key-value 행.
 * 허용 key·value 검증은 SettingsService(allowlist)가 담당 — 엔티티는 저장만.
 */
@Entity
@Table(name = "user_settings")
@IdClass(UserSettingId::class)
class UserSetting(
    @Id
    @Column(name = "user_id")
    var userId: Long = 0,
    @Id
    @Column(name = "setting_key", length = 64)
    var settingKey: String = "",
    @Column(nullable = false, length = 255)
    var value: String = "",
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    @PrePersist
    @PreUpdate
    fun touch() {
        updatedAt = Instant.now()
    }
}

/** UserSetting 복합 PK. JPA @IdClass 요건상 no-arg + equals/hashCode(data class) 필요. */
data class UserSettingId(
    val userId: Long = 0,
    val settingKey: String = "",
) : Serializable
