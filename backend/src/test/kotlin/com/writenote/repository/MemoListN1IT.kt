package com.writenote.repository

import com.writenote.entity.Character
import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.MemoProjectCharacter
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
import org.springframework.data.domain.Sort
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * T052 — 메모 목록 조회 시 N+1 회피 검증.
 *
 * [MemoRepository.findWithConnectionsByUserId] + [MemoRepository.findWithProjectConnectionsByUserId] 등
 * `@EntityGraph` 또는 JPQL JOIN FETCH 를 사용해 MemoProject/MemoProjectCharacter 를
 * 단일 쿼리로 fetch — Hibernate Statistics 로 prepareStatementCount 검증.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class MemoListN1IT
    @Autowired
    constructor(
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
                    email = "memo-n1-${UUID.randomUUID()}@example.com",
                    passwordHash = "test-fixture-password-hash",
                ),
            )

        @Test
        @DisplayName("N+1 회피 — 메모 5건(각 2 프로젝트, 각 1 인물) 목록 조회 시 SELECT 3 이내 (연결포함 @EntityGraph/JOIN FETCH)")
        fun `memo list avoids N+1 for memos with project and character connections`() {
            val user = savedUser()
            val project1 = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 A"))
            val project2 = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "소설 B"))
            val char1 =
                characterRepository.saveAndFlush(
                    Character(projectId = project1.id!!, name = "민지", displayOrder = 0),
                )
            val char2 =
                characterRepository.saveAndFlush(
                    Character(projectId = project2.id!!, name = "할머니", displayOrder = 0),
                )

            repeat(5) { idx ->
                val memo =
                    memoRepository.saveAndFlush(
                        Memo(
                            userId = user.id!!,
                            body = "메모 $idx",
                            source = "DESKTOP",
                            capturedAt = Instant.now(),
                        ),
                    )
                val mp1 = memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = project1.id!!))
                val mp2 = memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = project2.id!!))
                entityManager.persist(MemoProjectCharacter(memoProject = mp1, characterId = char1.id!!))
                entityManager.persist(MemoProjectCharacter(memoProject = mp2, characterId = char2.id!!))
            }
            entityManager.flush()
            entityManager.clear()

            val sessionFactory = entityManager.entityManagerFactory.unwrap(SessionFactory::class.java)
            sessionFactory.statistics.clear()

            val pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "capturedAt"))
            val page = memoRepository.findAllWithConnectionsByUserId(user.id!!, pageable)

            assertThat(page.content).hasSize(5)
            // N+1 미회피 시: 1(메모) + 5(memoProject) + 5(memoProjectCharacter) = 11+
            // @EntityGraph/JOIN FETCH 사용 시: 메인 SELECT + COUNT ≤ 3
            assertThat(sessionFactory.statistics.prepareStatementCount)
                .`as`("N+1 미회피 — 쿼리 카운트가 3 초과")
                .isLessThanOrEqualTo(3)
        }

        @Test
        @DisplayName("N+1 회피 — unclassified 필터(프로젝트 미연결 메모만) 조회 시 단순 SELECT 2 이내")
        fun `memo list unclassified filter avoids N+1`() {
            val user = savedUser()

            // 미분류 메모 3건 + 분류된 메모 2건
            repeat(3) { idx ->
                memoRepository.saveAndFlush(
                    Memo(userId = user.id!!, body = "미분류 $idx", source = "MOBILE", capturedAt = Instant.now()),
                )
            }
            val project = projectRepository.saveAndFlush(Project(userId = user.id!!, title = "분류된 프로젝트"))
            repeat(2) { idx ->
                val memo =
                    memoRepository.saveAndFlush(
                        Memo(userId = user.id!!, body = "분류 $idx", source = "DESKTOP", capturedAt = Instant.now()),
                    )
                memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = project.id!!))
            }
            entityManager.flush()
            entityManager.clear()

            val sessionFactory = entityManager.entityManagerFactory.unwrap(SessionFactory::class.java)
            sessionFactory.statistics.clear()

            val pageable = PageRequest.of(0, 10, Sort.by(Sort.Direction.DESC, "capturedAt"))
            val page = memoRepository.findUnclassifiedByUserId(user.id!!, pageable)

            assertThat(page.content).hasSize(3)
            assertThat(sessionFactory.statistics.prepareStatementCount).isLessThanOrEqualTo(2)
        }
    }
