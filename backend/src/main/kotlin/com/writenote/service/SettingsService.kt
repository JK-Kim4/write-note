package com.writenote.service

import com.writenote.entity.UserSetting
import com.writenote.error.ValidationException
import com.writenote.model.response.SettingsResponse
import com.writenote.repository.UserSettingRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * 사용자 환경설정 조회·갱신 (019 US2 / #37).
 *
 * 허용 key allowlist + key 별 허용 value 집합으로 검증한다. 임의 문자열 적재를 막아 FE 가 즉시
 * 해석하는 설정값의 오염(화면 깨짐)을 방지한다. 항목 추가(예: Round 2 용지 크기)는 [ALLOWED] 에 한 줄.
 */
@Service
class SettingsService(
    private val userSettingRepository: UserSettingRepository,
) {
    /** GET — 저장된 설정 전체(key-value 맵). 미저장이면 빈 맵. */
    @Transactional(readOnly = true)
    fun getSettings(userId: Long): SettingsResponse =
        SettingsResponse(userSettingRepository.findAllByUserId(userId).associate { it.settingKey to it.value })

    /** PUT — 보낸 key 만 검증 후 upsert(per-key last-write-wins). 갱신 후 전체 맵 반환. */
    @Transactional(rollbackFor = [Exception::class])
    fun updateSettings(
        userId: Long,
        partial: Map<String, String>,
    ): SettingsResponse {
        partial.forEach { (key, value) -> validate(key, value) }

        val existing = userSettingRepository.findAllByUserId(userId).associateBy { it.settingKey }
        partial.forEach { (key, value) ->
            val row = existing[key] ?: UserSetting(userId = userId, settingKey = key)
            row.value = value
            userSettingRepository.save(row)
        }
        return getSettings(userId)
    }

    private fun validate(
        key: String,
        value: String,
    ) {
        val allowed = ALLOWED[key] ?: throw ValidationException("Unknown setting key: $key")
        if (value !in allowed) {
            throw ValidationException("Invalid value for $key")
        }
    }

    private companion object {
        /** 허용 설정 key → 허용 value 집합. 항목 추가는 여기에 한 줄(스키마 변경 0). */
        val ALLOWED: Map<String, Set<String>> =
            mapOf(
                "theme" to setOf("light", "dark", "system"),
                "writingMode" to setOf("manuscript", "editor"),
                "manuscriptSize" to setOf("200", "400", "1000"),
                "paperSize" to setOf("A4", "A3", "A2", "B4"),
                "onboardingCompleted" to setOf("true"),
                "dailyGoalMinutes" to setOf("30", "60", "90", "120", "180", "240", "300"),
            )
    }
}
