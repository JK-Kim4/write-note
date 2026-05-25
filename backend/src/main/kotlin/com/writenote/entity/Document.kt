package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import jakarta.persistence.Version
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "documents")
class Document(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "project_id", nullable = false, unique = true)
    var projectId: Long = 0,
    @Column(nullable = false, length = 120)
    var title: String = "",
    @Column(nullable = false, columnDefinition = "jsonb")
    @JdbcTypeCode(SqlTypes.JSON)
    var body: String = EMPTY_DOC_JSON,
    @Column(name = "word_count", nullable = false)
    var wordCount: Int = 0,
    @Version
    @Column(nullable = false)
    var version: Int = 0,
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

    companion object {
        const val EMPTY_DOC_JSON: String = """{"type":"doc","content":[]}"""
    }
}
