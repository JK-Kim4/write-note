package com.writenote.repository

import com.writenote.entity.User
import jakarta.persistence.LockModeType
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import java.time.Instant

/** 운영 툴 통계(030 US3) — KST 일자별 가입 수 projection(네이티브). */
interface SignupDailyCount {
    val day: String
    val cnt: Long
}

interface UserRepository : JpaRepository<User, Long> {
    fun existsByEmail(email: String): Boolean

    fun findByEmail(email: String): User?

    fun findByKakaoId(kakaoId: String): User?

    /** 운영 툴 회원 목록(030 US2) — 가입일 최신순. */
    fun findAllByOrderByCreatedAtDesc(pageable: Pageable): Page<User>

    /** 운영 툴 회원 검색(030 US2) — 이메일 부분일치(대소문자 무시), 가입일 최신순. */
    fun findByEmailContainingIgnoreCaseOrderByCreatedAtDesc(
        email: String,
        pageable: Pageable,
    ): Page<User>

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT u FROM User u WHERE u.email = :email")
    fun findByEmailForUpdate(email: String): User?

    /** 운영 툴 통계(030 US3) — 가입/활성 카운트. */
    fun countByCreatedAtGreaterThanEqual(since: Instant): Long

    fun countByLastLoginAtGreaterThanEqual(since: Instant): Long

    /** KST 일자별 가입 수(빈 날 제외) — 서비스가 0 채움. */
    @Query(
        nativeQuery = true,
        value =
            "SELECT to_char((created_at AT TIME ZONE 'Asia/Seoul')::date, 'YYYY-MM-DD') AS day, " +
                "COUNT(*) AS cnt FROM users WHERE created_at >= :since GROUP BY day",
    )
    fun signupCountsByDay(since: Instant): List<SignupDailyCount>
}
