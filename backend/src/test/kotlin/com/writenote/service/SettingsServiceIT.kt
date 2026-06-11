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
    }
