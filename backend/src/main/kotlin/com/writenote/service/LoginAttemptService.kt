package com.writenote.service

import com.writenote.repository.UserRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Duration
import java.time.Instant

@Service
class LoginAttemptService(
    private val userRepository: UserRepository,
) {
    /**
     * 로그인 실패 누적 기록 (FR-013, FR-038).
     *
     * 1. pessimistic lock 으로 user row 획득 (동시 실패 결정성, research.md R-5)
     * 2. 만료된 lockout 감지 시 count 초기화 (잠금 만료 후 첫 실패 = count 1)
     * 3. count++ + 5회 도달 시 lockout_until = now + 30min
     *
     * 사용자 미존재 시 silent return — 이메일 존재 여부 노출 회피.
     */
    @Transactional(rollbackFor = [Exception::class])
    fun recordFailure(email: String) {
        val user = userRepository.findByEmailForUpdate(email) ?: return
        val currentLockout = user.lockoutUntil
        if (currentLockout != null && currentLockout.isBefore(Instant.now())) {
            user.failedLoginCount = 0
            user.lockoutUntil = null
        }
        user.failedLoginCount += 1
        if (user.failedLoginCount >= MAX_FAILED_ATTEMPTS) {
            user.lockoutUntil = Instant.now().plus(LOCKOUT_DURATION)
        }
    }

    /**
     * 로그인 성공 — 누적 카운트 초기화 + lastLoginAt 갱신 (FR-014).
     */
    @Transactional(rollbackFor = [Exception::class])
    fun recordSuccess(email: String) {
        val user = userRepository.findByEmailForUpdate(email) ?: return
        user.failedLoginCount = 0
        user.lockoutUntil = null
        user.lastLoginAt = Instant.now()
    }

    /**
     * 잠금 상태 검증 — lockout_until > now 면 true (FR-015).
     *
     * LoginAttemptFilter 가 호출 (controller 진입 전 차단).
     */
    @Transactional(readOnly = true)
    fun isLocked(email: String): Boolean {
        val user = userRepository.findByEmail(email) ?: return false
        val lockoutUntil = user.lockoutUntil ?: return false
        return lockoutUntil.isAfter(Instant.now())
    }

    companion object {
        private const val MAX_FAILED_ATTEMPTS = 5
        private val LOCKOUT_DURATION = Duration.ofMinutes(30)
    }
}
