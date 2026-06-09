package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull
import java.time.Instant

data class SaveDocumentRequest(
    @field:NotBlank(message = "body must not be blank")
    val body: String,
    // version = 클라이언트가 마지막으로 받은 updatedAt 토큰(불투명). null 금지.
    @field:NotNull(message = "version must not be null")
    val version: Instant,
)
