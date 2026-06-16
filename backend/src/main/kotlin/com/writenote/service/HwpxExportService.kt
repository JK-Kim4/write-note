package com.writenote.service

import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportRequest
import kr.dogfoot.hwpxlib.`object`.HWPXFile
import kr.dogfoot.hwpxlib.`object`.content.section_xml.SectionXMLFile
import kr.dogfoot.hwpxlib.tool.blankfilemaker.BlankFileMaker
import kr.dogfoot.hwpxlib.writer.HWPXWriter
import org.springframework.stereotype.Service
import java.io.File

/**
 * ExportRequest → .hwpx(ByteArray). kr.dogfoot:hwpxlib.
 * 스파이크(HwpxSpikeTest) 패턴 승격. HWPXWriter.toStream 미존재 → toFilepath 임시파일 폴백.
 * 제목 styleIDRef·bold/italic 매핑은 스파이크 검증 범위.
 * ordered 번호·정밀 run 분할은 후속.
 */
@Service
class HwpxExportService {
    fun generate(req: ExportRequest): ByteArray {
        val hwpx = BlankFileMaker.make()
        registerBoldItalicCharPr(hwpx)
        val section = hwpx.sectionXMLFileList().get(0)

        var paraId = 1
        req.chapters.forEach { chapter ->
            if (req.joinMode != "body-only") {
                addPara(section, paraId++, "20", chapter.title, styleRef = "1")
            }
            chapter.blocks.forEach { block ->
                addPara(section, paraId++, headingCharPrFor(block), blockText(block), styleRef = headingStyle(block))
            }
        }
        return write(hwpx)
    }

    private fun blockText(block: ExportBlockDto): String =
        when (block.type) {
            "hr" -> "───"
            "listItem" -> "• " + block.text.replace("\n", " ")
            else -> block.text.replace("\n", " ")
        }

    private fun headingStyle(block: ExportBlockDto): String =
        if (block.type == "heading" && block.level != null) block.level.toString() else "0"

    /**
     * 블록 charPr 결정. heading 은 직접 서식 charPr(20~22) 우선.
     * 그 외 블록 전체에 단일 mark 면 그 charPr, 아니면 기본(0). 정밀 run 분할은 후속.
     */
    private fun headingCharPrFor(block: ExportBlockDto): String {
        if (block.type == "heading" && block.level != null) {
            return when (block.level) {
                1 -> "20" // H1 — 18pt bold
                2 -> "21" // H2 — 15pt bold
                else -> "22" // H3+ — 13pt bold
            }
        }
        val m = block.marks.firstOrNull() ?: return "0"
        return when {
            m.bold && m.italic -> "12"
            m.bold -> "10"
            m.italic -> "11"
            else -> "0"
        }
    }

    private fun registerBoldItalicCharPr(hwpx: HWPXFile) {
        val charProps = hwpx.headerXMLFile()?.refList()?.charProperties() ?: return
        // 인라인 마크 bold/italic (본문 크기 10pt = heightAnd(1000))
        charProps.addNew().apply {
            idAnd("10").heightAnd(1000)
            createBold()
        }
        charProps.addNew().apply {
            idAnd("11").heightAnd(1000)
            createItalic()
        }
        charProps.addNew().apply {
            idAnd("12").heightAnd(1000)
            createBold()
            createItalic()
        }
        // 제목/heading 직접 서식 (styleIDRef 의존 없이 bold + 크기로 시각화)
        // hwpxlib height 단위: 1/100 pt (스파이크 heightAnd(1000) = 10pt 기준)
        charProps.addNew().apply {
            idAnd("20").heightAnd(1800) // 18pt — 챕터 제목(H1)
            createBold()
        }
        charProps.addNew().apply {
            idAnd("21").heightAnd(1500) // 15pt — H2
            createBold()
        }
        charProps.addNew().apply {
            idAnd("22").heightAnd(1300) // 13pt — H3
            createBold()
        }
    }

    private fun addPara(
        section: SectionXMLFile,
        id: Int,
        charPrRef: String,
        text: String,
        styleRef: String,
    ) {
        val para = section.addNewPara()
        para
            .idAnd(id.toString())
            .paraPrIDRefAnd("0")
            .styleIDRefAnd(styleRef)
            .pageBreakAnd(false)
            .columnBreakAnd(false)
        val run = para.addNewRun()
        run.charPrIDRefAnd(charPrRef)
        run.addNewT().addText(text)
    }

    /** HWPXWriter.toStream 미존재 → 임시파일 write 후 readBytes 폴백 */
    private fun write(hwpx: HWPXFile): ByteArray {
        val tmp = File.createTempFile("export", ".hwpx")
        return try {
            HWPXWriter.toFilepath(hwpx, tmp.absolutePath)
            tmp.readBytes()
        } finally {
            tmp.delete()
        }
    }
}
