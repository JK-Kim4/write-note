package com.writenote.model.request

import jakarta.validation.constraints.NotNull

data class ReorderCharactersRequest(
    @field:NotNull
    val characterIds: List<Long>,
)
