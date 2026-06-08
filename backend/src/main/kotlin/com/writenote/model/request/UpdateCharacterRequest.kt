package com.writenote.model.request

import jakarta.validation.constraints.Size

data class UpdateCharacterRequest(
    @field:Size(min = 1, max = 80)
    val name: String? = null,
    @field:Size(max = 255)
    val shortDescription: String? = null,
    @field:Size(max = 10_000)
    val notes: String? = null,
    val displayOrder: Int? = null,
)
