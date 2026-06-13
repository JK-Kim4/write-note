package com.writenote.repository

import com.writenote.entity.Document
import com.writenote.entity.Project
import com.writenote.entity.User
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DocumentRepositoryIT
    @Autowired
    constructor(
        private val documentRepository: DocumentRepository,
        private val projectRepository: ProjectRepository,
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `insert document with default body then read back`() {
            val owner =
                userRepository.save(
                    User(email = "doc-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project with doc"))
            val saved = documentRepository.save(Document(projectId = project.id!!))

            entityManager.flush()
            entityManager.clear()

            val found = documentRepository.findById(saved.id!!).orElseThrow()
            assertThat(found.projectId).isEqualTo(project.id)
            assertThat(found.title).isEqualTo("")
            assertThat(found.body).contains("\"type\"")
            assertThat(found.body).contains("\"doc\"")
            assertThat(found.body).contains("\"content\"")
            assertThat(found.body).contains("[]")
            assertThat(found.wordCount).isZero()
            assertThat(found.createdAt).isNotNull()
            assertThat(found.updatedAt).isNotNull()
        }

        @Test
        fun `find by project id returns active document`() {
            val owner =
                userRepository.save(
                    User(email = "doc2-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project lookup"))
            documentRepository.save(Document(projectId = project.id!!))

            entityManager.flush()
            entityManager.clear()

            val found =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(project.id!!)
                    .firstOrNull()
            assertThat(found).isNotNull
            assertThat(found!!.projectId).isEqualTo(project.id)
        }

        @Test
        fun `cascade delete removes document when project is deleted`() {
            val owner =
                userRepository.save(
                    User(email = "doc3-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project to delete"))
            documentRepository.save(Document(projectId = project.id!!))

            entityManager.flush()
            entityManager.clear()

            assertThat(
                documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(project.id!!),
            ).isNotEmpty

            projectRepository.deleteById(project.id!!)
            entityManager.flush()
            entityManager.clear()

            assertThat(
                documentRepository.findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(project.id!!),
            ).isEmpty()
        }
    }
