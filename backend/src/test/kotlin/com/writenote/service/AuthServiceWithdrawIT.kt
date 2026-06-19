package com.writenote.service

import com.writenote.entity.ApiToken
import com.writenote.entity.Memo
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.entity.UserSetting
import com.writenote.repository.ApiTokenRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import com.writenote.repository.UserSettingRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import java.time.Instant
import java.util.UUID

/**
 * AuthService.withdraw cascade 통합테스트.
 *
 * 클래스 레벨 @Transactional 미박음 — withdraw 는 실제 commit 이 돼야 cascade 삭제 확인 가능.
 * 격리: UUID 이메일 user + @AfterEach cleanup (사용자가 남아있으면 cascade 로 자식 정리).
 */
@SpringBootTest
@ActiveProfiles("test")
class AuthServiceWithdrawIT
    @Autowired
    constructor(
        private val authService: AuthService,
        private val userRepository: UserRepository,
        private val projectRepository: ProjectRepository,
        private val memoRepository: MemoRepository,
        private val apiTokenRepository: ApiTokenRepository,
        private val userSettingRepository: UserSettingRepository,
    ) {
        private var createdUserId: Long? = null

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
        fun `withdraw 는 User 와 연관 데이터(작품·메모·토큰·설정)를 모두 삭제한다`() {
            // given: 사용자 + 연관 데이터
            val user =
                userRepository.saveAndFlush(
                    User(
                        email = "withdraw-${UUID.randomUUID()}@test.com",
                        passwordHash = "x",
                    ),
                )
            createdUserId = user.id

            projectRepository.saveAndFlush(
                Project(
                    userId = user.id!!,
                    title = "탈퇴 테스트 작품",
                ),
            )

            val memo =
                memoRepository.saveAndFlush(
                    Memo(
                        userId = user.id!!,
                        body = "탈퇴 테스트 메모",
                        source = "DESKTOP",
                        capturedAt = Instant.now(),
                    ),
                )

            apiTokenRepository.saveAndFlush(
                ApiToken(
                    userId = user.id!!,
                    tokenHash = "a".repeat(64),
                    tokenPrefix = "wnt_XXXX",
                    label = "탈퇴 테스트 토큰",
                ),
            )

            userSettingRepository.saveAndFlush(
                UserSetting(
                    userId = user.id!!,
                    settingKey = "theme",
                    value = "dark",
                ),
            )

            // when
            authService.withdraw(user.id!!)

            // then: User 및 연관 전부 삭제
            assertThat(userRepository.findById(user.id!!)).isEmpty
            assertThat(projectRepository.findByUserIdAndArchivedAtIsNull(user.id!!)).isEmpty()
            assertThat(memoRepository.findById(memo.id!!)).isEmpty
            assertThat(apiTokenRepository.findByUserIdOrderByCreatedAtDesc(user.id!!)).isEmpty()
            assertThat(userSettingRepository.findAllByUserId(user.id!!)).isEmpty()

            // cleanup 에서 deleteById 재시도 방지
            createdUserId = null
        }
    }
