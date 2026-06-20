package com.writenote.model.request

import jakarta.validation.constraints.NotNull

data class ReorderDocumentsRequest(
    @field:NotNull
    val documentIds: List<Long>,
)
