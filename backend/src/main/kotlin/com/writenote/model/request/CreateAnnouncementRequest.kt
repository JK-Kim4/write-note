package com.writenote.model.request

import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size

data class CreateAnnouncementRequest(
    @field:NotBlank
    @field:Size(max = 200)
    val title: String,
    @field:NotBlank
    val body: String,
    val isPublished: Boolean = false,
    val isPinned: Boolean = false,
)
