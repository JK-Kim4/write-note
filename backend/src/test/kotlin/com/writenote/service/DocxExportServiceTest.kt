package com.writenote.service

import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportChapterDto
import com.writenote.model.request.ExportMarkDto
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

    @Test
    @DisplayName("bold 마크가 있는 run 은 isBold 가 true 다")
    fun `bold mark produces bold run`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters =
                    listOf(
                        ExportChapterDto(
                            "1장",
                            listOf(
                                ExportBlockDto(
                                    type = "paragraph",
                                    text = "굵게",
                                    marks = listOf(ExportMarkDto(start = 0, end = 2, bold = true)),
                                ),
                            ),
                        ),
                    ),
            )
        val bytes = service.generate(req)
        XWPFDocument(ByteArrayInputStream(bytes)).use { doc ->
            assertThat(doc.paragraphs.flatMap { it.runs }.any { it.isBold }).isTrue()
        }
    }

    @Test
    @DisplayName("body-only 모드는 챕터 제목을 포함하지 않는다")
    fun `body-only excludes chapter title`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters = listOf(ExportChapterDto("숨김챕터", listOf(ExportBlockDto(type = "paragraph", text = "본문만")))),
            )
        val bytes = service.generate(req)
        XWPFDocument(ByteArrayInputStream(bytes)).use { doc ->
            val allText = doc.paragraphs.joinToString("\n") { it.text }
            assertThat(allText).doesNotContain("숨김챕터")
        }
    }

    @Test
    @DisplayName("listItem 블록은 bullet 마커(•)를 포함한다")
    fun `listItem block contains bullet marker`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters =
                    listOf(
                        ExportChapterDto(
                            "1장",
                            listOf(ExportBlockDto(type = "listItem", listKind = "bullet", depth = 0, text = "항목")),
                        ),
                    ),
            )
        val bytes = service.generate(req)
        XWPFDocument(ByteArrayInputStream(bytes)).use { doc ->
            val allText = doc.paragraphs.joinToString("\n") { it.text }
            assertThat(allText).contains("•")
        }
    }
}
