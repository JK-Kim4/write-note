package com.writenote.error

import com.writenote.model.response.Result
import jakarta.validation.ConstraintViolationException
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.http.converter.HttpMessageNotReadableException
import org.springframework.web.bind.MethodArgumentNotValidException
import org.springframework.web.bind.MissingRequestHeaderException
import org.springframework.web.bind.MissingServletRequestParameterException
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException

@RestControllerAdvice
class GlobalExceptionHandler {
    @ExceptionHandler(MethodArgumentNotValidException::class)
    fun handleValidation(exception: MethodArgumentNotValidException): ResponseEntity<Result<Nothing>> {
        val message =
            exception.bindingResult.fieldErrors
                .joinToString("; ") { error -> "${error.field}: ${error.defaultMessage}" }
                .ifBlank { "Request validation failed" }

        return errorResponse(HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_FAILED, message)
    }

    @ExceptionHandler(
        ConstraintViolationException::class,
        HttpMessageNotReadableException::class,
        IllegalArgumentException::class,
        MethodArgumentTypeMismatchException::class,
        MissingRequestHeaderException::class,
        MissingServletRequestParameterException::class,
    )
    fun handleInvalidParameter(exception: Exception): ResponseEntity<Result<Nothing>> =
        errorResponse(
            status = HttpStatus.BAD_REQUEST,
            code = ErrorCode.INVALID_PARAMETER,
            message = exception.message ?: "Invalid request parameter",
        )

    @ExceptionHandler(ResourceNotFoundException::class)
    fun handleNotFound(exception: ResourceNotFoundException): ResponseEntity<Result<Nothing>> =
        errorResponse(
            status = HttpStatus.NOT_FOUND,
            code = ErrorCode.NOT_FOUND,
            message = exception.message ?: "Resource not found",
        )

    @ExceptionHandler(DataIntegrityViolationException::class)
    fun handleConflict(exception: DataIntegrityViolationException): ResponseEntity<Result<Nothing>> =
        errorResponse(
            status = HttpStatus.CONFLICT,
            code = ErrorCode.CONFLICT,
            message = exception.message ?: "Resource conflict",
        )

    @ExceptionHandler(AuthException::class)
    fun handleAuth(exception: AuthException): ResponseEntity<Result<Nothing>> =
        ResponseEntity
            .status(exception.errorCode.httpStatus)
            .body(Result.failure(exception.errorCode, exception.message))

    @ExceptionHandler(Exception::class)
    fun handleUnexpected(exception: Exception): ResponseEntity<Result<Nothing>> =
        errorResponse(
            status = HttpStatus.INTERNAL_SERVER_ERROR,
            code = ErrorCode.INTERNAL_ERROR,
            message = "Unexpected server error",
        )

    private fun errorResponse(
        status: HttpStatus,
        code: ErrorCode,
        message: String,
    ): ResponseEntity<Result<Nothing>> = ResponseEntity.status(status).body(Result.failure(code, message))
}
