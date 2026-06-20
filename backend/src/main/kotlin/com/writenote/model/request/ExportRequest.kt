package com.writenote.model.request

import jakarta.validation.constraints.NotEmpty

data class ExportMarkDto(
    val start: Int,
    val end: Int,
    val bold: Boolean = false,
    val italic: Boolean = false,
    val underline: Boolean = false,
    val strike: Boolean = false,
)

data class ExportBlockDto(
    val type: String, // paragraph | heading | blockquote | listItem | hr
    val level: Int? = null,
    val listKind: String? = null,
    val depth: Int? = null,
    val text: String = "",
    val marks: List<ExportMarkDto> = emptyList(),
)

data class ExportChapterDto(
    val title: String,
    val blocks: List<ExportBlockDto> = emptyList(),
)

data class ExportRequest(
    val paperSize: String,
    val joinMode: String, // page-title | inline-title | body-only
    @field:NotEmpty(message = "chapters must not be empty")
    val chapters: List<ExportChapterDto>,
)
