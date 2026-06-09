package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import java.time.Instant

/**
 * 작업 세션(집필 시간 구간) — desktop work_sessions 이식. 작품 소유권 경유 격리.
 *
 * [endedAt] = null 이면 열린 세션. 작품당 열린 세션 1개 불변식(partial unique uq_work_session_open).
 */
@Entity
@Table(name = "work_sessions")
class WorkSession(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "project_id", nullable = false)
    var projectId: Long = 0,
    @Column(name = "started_at", nullable = false, updatable = false)
    var startedAt: Instant? = null,
    @Column(name = "ended_at")
    var endedAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (startedAt == null) {
            startedAt = Instant.now()
        }
    }
}
