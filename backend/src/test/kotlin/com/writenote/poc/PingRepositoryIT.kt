package com.writenote.poc

import jakarta.persistence.EntityManager
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.transaction.annotation.Transactional
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/**
 * 임시 — Phase 1A 진입 시 폐기 (PoC 0-2 산출물).
 *
 * Spring Boot 4.0.6 + Java 24 toolchain + Kotlin 2.2 + PostgreSQL 17 + Flyway 전체 흐름 검증:
 * 1. ApplicationContext 기동 (datasource / Flyway / JPA EntityManager bean)
 * 2. Flyway V1__create_ping.sql 적용
 * 3. INSERT (save) + flush + clear + SELECT (findById) — 1차 캐시 우회로 실제 SELECT 강제
 * 4. DB 측 default (NOW()) 가 created_at 채움
 *
 * `@Transactional` 로 테스트 rollback — external-infra-safety.md §1 예외 정합.
 */
@SpringBootTest
@Transactional
class PingRepositoryIT
    @Autowired
    constructor(
        private val pingRepository: PingRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        @DisplayName("Postgres 연결 — Ping INSERT + SELECT 검증")
        fun `Postgres 연결 검증`() {
            val ping = PingEntity(message = "hello write-note")

            val saved = pingRepository.save(ping)
            val id = assertNotNull(saved.id)

            entityManager.flush()
            entityManager.clear()

            val fetched = pingRepository.findById(id).orElseThrow()
            assertEquals("hello write-note", fetched.message)
            assertNotNull(fetched.createdAt)
        }
    }
