package com.writenote.service

import com.writenote.entity.Document
import com.writenote.entity.User
import com.writenote.model.request.CreateProjectRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.mockito.kotlin.any
import org.mockito.kotlin.whenever
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import java.time.Instant
import java.util.UUID

/**
 * Document auto-provisioning rollback 회귀 차단 (FR-010 production stack 정합).
 *
 * 본 IT 는 의도적으로 **클래스 레벨 `@Transactional` 미박음** — production stack 의 실제
 * 트랜잭션 흐름 (`ProjectService.createProject` 의 `@Transactional(rollbackFor = [Exception::class])`
 * 안에서 documentRepository.save 가 throw 시 projects INSERT 도 rollback) 재현.
 *
 * 클래스 레벨 `@Transactional` 박은 IT 는 outer 트랜잭션이 inner rollback 검증을 못 잡음
 * — ISSUE-014 LoginLockoutWebTest 패턴 회귀 회피
 * (`~/.claude/rules/kotlin/spring/jpa-test-patterns.md` §3).
 *
 * 격리 = UUID email user + `@AfterEach` cleanup (FK CASCADE 로 자식 행 자동 정리).
 * Document mock 은 `@MockitoBean` 으로 Spring context 안의 빈 교체.
 */
@SpringBootTest
@ActiveProfiles("test")
class ProjectAutoProvisioningFailureIT
    @Autowired
    constructor(
        private val projectService: ProjectService,
        private val projectRepository: ProjectRepository,
        private val userRepository: UserRepository,
        private val passwordEncoder: PasswordEncoder,
    ) {
        @MockitoBean
        private lateinit var documentRepository: DocumentRepository

        private var createdUserId: Long? = null

        private fun savedUser(): User {
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "rollback-${UUID.randomUUID()}@example.com",
                        passwordHash = requireNotNull(passwordEncoder.encode("Pass!1234567")),
                        emailVerifiedAt = Instant.now(),
                    ),
                )
            createdUserId = user.id
            return user
        }

        @AfterEach
        fun cleanup() {
            createdUserId?.let { id ->
                if (userRepository.existsById(id)) {
                    userRepository.deleteById(id)
                }
            }
            createdUserId = null
        }

        @Test
        @DisplayName("documentRepository.save 실패 시 projects 행도 0 (FR-010 production stack rollback)")
        fun `createProject rollback on document save failure`() {
            val user = savedUser()
            whenever(documentRepository.save(any<Document>()))
                .thenThrow(RuntimeException("forced fail"))

            assertThatThrownBy {
                projectService.createProject(
                    requireNotNull(user.id),
                    CreateProjectRequest(title = "rollback-${UUID.randomUUID()}"),
                )
            }.isInstanceOf(RuntimeException::class.java)

            val projects =
                projectRepository.findByUserIdAndArchivedAtIsNullOrderByUpdatedAtDesc(
                    requireNotNull(user.id),
                    PageRequest.of(0, 10),
                )
            assertThat(projects.totalElements).isEqualTo(0)
        }
    }
