package com.writenote.model.response

/** 운영 툴 통계 카운트(030 US3). */
data class AdminStatsSummaryResponse(
    val totalUsers: Long,
    val newUsersToday: Long,
    val newUsersThisWeek: Long,
    val activeUsers: Long,
    val totalProjects: Long,
)

/** 일별 가입 수 한 점(030 US3) — date = KST 일자(YYYY-MM-DD). */
data class SignupPoint(
    val date: String,
    val count: Long,
)

/** 가입 추이(030 US3) — 빈 날 0 포함, 연속 days 개. */
data class SignupTrendResponse(
    val points: List<SignupPoint>,
)
