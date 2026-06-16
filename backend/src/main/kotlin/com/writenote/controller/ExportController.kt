package com.writenote.controller

import com.writenote.auth.AuthenticatedPrincipal
import com.writenote.model.request.ExportRequest
import com.writenote.service.DocxExportService
import com.writenote.service.HwpxExportService
import com.writenote.service.ProjectService
import io.swagger.v3.oas.annotations.security.SecurityRequirement
import jakarta.validation.Valid
import org.springframework.http.HttpHeaders
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

@RestController
@SecurityRequirement(name = "BearerJwt")
class ExportController(
    private val projectService: ProjectService,
    private val docxExportService: DocxExportService,
    private val hwpxExportService: HwpxExportService,
) {
    @PostMapping("/api/export/{projectId}/docx")
    fun exportDocx(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: ExportRequest,
    ): ResponseEntity<ByteArray> {
        projectService.requireOwnedProject(principal.userId, projectId)
        return fileResponse(docxExportService.generate(request), "docx", projectId)
    }

    @PostMapping("/api/export/{projectId}/hwpx")
    fun exportHwpx(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PathVariable projectId: Long,
        @Valid @RequestBody request: ExportRequest,
    ): ResponseEntity<ByteArray> {
        projectService.requireOwnedProject(principal.userId, projectId)
        return fileResponse(hwpxExportService.generate(request), "hwpx", projectId)
    }

    private fun fileResponse(
        bytes: ByteArray,
        ext: String,
        projectId: Long,
    ): ResponseEntity<ByteArray> {
        val filename =
            URLEncoder
                .encode("export-$projectId.$ext", StandardCharsets.UTF_8)
                .replace("+", "%20")
        return ResponseEntity
            .ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''$filename")
            .contentType(MediaType.APPLICATION_OCTET_STREAM)
            .body(bytes)
    }
}
