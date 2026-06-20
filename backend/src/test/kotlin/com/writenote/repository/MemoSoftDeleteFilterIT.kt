package com.writenote.repository

import com.writenote.entity.Character
import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.MemoProjectCharacter
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.service.MemoEditService
import com.writenote.service.MemoQueryService
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.data.domain.PageRequest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * US1 (A1 / #36) — 버려진 곁쪽지가 모든 목록 표면에서 제외되는지, 되돌리면 재노출되는지.
 *
 * 표면: 전체목록 / 미분류 / 작품필터 / 인물필터 / 태그 / 검색(q) / 작품서랍(listByProject, 재진입 카드 공용).
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MemoSoftDeleteFilterIT
    @Autowired
    constructor(
        private val memoQueryService: MemoQueryService,
        private val memoEditService: MemoEditService,
        private val memoRepository: MemoRepository,
        private val memoProjectRepository: MemoProjectRepository,
        private val memoProjectCharacterRepository: MemoProjectCharacterRepository,
        private val userRepository: UserRepository,
        private val projectRepository: ProjectRepository,
        private val characterRepository: CharacterRepository,
    ) {
        private val page = PageRequest.of(0, 50)

        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(email = "filter-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
            )

        @Test
        @DisplayName("버린 곁쪽지가 7개 표면 전부에서 제외되고, 되돌리면 재노출된다")
        fun `deleted memo excluded from all surfaces and reappears on restore`() {
            val user = savedUser()
            val uid = user.id!!
            val project = projectRepository.saveAndFlush(Project(userId = uid, title = "소설"))
            val pid = project.id!!
            val character = characterRepository.saveAndFlush(Character(projectId = pid, name = "민지", displayOrder = 0))
            val cid = character.id!!

            // 연결+태그 메모 1 (작품·인물·태그·검색·서랍 표면 검증용)
            val linked =
                memoRepository.saveAndFlush(
                    Memo(userId = uid, body = "검색대상본문", source = "DESKTOP", capturedAt = Instant.now(), tags = listOf("태그A")),
                )
            val mp = memoProjectRepository.saveAndFlush(MemoProject(memo = linked, projectId = pid, pinned = true))
            memoProjectCharacterRepository.saveAndFlush(MemoProjectCharacter(memoProject = mp, characterId = cid))
            // 미분류 메모 1 (unclassified 표면 검증용)
            val unclassified =
                memoRepository.saveAndFlush(
                    Memo(userId = uid, body = "미분류본문", source = "DESKTOP", capturedAt = Instant.now()),
                )

            fun allIds() = memoQueryService.listMemos(uid, false, null, null, null, null, page).content.map { it.id }

            fun unclassifiedIds() = memoQueryService.listMemos(uid, true, null, null, null, null, page).content.map { it.id }

            fun projectIds() = memoQueryService.listMemos(uid, false, pid, null, null, null, page).content.map { it.id }

            fun characterIds() = memoQueryService.listMemos(uid, false, null, cid, null, null, page).content.map { it.id }

            fun tagIds() = memoQueryService.listMemos(uid, false, null, null, "태그A", null, page).content.map { it.id }

            fun queryIds() = memoQueryService.listMemos(uid, false, null, null, null, "검색대상", page).content.map { it.id }

            fun drawerIds() = memoQueryService.listByProject(uid, pid).map { it.memoId }

            // 초기 — 모두 노출
            assertThat(allIds()).contains(linked.id, unclassified.id)
            assertThat(unclassifiedIds()).contains(unclassified.id)
            assertThat(projectIds()).contains(linked.id)
            assertThat(characterIds()).contains(linked.id)
            assertThat(tagIds()).contains(linked.id)
            assertThat(queryIds()).contains(linked.id)
            assertThat(drawerIds()).contains(linked.id)

            // 버리기
            memoEditService.deleteMemo(uid, linked.id!!)
            memoEditService.deleteMemo(uid, unclassified.id!!)

            assertThat(allIds()).doesNotContain(linked.id, unclassified.id)
            assertThat(unclassifiedIds()).doesNotContain(unclassified.id)
            assertThat(projectIds()).doesNotContain(linked.id)
            assertThat(characterIds()).doesNotContain(linked.id)
            assertThat(tagIds()).doesNotContain(linked.id)
            assertThat(queryIds()).doesNotContain(linked.id)
            assertThat(drawerIds()).doesNotContain(linked.id)

            // 되돌리기 — 재노출 + 작품 연결 복귀(서랍)
            memoEditService.restoreMemo(uid, linked.id!!)
            assertThat(allIds()).contains(linked.id)
            assertThat(projectIds()).contains(linked.id)
            assertThat(drawerIds()).contains(linked.id)
        }
    }
