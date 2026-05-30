package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.FetchType
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.JoinColumn
import jakarta.persistence.ManyToOne
import jakarta.persistence.OneToMany
import jakarta.persistence.PrePersist
import jakarta.persistence.PreUpdate
import jakarta.persistence.Table
import org.hibernate.annotations.JdbcTypeCode
import org.hibernate.type.SqlTypes
import java.time.Instant

@Entity
@Table(name = "memos")
class Memo(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "user_id", nullable = false)
    var userId: Long = 0,
    @Column(nullable = false, columnDefinition = "TEXT")
    var body: String = "",
    /** 'MOBILE' 또는 'DESKTOP' — 캡처 출처 */
    @Column(nullable = false, length = 16)
    var source: String = "",
    /** 서버 도착 시각 */
    @Column(name = "captured_at", nullable = false)
    var capturedAt: Instant? = null,
    /** 데스크탑 캡처 시 활성 프로젝트 ID (nullable) */
    @Column(name = "active_project_at_capture")
    var activeProjectAtCapture: Long? = null,
    @Column(name = "reason_note", columnDefinition = "TEXT")
    var reasonNote: String? = null,
    /** Postgres TEXT[] 배열 매핑 */
    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "tags", nullable = false, columnDefinition = "text[]")
    var tags: List<String> = emptyList(),
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
    @Column(name = "updated_at", nullable = false)
    var updatedAt: Instant? = null,
) {
    /** active_project_at_capture 의 Project entity (LAZY, nullable) */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "active_project_at_capture", insertable = false, updatable = false)
    var activeProject: Project? = null

    /** 큐레이션된 프로젝트 연결 목록 (LAZY, N+1 JOIN FETCH 대상) */
    @OneToMany(mappedBy = "memo", fetch = FetchType.LAZY)
    var memoProjects: List<MemoProject> = emptyList()

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
