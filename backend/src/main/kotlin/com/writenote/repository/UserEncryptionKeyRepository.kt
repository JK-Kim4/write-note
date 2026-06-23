package com.writenote.repository

import com.writenote.entity.UserEncryptionKey
import org.springframework.data.jpa.repository.JpaRepository

interface UserEncryptionKeyRepository : JpaRepository<UserEncryptionKey, Long>
