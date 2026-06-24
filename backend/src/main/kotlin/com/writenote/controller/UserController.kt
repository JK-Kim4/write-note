package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.SetNicknameRequest
import com.writenote.model.response.AuthMeResponse
import com.writenote.model.response.Result
import com.writenote.service.UserService
import io.swagger.v3.oas.annotations.Operation
import io.swagger.v3.oas.annotations.responses.ApiResponse
import io.swagger.v3.oas.annotations.responses.ApiResponses
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import io.swagger.v3.oas.annotations.tags.Tag
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * 사용자 계정 정보 엔드포인트 (036, JWT 인증). 닉네임 변경.
 */
@Tag(name = "사용자", description = "닉네임 등 사용자 계정 정보 — owner 는 JWT principal 에서 도출")
@RestController
@RequestMapping("/api/users")
@SecurityRequirement(name = "BearerJwt")
class UserController(
    private val userService: UserService,
) {
    @PatchMapping("/me/nickname")
    @Operation(
        summary = "닉네임 변경",
        description = "2~16자 한글·영문·숫자·밑줄, 금칙어·중복 불가. 성공 시 갱신된 본인 정보(AuthMeResponse) 반환.",
    )
    @ApiResponses(
        value = [
            ApiResponse(responseCode = "200", description = "성공 — AuthMeResponse"),
            ApiResponse(responseCode = "400", description = "NICKNAME_INVALID_FORMAT / NICKNAME_FORBIDDEN_WORD"),
            ApiResponse(responseCode = "409", description = "NICKNAME_ALREADY_REGISTERED"),
            ApiResponse(responseCode = "401", description = "AUTH_TOKEN_*"),
        ],
    )
    fun changeNickname(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @RequestBody request: SetNicknameRequest,
    ): ResponseEntity<Result<AuthMeResponse>> =
        ResponseEntity.ok(Result.success(userService.changeNickname(principal.userId, request.nickname)))
}
