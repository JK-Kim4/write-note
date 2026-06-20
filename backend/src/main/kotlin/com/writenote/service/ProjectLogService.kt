package com.writenote.service

import com.writenote.entity.ProjectLog
import com.writenote.error.ResourceNotFoundException
import com.writenote.model.response.ProjectLogResponse
import com.writenote.repository.ProjectLogRepository
import com.writenote.repository.ProjectRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 집필 기록 — 생성/조회. 작품 소유권 경유 격리.
 *
 * 생성 경로 2종(spec R5): 독립 생성(본 service.create) + 세션 종료+기록(WorkSessionService.endWithLog 가 본 service 재사용).
 */
@Service
class ProjectLogService(
    private val projectLogRepository: ProjectLogRepository,
    private val projectRepository: ProjectRepository,
) {
    @Transactional(rollbackFor = [Exception::class])
    fun create(
        userId: Long,
        projectId: Long,
        body: String,
    ): ProjectLogResponse {
        requireOwnedProject(userId, projectId)
        val saved = projectLogRepository.save(ProjectLog(userId = userId, projectId = projectId, body = body.trim()))
        return saved.toResponse()
    }

    @Transactional(readOnly = true)
    fun listByProject(
        userId: Long,
        projectId: Long,
    ): List<ProjectLogResponse> {
        requireOwnedProject(userId, projectId)
        return projectLogRepository.findByProjectIdOrderByCreatedAtDesc(projectId).map { it.toResponse() }
    }

    @Transactional(readOnly = true)
    fun latestByProject(
        userId: Long,
        projectId: Long,
    ): ProjectLogResponse? {
        requireOwnedProject(userId, projectId)
        return projectLogRepository.findFirstByProjectIdOrderByCreatedAtDesc(projectId)?.toResponse()
    }

    private fun requireOwnedProject(
        userId: Long,
        projectId: Long,
    ) {
        projectRepository
            .findByIdAndUserId(projectId, userId)
            .orElseThrow { ResourceNotFoundException("Project not found") }
    }

    private fun ProjectLog.toResponse(): ProjectLogResponse =
        ProjectLogResponse(
            id = requireNotNull(id),
            // 응답은 항상 활성 작품 맥락(create/listByProject) — 분리된(project_id=NULL) 로그는 여기로 오지 않음.
            projectId = requireNotNull(projectId),
            body = body,
            createdAt = requireNotNull(createdAt),
        )
}
