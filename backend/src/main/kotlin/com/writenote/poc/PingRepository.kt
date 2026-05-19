package com.writenote.poc

import org.springframework.data.jpa.repository.JpaRepository

/**
 * 임시 — Phase 1A 진입 시 폐기 (PoC 0-2 산출물).
 *
 * Spring Data JPA Repository 기본 동작 (save / findById) 검증용.
 */
interface PingRepository : JpaRepository<PingEntity, Long>
