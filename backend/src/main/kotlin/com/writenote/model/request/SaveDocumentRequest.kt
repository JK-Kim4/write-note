package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.NotNull

data class SaveDocumentRequest(
    @field:NotBlank(message = "body must not be blank")
    val body: String,
    @field:NotNull(message = "version must not be null")
    val version: Int,
)
