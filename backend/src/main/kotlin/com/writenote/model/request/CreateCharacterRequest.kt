package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CreateCharacterRequest(
    @field:NotBlank
    @field:Size(max = 80)
    val name: String,
    @field:Size(max = 255)
    val shortDescription: String? = null,
    @field:Size(max = 10_000)
    val notes: String? = null,
    val displayOrder: Int? = null,
)
