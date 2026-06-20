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
import jakarta.persistence.Table
import java.time.Instant

/** Memo ↔ Project M:N 연결 엔티티. */
@Entity
@Table(name = "memo_projects")
class MemoProject(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "memo_id", nullable = false)
    var memo: Memo,
    @Column(name = "project_id", nullable = false)
    var projectId: Long = 0,
    @Column(nullable = false)
    var pinned: Boolean = false,
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
) {
    /** 연결된 인물 목록 (LAZY, SET — MultipleBagFetchException 우회) */
    @OneToMany(mappedBy = "memoProject", fetch = FetchType.LAZY)
    var characters: Set<MemoProjectCharacter> = emptySet()

    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
    }
}
