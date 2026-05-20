package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CreateProjectRequest(
    @field:NotBlank
    @field:Size(max = 120)
    val title: String,
)
