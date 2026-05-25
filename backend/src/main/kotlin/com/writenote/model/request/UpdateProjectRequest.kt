package com.writenote.model.request

import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.Size

data class UpdateProjectRequest(
    @field:Size(min = 1, max = 120)
    val title: String? = null,
    @field:Size(max = 100)
    val genre: String? = null,
    @field:Min(1)
    @field:Max(100_000_000)
    val targetLength: Int? = null,
    @field:Size(max = 2000)
    val toneNotes: String? = null,
    @field:Size(max = 5000)
    val synopsis: String? = null,
    @field:Size(max = 10_000)
    val worldNotes: String? = null,
)
