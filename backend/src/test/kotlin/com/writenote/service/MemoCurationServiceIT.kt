package com.writenote.service

import com.writenote.entity.Character
import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.error.ValidationException
import com.writenote.model.request.CurateMemoRequest
import com.writenote.model.request.ProjectConnectionDto
import com.writenote.repository.CharacterRepository
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * T050 — 큐레이션 차이 계산 + 단일 트랜잭션 IT.
 *
 * TDD HARD-GATE: add/remove 차이 계산이 단일 트랜잭션으로 실행되는지 검증.
 * MemoProject/MemoProjectCharacter 의 실제 DB 상태를 flush+clear 후 검증.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MemoCurationServiceIT
    @Autowired
    constructor(
        private val memoCurationService: MemoCurationService,
        private val memoRepository: MemoRepository,
        private val memoProjectRepository: MemoProjectRepository,
        private val userRepository: UserRepository,
        private val projectRepository: ProjectRepository,
        private val characterRepository: CharacterRepository,
        private val entityManager: EntityManager,
    ) {
        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "curation-${UUID.randomUUID()}@example.com",
                    passwordHash = "test-fixture-password-hash",
                    emailVerifiedAt = Instant.now(),
                ),
            )

        private fun savedMemo(userId: Long): Memo =
            memoRepository.saveAndFlush(
                Memo(
                    userId = userId,
                    body = "큐레이션 테스트 메모",
                    source = "DESKTOP",
                    capturedAt = Instant.now(),
                ),
            )

        @Test
        @DisplayName("큐레이션 최초 연결 — MemoProject + MemoProjectCharacter 신규 생성")
        fun `curate adds new project connection with characters`() {
            val user = savedUser()
            val memo = savedMemo(user.id!!)
            val project = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            val char1 =
                characterRepository.saveAndFlush(
                    Character(projectId = project.id!!, name = "민지", displayOrder = 0),
                )

            val request =
                CurateMemoRequest(
                    projectConnections =
                        listOf(
                            ProjectConnectionDto(
                                projectId = project.id!!,
                                characterIds = listOf(char1.id!!),
                            ),
                        ),
                    tags = listOf("draft", "캐릭터"),
                    reasonNote = "민지 첫 등장",
                )

            val response = memoCurationService.curate(userId = user.id!!, memoId = memo.id!!, request = request)

            entityManager.flush()
            entityManager.clear()

            assertThat(response.projects).hasSize(1)
            assertThat(response.projects[0].projectId).isEqualTo(project.id!!)
            assertThat(response.projects[0].characters).hasSize(1)
            assertThat(response.projects[0].characters[0].characterId).isEqualTo(char1.id!!)
            assertThat(response.tags).containsExactlyInAnyOrder("draft", "캐릭터")
            assertThat(response.reasonNote).isEqualTo("민지 첫 등장")

            val memoProjects = memoProjectRepository.findAllByMemoId(memo.id!!)
            assertThat(memoProjects).hasSize(1)
        }

        @Test
        @DisplayName("큐레이션 갱신 — 기존 연결 제거 + 신규 연결 추가 (add/remove 차이 계산)")
        fun `curate replaces existing connections by diff`() {
            val user = savedUser()
            val memo = savedMemo(user.id!!)
            val projectA = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            val projectB = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 B"))

            // 초기 상태: memo → projectA 연결
            val existingMp = memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = projectA.id!!))
            entityManager.flush()
            entityManager.clear()

            // 요청: projectA 제거, projectB 추가
            val request =
                CurateMemoRequest(
                    projectConnections =
                        listOf(
                            ProjectConnectionDto(projectId = projectB.id!!, characterIds = emptyList()),
                        ),
                    tags = listOf("갱신"),
                    reasonNote = null,
                )

            memoCurationService.curate(userId = user.id!!, memoId = memo.id!!, request = request)
            entityManager.flush()
            entityManager.clear()

            val memoProjects = memoProjectRepository.findAllByMemoId(memo.id!!)
            val projectIds = memoProjects.map { it.projectId }
            assertThat(projectIds).doesNotContain(projectA.id!!)
            assertThat(projectIds).contains(projectB.id!!)
        }

        @Test
        @DisplayName("큐레이션 미분류 — projectConnections:[] 로 모든 연결 제거")
        fun `curate with empty projectConnections removes all connections`() {
            val user = savedUser()
            val memo = savedMemo(user.id!!)
            val project = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = project.id!!))
            entityManager.flush()
            entityManager.clear()

            val request =
                CurateMemoRequest(
                    projectConnections = emptyList(),
                    tags = emptyList(),
                    reasonNote = null,
                )

            memoCurationService.curate(userId = user.id!!, memoId = memo.id!!, request = request)
            entityManager.flush()
            entityManager.clear()

            val memoProjects = memoProjectRepository.findAllByMemoId(memo.id!!)
            assertThat(memoProjects).isEmpty()
        }

        @Test
        @DisplayName("인물-프로젝트 불일치 — 400 ValidationException (단일 트랜잭션 롤백)")
        fun `curate throws ValidationException when character does not belong to project`() {
            val user = savedUser()
            val memo = savedMemo(user.id!!)
            val projectA = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            val projectB = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 B"))
            val charOfB =
                characterRepository.saveAndFlush(
                    Character(projectId = projectB.id!!, name = "다른 소설 인물", displayOrder = 0),
                )
            entityManager.flush()
            entityManager.clear()

            // projectA 에 projectB 소속 인물 연결 시도 → VALIDATION_FAILED
            val request =
                CurateMemoRequest(
                    projectConnections =
                        listOf(
                            ProjectConnectionDto(
                                projectId = projectA.id!!,
                                characterIds = listOf(charOfB.id!!),
                            ),
                        ),
                    tags = emptyList(),
                    reasonNote = null,
                )

            assertThatThrownBy {
                memoCurationService.curate(userId = user.id!!, memoId = memo.id!!, request = request)
            }.isInstanceOf(ValidationException::class.java)
        }

        @Test
        @DisplayName("다중 프로젝트 연결 — 모두 유효하면 단일 트랜잭션으로 저장")
        fun `curate multiple projects in single transaction`() {
            val user = savedUser()
            val memo = savedMemo(user.id!!)
            val projectA = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            val projectB = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 B"))
            val charA =
                characterRepository.saveAndFlush(
                    Character(projectId = projectA.id!!, name = "민지", displayOrder = 0),
                )
            val charB =
                characterRepository.saveAndFlush(
                    Character(projectId = projectB.id!!, name = "할머니", displayOrder = 0),
                )
            entityManager.flush()
            entityManager.clear()

            val request =
                CurateMemoRequest(
                    projectConnections =
                        listOf(
                            ProjectConnectionDto(projectId = projectA.id!!, characterIds = listOf(charA.id!!)),
                            ProjectConnectionDto(projectId = projectB.id!!, characterIds = listOf(charB.id!!)),
                        ),
                    tags = listOf("양쪽"),
                    reasonNote = "두 소설에 모두 등장",
                )

            val response = memoCurationService.curate(userId = user.id!!, memoId = memo.id!!, request = request)
            entityManager.flush()
            entityManager.clear()

            assertThat(response.projects).hasSize(2)
            val projectIds = response.projects.map { it.projectId }
            assertThat(projectIds).containsExactlyInAnyOrder(projectA.id!!, projectB.id!!)

            val memoProjects = memoProjectRepository.findAllByMemoId(memo.id!!)
            assertThat(memoProjects).hasSize(2)
        }

        @Test
        @DisplayName("타인 메모 큐레이션 시도 — 404 (소유 격리)")
        fun `curate throws NotFoundException when memo belongs to other user`() {
            val user = savedUser()
            val otherUser = savedUser()
            val otherMemo = savedMemo(otherUser.id!!)
            entityManager.flush()
            entityManager.clear()

            val request = CurateMemoRequest(projectConnections = emptyList(), tags = emptyList(), reasonNote = null)

            assertThatThrownBy {
                memoCurationService.curate(userId = user.id!!, memoId = otherMemo.id!!, request = request)
            }.isInstanceOf(com.writenote.error.ResourceNotFoundException::class.java)
        }
    }
