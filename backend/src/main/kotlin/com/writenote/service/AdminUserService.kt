package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.response.AdminUserResponse
import com.writenote.model.response.PageResponse
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.springframework.data.domain.PageRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 운영 툴 회원 조회(030 US2) — 읽기 전용. 작품 수는 그룹 카운트로 N+1 회피. 비밀값 미노출.
 */
@Service
class AdminUserService(
    private val userRepository: UserRepository,
    private val projectRepository: ProjectRepository,
) {
    @Transactional(readOnly = true)
    fun listUsers(
        page: Int,
        size: Int,
        query: String?,
    ): PageResponse<AdminUserResponse> {
        require(page >= 0) { "page must be greater than or equal to 0" }
        require(size in 1..100) { "size must be between 1 and 100" }
        val pageable = PageRequest.of(page, size)
        val term = query?.trim().orEmpty()
        val users =
            if (term.isEmpty()) {
                userRepository.findAllByOrderByCreatedAtDesc(pageable)
            } else {
                userRepository.findByEmailContainingIgnoreCaseOrderByCreatedAtDesc(term, pageable)
            }
        val counts = projectCounts(users.content.mapNotNull { it.id })
        return PageResponse.from(users.map { toResponse(it, counts[it.id] ?: 0L) })
    }

    @Transactional(readOnly = true)
    fun getUser(id: Long): AdminUserResponse {
        val user =
            userRepository
                .findById(id)
                .orElseThrow { ResourceNotFoundException("User not found") }
        val count = projectCounts(listOf(id))[id] ?: 0L
        return toResponse(user, count)
    }

    private fun projectCounts(userIds: List<Long>): Map<Long, Long> =
        if (userIds.isEmpty()) {
            emptyMap()
        } else {
            projectRepository.countByUserIds(userIds).associate { it.userId to it.cnt }
        }

    private fun toResponse(
        user: User,
        projectCount: Long,
    ): AdminUserResponse =
        AdminUserResponse(
            id = requireNotNull(user.id),
            email = user.email,
            kakaoLinked = user.kakaoId != null,
            emailVerified = user.emailVerifiedAt != null,
            lastLoginAt = user.lastLoginAt,
            createdAt = requireNotNull(user.createdAt),
            projectCount = projectCount,
        )
}
