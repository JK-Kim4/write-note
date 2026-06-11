package com.writenote.model.response

import java.time.Instant

data class CharacterResponse(
    val id: Long,
    val projectId: Long,
    val name: String,
    val shortDescription: String?,
    val notes: String?,
    val age: String?,
    val gender: String?,
    val traits: String?,
    val displayOrder: Int,
    val createdAt: Instant,
    val updatedAt: Instant,
)
