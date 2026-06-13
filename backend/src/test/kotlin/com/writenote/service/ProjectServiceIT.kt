package com.writenote.service

import com.writenote.entity.Character
import com.writenote.entity.Document
import com.writenote.entity.User
import com.writenote.model.request.CreateProjectRequest
import com.writenote.repository.CharacterRepository
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.kotlinModule
import java.time.Instant
import java.util.UUID

/**
 * Project 생성 시 Document 자동 행 happy 경로 (FR-009 / US3).
 *
 * 클래스 레벨 `@Transactional` 박음 — 표준 fixture (자동 rollback). research R-7 정합
 * (본 spec 영역에 REQUIRES_NEW / AFTER_COMMIT 흐름 없음). failure rollback 검증은
 * 별도 비-transactional IT (ProjectAutoProvisioningFailureIT) 에서 박음.
 *
 * JPA 1차 캐시 우회 — `EntityManager.flush() + clear()` 후 SELECT
 * (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md` §1).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProjectServiceIT
    @Autowired
    constructor(
        private val projectService: ProjectService,
        private val projectRepository: ProjectRepository,
        private val userRepository: UserRepository,
        private val documentRepository: DocumentRepository,
        private val characterRepository: CharacterRepository,
        private val passwordEncoder: PasswordEncoder,
        private val entityManager: EntityManager,
    ) {
        private val jsonMapper: JsonMapper = JsonMapper.builder().addModule(kotlinModule()).build()

        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "doc-auto-${UUID.randomUUID()}@example.com",
                    passwordHash = requireNotNull(passwordEncoder.encode("Pass!1234567")),
                    emailVerifiedAt = Instant.now(),
                ),
            )

        @Test
        @DisplayName("createProject 성공 — documents 1:1 행 + body default JSON (FR-009)")
        fun `createProject auto-provisions document row with defaults`() {
            val user = savedUser()
            val request =
                CreateProjectRequest(
                    title = "Phase 5 dogfooding",
                    genre = "치유물",
                    targetLength = 4000,
                    toneNotes = "잔잔",
                    synopsis = "할머니",
                    worldNotes = "1990s",
                )

            val response = projectService.createProject(requireNotNull(user.id), request)

            entityManager.flush()
            entityManager.clear()

            val document =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(response.id)
                    .first()
            assertThat(document.projectId).isEqualTo(response.id)
            assertThat(document.title).isEqualTo("")
            // Postgres JSONB roundtrip 시 공백 normalize — 의미 동등 비교 의무
            assertThat(jsonMapper.readTree(document.body))
                .isEqualTo(jsonMapper.readTree(Document.EMPTY_DOC_JSON))
            assertThat(document.wordCount).isEqualTo(0)
            assertThat(document.createdAt).isNotNull()
            assertThat(document.updatedAt).isNotNull()
        }

        @Test
        @DisplayName("deleteProject — cascade 로 characters / documents 모두 0행 (FR-007/011 / SC-002)")
        fun `deleteProject cascades to characters and documents`() {
            val user = savedUser()
            val response =
                projectService.createProject(
                    requireNotNull(user.id),
                    CreateProjectRequest(title = "cascade test"),
                )
            val projectId = response.id

            // 인물 3명 추가
            listOf("민지", "할머니", "옆집").forEach { name ->
                characterRepository.saveAndFlush(
                    Character(
                        projectId = projectId,
                        name = name,
                        displayOrder = 0,
                    ),
                )
            }
            entityManager.flush()
            entityManager.clear()

            // 삭제 전 sanity check
            assertThat(
                characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId),
            ).hasSize(3)
            assertThat(
                documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId),
            ).isNotEmpty

            // 영구 삭제
            projectService.deleteProject(requireNotNull(user.id), projectId)
            entityManager.flush()
            entityManager.clear()

            // cascade 검증 — DB FK ON DELETE CASCADE (research R-5)
            assertThat(projectRepository.findById(projectId)).isEmpty
            assertThat(
                characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(projectId),
            ).isEmpty()
            assertThat(
                documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectId),
            ).isEmpty()
        }
    }
