package com.writenote.repository

import com.writenote.entity.Project
import com.writenote.entity.User
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
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
