package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.ValidationException
import com.writenote.repository.UserRepository
import com.writenote.repository.UserSettingRepository
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * US2 (A3 / #37) — 설정 검증·upsert.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SettingsServiceIT
    @Autowired
    constructor(
        private val settingsService: SettingsService,
        private val userSettingRepository: UserSettingRepository,
        private val userRepository: UserRepository,
    ) {
        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(email = "settings-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
            )

        @Test
        @DisplayName("미저장 사용자는 빈 맵")
        fun `empty for new user`() {
            val user = savedUser()
            assertThat(settingsService.getSettings(user.id!!).settings).isEmpty()
        }

        @Test
        @DisplayName("허용 key/value 저장 후 조회 정합")
        fun `valid settings persist`() {
            val user = savedUser()
            settingsService.updateSettings(user.id!!, mapOf("theme" to "dark", "manuscriptSize" to "400"))

            val stored = settingsService.getSettings(user.id!!).settings
            assertThat(stored).containsEntry("theme", "dark").containsEntry("manuscriptSize", "400")
        }

        @Test
        @DisplayName("부분 갱신 — 보낸 key 만 바뀌고 나머지는 보존(per-key LWW)")
        fun `partial update preserves other keys`() {
            val user = savedUser()
            settingsService.updateSettings(user.id!!, mapOf("theme" to "dark", "writingMode" to "editor"))

            settingsService.updateSettings(user.id!!, mapOf("theme" to "light"))

            val stored = settingsService.getSettings(user.id!!).settings
            assertThat(stored).containsEntry("theme", "light").containsEntry("writingMode", "editor")
        }

        @Test
        @DisplayName("허용 외 key 거부")
        fun `unknown key rejected`() {
            val user = savedUser()
            assertThrows<ValidationException> {
                settingsService.updateSettings(user.id!!, mapOf("hackerKey" to "x"))
            }
            assertThat(userSettingRepository.findAllByUserId(user.id!!)).isEmpty()
        }

        @Test
        @DisplayName("허용 외 value 거부")
        fun `invalid value rejected`() {
            val user = savedUser()
            assertThrows<ValidationException> {
                settingsService.updateSettings(user.id!!, mapOf("theme" to "neon"))
            }
        }

        @Test
        @DisplayName("paperSize 허용값(A4·A3·A2·B4) 저장 통과")
        fun `valid paperSize values accepted`() {
            val user = savedUser()
            for (size in listOf("A4", "A3", "A2", "B4")) {
                settingsService.updateSettings(user.id!!, mapOf("paperSize" to size))
                val stored = settingsService.getSettings(user.id!!).settings
                assertThat(stored).containsEntry("paperSize", size)
            }
        }

        @Test
        @DisplayName("paperSize 비허용값 거부")
        fun `invalid paperSize rejected`() {
            val user = savedUser()
            assertThrows<ValidationException> {
                settingsService.updateSettings(user.id!!, mapOf("paperSize" to "Letter"))
            }
        }

        @Test
        @DisplayName("onboardingCompleted=true 저장 통과 (온보딩 가이드 1회 영속)")
        fun `onboardingCompleted true accepted`() {
            val user = savedUser()
            settingsService.updateSettings(user.id!!, mapOf("onboardingCompleted" to "true"))

            val stored = settingsService.getSettings(user.id!!).settings
            assertThat(stored).containsEntry("onboardingCompleted", "true")
        }

        @Test
        @DisplayName("onboardingCompleted 비허용값(false) 거부")
        fun `onboardingCompleted invalid value rejected`() {
            val user = savedUser()
            assertThrows<ValidationException> {
                settingsService.updateSettings(user.id!!, mapOf("onboardingCompleted" to "false"))
            }
        }

        @Test
        @DisplayName("dailyGoalMinutes 허용값(30·60·300 등) 저장 통과")
        fun `valid dailyGoalMinutes values accepted`() {
            val user = savedUser()
            for (minutes in listOf("30", "60", "90", "120", "180", "240", "300")) {
                settingsService.updateSettings(user.id!!, mapOf("dailyGoalMinutes" to minutes))
                val stored = settingsService.getSettings(user.id!!).settings
                assertThat(stored).containsEntry("dailyGoalMinutes", minutes)
            }
        }

        @Test
        @DisplayName("dailyGoalMinutes 비허용값(45·abc) 거부")
        fun `invalid dailyGoalMinutes rejected`() {
            val user = savedUser()
            for (bad in listOf("45", "abc", "0")) {
                assertThrows<ValidationException> {
                    settingsService.updateSettings(user.id!!, mapOf("dailyGoalMinutes" to bad))
                }
            }
        }
    }
