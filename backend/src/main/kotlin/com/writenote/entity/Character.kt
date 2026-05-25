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
