package com.writenote.repository

import com.writenote.entity.Character
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
class CharacterRepositoryIT
    @Autowired
    constructor(
        private val characterRepository: CharacterRepository,
        private val projectRepository: ProjectRepository,
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `order by display_order asc then created_at asc`() {
            val owner =
                userRepository.save(
                    User(email = "char-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project for characters"))

            val a = characterRepository.save(Character(projectId = project.id!!, name = "민지", displayOrder = 1))
            val b = characterRepository.save(Character(projectId = project.id!!, name = "할머니", displayOrder = 0))
            val c =
                characterRepository.save(
                    Character(projectId = project.id!!, name = "옆집 아저씨", displayOrder = 0),
                )

            entityManager.flush()
            entityManager.clear()

            val ordered = characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(project.id!!)
            assertThat(ordered.map { it.id }).containsExactly(b.id, c.id, a.id)
        }

        @Test
        fun `find by id and project id returns owned character`() {
            val owner =
                userRepository.save(
                    User(email = "char2-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val projectA = projectRepository.save(Project(userId = owner.id!!, title = "Project A"))
            val projectB = projectRepository.save(Project(userId = owner.id!!, title = "Project B"))
            val charA = characterRepository.save(Character(projectId = projectA.id!!, name = "A's character"))

            entityManager.flush()
            entityManager.clear()

            assertThat(characterRepository.findByIdAndProjectId(charA.id!!, projectA.id!!)).isPresent
            assertThat(characterRepository.findByIdAndProjectId(charA.id!!, projectB.id!!)).isEmpty
        }

        @Test
        fun `cascade delete removes characters when project is deleted`() {
            val owner =
                userRepository.save(
                    User(email = "char3-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project to delete"))
            characterRepository.save(Character(projectId = project.id!!, name = "char1"))
            characterRepository.save(Character(projectId = project.id!!, name = "char2"))

            entityManager.flush()
            entityManager.clear()

            assertThat(characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(project.id!!)).hasSize(2)

            projectRepository.deleteById(project.id!!)
            entityManager.flush()
            entityManager.clear()

            assertThat(characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(project.id!!)).isEmpty()
        }

        @Test
        fun `page query respects pageable`() {
            val owner =
                userRepository.save(
                    User(email = "char4-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
                )
            val project = projectRepository.save(Project(userId = owner.id!!, title = "Project paged"))
            repeat(5) { idx -> characterRepository.save(Character(projectId = project.id!!, name = "char-$idx", displayOrder = idx)) }

            entityManager.flush()
            entityManager.clear()

            val firstPage =
                characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(project.id!!, PageRequest.of(0, 3))
            assertThat(firstPage.content).hasSize(3)
            assertThat(firstPage.totalElements).isEqualTo(5)
        }
    }
