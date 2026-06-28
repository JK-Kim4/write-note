package com.writenote.model.response

import com.writenote.enums.AuthErrorCode
import com.writenote.error.ErrorCode
import com.writenote.error.ShareErrorCode

data class Result<T>(
    val success: Boolean,
    val data: T?,
    val error: ErrorInfo?,
) {
    companion object {
        fun <T> success(data: T): Result<T> =
            Result(
                success = true,
                data = data,
                error = null,
            )

        fun failure(
            code: ErrorCode,
            message: String,
        ): Result<Nothing> =
            Result(
                success = false,
                data = null,
                error = ErrorInfo(code = code.name, message = message),
            )

        fun failure(
            code: AuthErrorCode,
            message: String,
        ): Result<Nothing> =
            Result(
                success = false,
                data = null,
                error = ErrorInfo(code = code.name, message = message),
            )

        fun failure(
            code: ShareErrorCode,
            message: String,
        ): Result<Nothing> =
            Result(
                success = false,
                data = null,
                error = ErrorInfo(code = code.name, message = message),
            )
    }
}
