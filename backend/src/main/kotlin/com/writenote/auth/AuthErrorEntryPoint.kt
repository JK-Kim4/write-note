package com.writenote.auth

import com.writenote.enums.AuthErrorCode
import com.writenote.model.response.Result
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.security.core.AuthenticationException
import org.springframework.security.web.AuthenticationEntryPoint
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper

@Component
class AuthErrorEntryPoint(
    private val objectMapper: ObjectMapper,
) : AuthenticationEntryPoint {
    override fun commence(
        request: HttpServletRequest,
        response: HttpServletResponse,
        authException: AuthenticationException,
    ) {
        response.status = HttpStatus.UNAUTHORIZED.value()
        response.contentType = MediaType.APPLICATION_JSON_VALUE
        response.characterEncoding = Charsets.UTF_8.name()
        val body =
            Result.failure(
                AuthErrorCode.AUTH_TOKEN_MISSING,
                AuthErrorCode.AUTH_TOKEN_MISSING.defaultMessage,
            )
        response.writer.write(objectMapper.writeValueAsString(body))
    }
}
