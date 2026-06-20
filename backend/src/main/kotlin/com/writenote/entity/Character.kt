package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import java.time.Instant

@Entity
@Table(name = "characters")
class Character(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "project_id", nullable = false)
    var projectId: Long = 0,
    @Column(nullable = false, length = 80)
    var name: String = "",
    @Column(name = "short_description", length = 255)
    var shortDescription: String? = null,
    @Column(columnDefinition = "TEXT")
    var notes: String? = null,
    /** 나이 — 자유 텍스트("17세 가량"/"불명" 허용). */
    @Column(length = 80)
    var age: String? = null,
    /** 성별 코드 — MALE/FEMALE/OTHER 또는 NULL(비움). 허용값 검증은 CharacterService. */
    @Column(length = 16)
    var gender: String? = null,
    /** 특징 — 자유 텍스트(외형·말버릇·성향 등). 기존 notes 와 동일 한도. */
    @Column(columnDefinition = "TEXT")
    var traits: String? = null,
    @Column(name = "display_order", nullable = false)
    var displayOrder: Int = 0,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        val now = Instant.now()
        if (createdAt == null) {
            createdAt = now
        }
        if (updatedAt == null) {
            updatedAt = now
        }
    }

    @PreUpdate
    fun preUpdate() {
        updatedAt = Instant.now()
    }
}
