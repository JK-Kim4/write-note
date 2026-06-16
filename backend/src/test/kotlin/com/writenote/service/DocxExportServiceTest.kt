package com.writenote.service

import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportChapterDto
import com.writenote.model.request.ExportRequest
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.io.ByteArrayInputStream

class DocxExportServiceTest {
    private val service = DocxExportService()

    @Test
    @DisplayName("단락 텍스트를 담은 .docx 를 생성한다")
    fun `generates docx with paragraph text`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters = listOf(ExportChapterDto("1장", listOf(ExportBlockDto(type = "paragraph", text = "안녕하세요")))),
            )
        val bytes = service.generate(req)

        XWPFDocument(ByteArrayInputStream(bytes)).use { doc ->
            val allText = doc.paragraphs.joinToString("\n") { it.text }
            assertThat(allText).contains("안녕하세요")
        }
    }

    @Test
    @DisplayName("page-title 모드는 챕터 제목을 포함한다")
    fun `page-title includes chapter title`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "page-title",
                chapters = listOf(ExportChapterDto("프롤로그", listOf(ExportBlockDto(type = "paragraph", text = "본문")))),
            )
        val bytes = service.generate(req)
        XWPFDocument(ByteArrayInputStream(bytes)).use { doc ->
            assertThat(doc.paragraphs.joinToString("\n") { it.text }).contains("프롤로그")
        }
    }
}
