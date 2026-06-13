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
@Table(name = "projects")
class Project(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    @Column(nullable = false, length = 120)
    var title: String = "",
    @Column(length = 100)
    var genre: String? = null,
    @Column(name = "target_length")
    var targetLength: Int? = null,
    @Column(name = "tone_notes", columnDefinition = "TEXT")
    var toneNotes: String? = null,
    @Column(columnDefinition = "TEXT")
    var synopsis: String? = null,
    @Column(name = "world_notes", columnDefinition = "TEXT")
    var worldNotes: String? = null,
    @Column(name = "next_scene", nullable = false, columnDefinition = "TEXT")
    var nextScene: String = "",
    @Column(name = "paper_size", nullable = false, length = 8)
    var paperSize: String = "A4",
    @Column(name = "archived_at")
    var archivedAt: Instant? = null,
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

    fun isArchived(): Boolean = archivedAt != null

    fun archive(now: Instant) {
        if (archivedAt == null) {
            archivedAt = now
        }
    }

    fun unarchive() {
        archivedAt = null
    }
}
