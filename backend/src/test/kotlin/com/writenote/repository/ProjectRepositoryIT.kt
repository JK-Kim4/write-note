package com.writenote.repository

import com.writenote.entity.Project
import com.writenote.entity.User
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.hibernate.SessionFactory
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class ProjectRepositoryIT
    @Autowired
    constructor(
        private val projectRepository: ProjectRepository,
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `active list excludes archived projects`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val otherUser =
                userRepository.save(
                    User(email = "other-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val activeProject = projectRepository.save(Project(userId = owner.id!!, title = "Active project"))
            val archivedProject =
                projectRepository.save(
                    Project(userId = owner.id!!, title = "Archived project", archivedAt = Instant.now()),
                )
            projectRepository.save(Project(userId = otherUser.id!!, title = "Other project"))

            entityManager.flush()
            entityManager.clear()

            val found = projectRepository.findByIdAndUserId(activeProject.id!!, owner.id!!).orElseThrow()
            val activePage =
                projectRepository.findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(owner.id!!, PageRequest.of(0, 10))
            val archivedPage =
                projectRepository.findByUserIdAndArchivedAtIsNotNullOrderByArchivedAtDesc(owner.id!!, PageRequest.of(0, 10))

            assertThat(found.title).isEqualTo("Active project")
            assertThat(found.createdAt).isNotNull()
            assertThat(found.updatedAt).isNotNull()
            assertThat(activePage.content.map { it.id }).containsExactly(activeProject.id)
            assertThat(archivedPage.content.map { it.id }).containsExactly(archivedProject.id)
        }

        @Test
        fun `findByIdAndUserId returns project regardless of archived state`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val archivedProject =
                projectRepository.save(
                    Project(userId = owner.id!!, title = "Archived single", archivedAt = Instant.now()),
                )

            entityManager.flush()
            entityManager.clear()

            val found = projectRepository.findByIdAndUserId(archivedProject.id!!, owner.id!!).orElseThrow()
            assertThat(found.archivedAt).isNotNull()
        }

        @Test
        fun `owner scoped lookup hides another users project`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val otherUser =
                userRepository.save(
                    User(email = "other-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Scoped project"))

            entityManager.flush()
            entityManager.clear()

            assertThat(projectRepository.findByIdAndUserId(project.id!!, otherUser.id!!)).isEmpty()
        }

        @Test
        @DisplayName("N+1 회피 — 활성 목록 조회 시 메인 SELECT 1 + COUNT 1 외 추가 쿼리 0 (FR-019 / SC-009)")
        fun `active list query avoids N+1`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            repeat(5) { idx ->
                projectRepository.save(Project(userId = owner.id!!, title = "Project $idx"))
            }
            entityManager.flush()
            entityManager.clear()

            val sessionFactory = entityManager.entityManagerFactory.unwrap(SessionFactory::class.java)
            sessionFactory.statistics.clear()

            val page =
                projectRepository.findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(
                    owner.id!!,
                    PageRequest.of(0, 10),
                )
            assertThat(page.content).hasSize(5)

            // 페이지네이션 = SELECT content 1 + COUNT 1. N+1 발생 시 3+ 박힘
            assertThat(sessionFactory.statistics.prepareStatementCount).isLessThanOrEqualTo(2)
        }

        @Test
        fun `metadata 5 fields persist after flush clear`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project =
                projectRepository.save(
                    Project(
                        userId = owner.id!!,
                        title = "Full metadata draft",
                        genre = "치유물",
                        targetLength = 4000,
                        toneNotes = "잔잔, 회상",
                        synopsis = "할머니와 손녀의 마지막 여름 카페 대화",
                        worldNotes = "1990년대 후반 서울 변두리",
                    ),
                )

            entityManager.flush()
            entityManager.clear()

            val found = projectRepository.findByIdAndUserId(project.id!!, owner.id!!).orElseThrow()
            assertThat(found.title).isEqualTo("Full metadata draft")
            assertThat(found.genre).isEqualTo("치유물")
            assertThat(found.targetLength).isEqualTo(4000)
            assertThat(found.toneNotes).isEqualTo("잔잔, 회상")
            assertThat(found.synopsis).isEqualTo("할머니와 손녀의 마지막 여름 카페 대화")
            assertThat(found.worldNotes).isEqualTo("1990년대 후반 서울 변두리")
            assertThat(found.archivedAt).isNull()
        }
    }
