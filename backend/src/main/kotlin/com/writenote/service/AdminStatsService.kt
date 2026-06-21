package com.writenote.service

import com.writenote.model.response.AdminStatsSummaryResponse
import com.writenote.model.response.SignupPoint
import com.writenote.model.response.SignupTrendResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.DayOfWeek
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * 운영 툴 사용 현황 통계(030 US3) — 읽기 전용. 일자 경계는 KST 기준.
 */
@Service
class AdminStatsService(
    private val userRepository: UserRepository,
    private val projectRepository: ProjectRepository,
) {
    @Transactional(readOnly = true)
    fun summary(): AdminStatsSummaryResponse {
        val todayStart = LocalDate.now(KST).atStartOfDay(KST).toInstant()
        val weekStart =
            LocalDate
                .now(KST)
                .with(DayOfWeek.MONDAY)
                .atStartOfDay(KST)
                .toInstant()
        val activeSince = Instant.now().minus(ACTIVE_DAYS, ChronoUnit.DAYS)
        return AdminStatsSummaryResponse(
            totalUsers = userRepository.count(),
            newUsersToday = userRepository.countByCreatedAtGreaterThanEqual(todayStart),
            newUsersThisWeek = userRepository.countByCreatedAtGreaterThanEqual(weekStart),
            activeUsers = userRepository.countByLastLoginAtGreaterThanEqual(activeSince),
            totalProjects = projectRepository.count(),
        )
    }

    @Transactional(readOnly = true)
    fun signups(days: Int): SignupTrendResponse {
        require(days in 1..90) { "days must be between 1 and 90" }
        val startDate = LocalDate.now(KST).minusDays((days - 1).toLong())
        val since = startDate.atStartOfDay(KST).toInstant()
        val byDay = userRepository.signupCountsByDay(since).associate { it.day to it.cnt }
        val points =
            (0 until days).map { offset ->
                val date = startDate.plusDays(offset.toLong()).toString()
                SignupPoint(date = date, count = byDay[date] ?: 0L)
            }
        return SignupTrendResponse(points)
    }

    private companion object {
        val KST: ZoneId = ZoneId.of("Asia/Seoul")
        const val ACTIVE_DAYS = 7L
    }
}
