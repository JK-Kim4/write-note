package com.writenote.service

import com.writenote.entity.Character
import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.MemoProjectCharacter
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.error.ResourceNotFoundException
import com.writenote.repository.MemoProjectCharacterRepository
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * US1 (A1 / #36) — 곁쪽지 버리기·되돌리기 상태 전이.
 *
 * soft-delete 시 [Memo.deletedAt] 기록 + 연결행(MemoProject/MemoProjectCharacter) 보존,
 * restore 시 deletedAt 해제 + 연결 복귀. 삭제/복원 멱등, 타 사용자 404.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MemoEditServiceIT
    @Autowired
    constructor(
        private val memoEditService: MemoEditService,
        private val memoQueryService: MemoQueryService,
        private val memoRepository: MemoRepository,
        private val memoProjectRepository: MemoProjectRepository,
        private val memoProjectCharacterRepository: MemoProjectCharacterRepository,
        private val userRepository: com.writenote.repository.UserRepository,
        private val projectRepository: com.writenote.repository.ProjectRepository,
        private val characterRepository: com.writenote.repository.CharacterRepository,
    ) {
        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(email = "edit-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
            )

        private fun linkedMemo(
            userId: Long,
            projectId: Long,
            characterId: Long,
        ): Memo {
            val memo =
                memoRepository.saveAndFlush(
                    Memo(userId = userId, body = "곁쪽지", source = "DESKTOP", capturedAt = Instant.now()),
                )
            val mp = memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = projectId, pinned = true))
            memoProjectCharacterRepository.saveAndFlush(
                MemoProjectCharacter(memoProject = mp, characterId = characterId),
            )
            return memo
        }

        @Test
        @DisplayName("버리기 — deletedAt 기록 + 연결행(MemoProject/MemoProjectCharacter) 보존")
        fun `delete sets deletedAt and preserves connections`() {
            val user = savedUser()
            val project = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설"))
            val character = characterRepository.saveAndFlush(Character(projectId = project.id!!, name = "민지", displayOrder = 0))
            val memo = linkedMemo(user.id!!, project.id!!, character.id!!)

            memoEditService.deleteMemo(userId = user.id!!, memoId = memo.id!!)

            val reloaded = memoRepository.findById(memo.id!!).orElseThrow()
            assertThat(reloaded.deletedAt).isNotNull()
            // 연결행 보존 확인
            assertThat(memoProjectRepository.findAllByMemoId(memo.id!!)).hasSize(1)
            val mpId = memoProjectRepository.findAllByMemoId(memo.id!!).first().id!!
            assertThat(memoProjectCharacterRepository.findAllByMemoProjectId(mpId)).hasSize(1)
        }

        @Test
        @DisplayName("되돌리기 — deletedAt 해제 + 작품 연결 복귀(응답에 프로젝트 포함)")
        fun `restore clears deletedAt and returns connections`() {
            val user = savedUser()
            val project = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설"))
            val character = characterRepository.saveAndFlush(Character(projectId = project.id!!, name = "민지", displayOrder = 0))
            val memo = linkedMemo(user.id!!, project.id!!, character.id!!)
            memoEditService.deleteMemo(userId = user.id!!, memoId = memo.id!!)

            val response = memoEditService.restoreMemo(userId = user.id!!, memoId = memo.id!!)

            assertThat(memoRepository.findById(memo.id!!).orElseThrow().deletedAt).isNull()
            assertThat(response.projects.map { it.projectId }).contains(project.id!!)
        }

        @Test
        @DisplayName("버리기 멱등 — 이미 버려진 메모를 다시 버려도 deletedAt 변동 없음(no-op)")
        fun `delete is idempotent`() {
            val user = savedUser()
            val memo =
                memoRepository.saveAndFlush(
                    Memo(userId = user.id!!, body = "x", source = "DESKTOP", capturedAt = Instant.now()),
                )
            memoEditService.deleteMemo(userId = user.id!!, memoId = memo.id!!)
            val firstDeletedAt = memoRepository.findById(memo.id!!).orElseThrow().deletedAt

            memoEditService.deleteMemo(userId = user.id!!, memoId = memo.id!!)

            assertThat(memoRepository.findById(memo.id!!).orElseThrow().deletedAt).isEqualTo(firstDeletedAt)
        }

        @Test
        @DisplayName("되돌리기 멱등 — 버려지지 않은 메모 restore 도 성공(no-op)")
        fun `restore on non-deleted is idempotent`() {
            val user = savedUser()
            val memo =
                memoRepository.saveAndFlush(
                    Memo(userId = user.id!!, body = "x", source = "DESKTOP", capturedAt = Instant.now()),
                )

            val response = memoEditService.restoreMemo(userId = user.id!!, memoId = memo.id!!)

            assertThat(response.id).isEqualTo(memo.id!!)
            assertThat(memoRepository.findById(memo.id!!).orElseThrow().deletedAt).isNull()
        }

        @Test
        @DisplayName("버려진 메모 단건 조회 404 — getMemo 는 삭제된 메모를 못 본다")
        fun `getMemo returns 404 for deleted memo`() {
            val user = savedUser()
            val memo =
                memoRepository.saveAndFlush(
                    Memo(userId = user.id!!, body = "x", source = "DESKTOP", capturedAt = Instant.now()),
                )
            memoEditService.deleteMemo(userId = user.id!!, memoId = memo.id!!)

            assertThrows<ResourceNotFoundException> {
                memoQueryService.getMemo(userId = user.id!!, memoId = memo.id!!)
            }
        }

        @Test
        @DisplayName("타 사용자 버리기·되돌리기 거부 — 404")
        fun `cross user delete and restore are rejected`() {
            val owner = savedUser()
            val other = savedUser()
            val memo =
                memoRepository.saveAndFlush(
                    Memo(userId = owner.id!!, body = "x", source = "DESKTOP", capturedAt = Instant.now()),
                )

            assertThrows<ResourceNotFoundException> {
                memoEditService.deleteMemo(userId = other.id!!, memoId = memo.id!!)
            }
            assertThrows<ResourceNotFoundException> {
                memoEditService.restoreMemo(userId = other.id!!, memoId = memo.id!!)
            }
        }
    }
