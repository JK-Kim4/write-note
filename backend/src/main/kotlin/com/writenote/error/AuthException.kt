package com.writenote.error

import com.writenote.enums.AuthErrorCode

open class AuthException(
    val errorCode: AuthErrorCode,
    override val message: String = errorCode.defaultMessage,
) : RuntimeException(message)
