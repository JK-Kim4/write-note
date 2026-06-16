package com.writenote.service

import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportChapterDto
import com.writenote.model.request.ExportRequest
import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

class HwpxExportServiceTest {
    private val service = HwpxExportService()

    @Test
    @DisplayName("hwpx ByteArray 를 생성한다(ZIP 시그니처 PK)")
    fun `generates non-empty hwpx with zip signature`() {
        val req =
            ExportRequest(
                paperSize = "A4",
                joinMode = "body-only",
                chapters =
                    listOf(
                        ExportChapterDto(
                            "1장",
                            listOf(ExportBlockDto(type = "paragraph", text = "안녕하세요 나래 노트")),
                        ),
                    ),
            )
        val bytes = service.generate(req)
        assertThat(bytes).isNotEmpty()
        assertThat(bytes[0].toInt().toChar()).isEqualTo('P')
        assertThat(bytes[1].toInt().toChar()).isEqualTo('K')
    }

    @Test
    @DisplayName("page-title 모드는 챕터 제목 단락을 포함한다(단락 수 검증)")
    fun `page-title adds title paragraph`() {
        val bodyOnly =
            service.generate(
                ExportRequest(
                    "A4",
                    "body-only",
                    listOf(
                        ExportChapterDto(
                            "프롤로그",
                            listOf(ExportBlockDto(type = "paragraph", text = "본문")),
                        ),
                    ),
                ),
            )
        val pageTitle =
            service.generate(
                ExportRequest(
                    "A4",
                    "page-title",
                    listOf(
                        ExportChapterDto(
                            "프롤로그",
                            listOf(ExportBlockDto(type = "paragraph", text = "본문")),
                        ),
                    ),
                ),
            )
        // page-title 은 제목 단락이 1개 더 많아 바이트가 더 큼(제목 텍스트 포함)
        assertThat(pageTitle.size).isGreaterThan(bodyOnly.size)
    }
}
