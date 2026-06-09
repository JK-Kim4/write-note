package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
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
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    // updatedAt = 수정 시각 + 낙관적 잠금 토큰 겸용(@Version). Hibernate 가 flush 시 자동 set.
    // 수동 set 금지(@PreUpdate 제거) — 수동 갱신은 @Version 관리와 충돌한다.
    @Version
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
        // updatedAt 초기값은 persist 시 Hibernate(@Version)에 위임 — 여기서 set 하지 않는다.
    }

    companion object {
        const val EMPTY_DOC_JSON: String = """{"type":"doc","content":[]}"""
    }
}
