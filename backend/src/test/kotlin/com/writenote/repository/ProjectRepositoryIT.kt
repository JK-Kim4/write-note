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
        fun `insert flush clear and select active projects by owner`() {
            val owner =
                userRepository.save(
                    User(email = "owner-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val otherUser =
                userRepository.save(
                    User(email = "other-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val activeProject = projectRepository.save(Project(userId = owner.id!!, title = "Active project"))
            val archivedProject = projectRepository.save(Project(userId = owner.id!!, title = "Archived project", archived = true))
            projectRepository.save(Project(userId = otherUser.id!!, title = "Other project"))

            entityManager.flush()
            entityManager.clear()

            val found = projectRepository.findByIdAndUserIdAndArchivedFalse(activeProject.id!!, owner.id!!).orElseThrow()
            val activePage =
                projectRepository.findByUserIdAndArchivedFalseOrderByUpdatedAtDesc(
                    owner.id!!,
                    PageRequest.of(0, 10),
                )

            assertThat(found.title).isEqualTo("Active project")
            assertThat(found.createdAt).isNotNull()
            assertThat(found.updatedAt).isNotNull()
            assertThat(activePage.content.map { project -> project.id }).containsExactly(activeProject.id)
            assertThat(projectRepository.findByIdAndUserIdAndArchivedFalse(archivedProject.id!!, owner.id!!)).isEmpty()
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

            assertThat(projectRepository.findByIdAndUserIdAndArchivedFalse(project.id!!, otherUser.id!!)).isEmpty()
        }
    }
