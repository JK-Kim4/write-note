package com.writenote.model.response

import com.writenote.error.ErrorCode

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
    }
}
