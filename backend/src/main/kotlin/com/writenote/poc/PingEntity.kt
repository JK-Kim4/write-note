package com.writenote.poc

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.Table
import java.time.Instant

/**
 * 임시 — Phase 1A 진입 시 폐기 (PoC 0-2 산출물).
 *
 * Spring Boot 4.0.6 + Java 25 + PostgreSQL 17 + Flyway 연결 검증용 단순 엔티티.
 * Flyway V1__create_ping.sql 이 schema 생성, JPA 는 validate.
 */
@Entity
@Table(name = "ping")
class PingEntity(
    @Column(name = "message", nullable = false, length = 100)
    val message: String,
) {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    var id: Long? = null
        protected set

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    var createdAt: Instant? = null
        protected set
}
