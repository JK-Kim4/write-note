package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class UpdateDocumentTitleRequest(
    @field:NotBlank(message = "title must not be blank")
    @field:Size(max = 120, message = "title must be 120 characters or less")
    val title: String,
)
