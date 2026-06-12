package com.writenote.repository

import com.writenote.entity.UserSetting
import com.writenote.entity.UserSettingId
import org.springframework.data.jpa.repository.JpaRepository

interface UserSettingRepository : JpaRepository<UserSetting, UserSettingId> {
    fun findAllByUserId(userId: Long): List<UserSetting>
}
