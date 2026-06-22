package com.writenote.service

import com.writenote.entity.Character
import com.writenote.entity.Document
import com.writenote.entity.User
import com.writenote.model.request.CreateCategoryRequest
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
        private val categoryService: CategoryService,
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
        @DisplayName("effective 판형/출판방식 — 미분류=기본값, 시리즈 이동 후 시리즈값으로 재해석(033 R2 / FR-022)")
        fun `effective layout resolves from series and re-interprets after move`() {
            val userId = requireNotNull(savedUser().id)
            val created = projectService.createProject(userId, CreateProjectRequest(title = "시리즈 이동 대상"))

            // (a) 미분류 작품 → 시스템 기본값 A4/paper
            assertThat(created.effectivePaperSize).isEqualTo("A4")
            assertThat(created.effectiveLayoutMode).isEqualTo("paper")

            // 시리즈(판형 sinkukpan/web) 생성
            val series =
                categoryService.create(
                    userId,
                    CreateCategoryRequest(name = "웹 시리즈", paperSize = "sinkukpan", layoutMode = "web"),
                )

            entityManager.flush()
            entityManager.clear()

            // (b) 시리즈로 이동 → effective 가 시리즈값으로 재해석
            val moved = projectService.moveCategory(userId, created.id, series.id)
            assertThat(moved.effectivePaperSize).isEqualTo("sinkukpan")
            assertThat(moved.effectiveLayoutMode).isEqualTo("web")

            entityManager.flush()
            entityManager.clear()

            // 단건 재조회도 시리즈값
            val refetched = projectService.getProject(userId, created.id)
            assertThat(refetched.effectivePaperSize).isEqualTo("sinkukpan")
            assertThat(refetched.effectiveLayoutMode).isEqualTo("web")

            // (c) 미분류로 다시 빼면 기본값 fallback
            val unmoved = projectService.moveCategory(userId, created.id, null)
            assertThat(unmoved.effectivePaperSize).isEqualTo("A4")
            assertThat(unmoved.effectiveLayoutMode).isEqualTo("paper")
        }

        @Test
        @DisplayName("effective 판형 — 시리즈 판형 미설정(null) 작품은 시스템 기본값 fallback (FR-021)")
        fun `effective layout falls back to defaults when series unset`() {
            val userId = requireNotNull(savedUser().id)
            val created = projectService.createProject(userId, CreateProjectRequest(title = "판형 미설정 시리즈 작품"))
            // 판형·출판방식 미설정 시리즈
            val series = categoryService.create(userId, CreateCategoryRequest(name = "메타 없는 시리즈"))

            entityManager.flush()
            entityManager.clear()

            val moved = projectService.moveCategory(userId, created.id, series.id)
            assertThat(moved.effectivePaperSize).isEqualTo("A4")
            assertThat(moved.effectiveLayoutMode).isEqualTo("paper")
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
