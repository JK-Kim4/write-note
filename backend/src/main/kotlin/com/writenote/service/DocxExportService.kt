package com.writenote.service

import com.writenote.model.request.ExportBlockDto
import com.writenote.model.request.ExportChapterDto
import com.writenote.model.request.ExportRequest
import org.apache.poi.xwpf.usermodel.BreakType
import org.apache.poi.xwpf.usermodel.UnderlinePatterns
import org.apache.poi.xwpf.usermodel.XWPFDocument
import org.apache.poi.xwpf.usermodel.XWPFParagraph
import org.springframework.stereotype.Service
import java.io.ByteArrayOutputStream

/**
 * ExportRequest → .docx(ByteArray). Apache POI XWPF.
 * joinMode: page-title(제목 heading + 챕터 사이 페이지 나눔) / inline-title(제목 heading) / body-only(본문만).
 */
@Service
class DocxExportService {
    fun generate(req: ExportRequest): ByteArray {
        XWPFDocument().use { doc ->
            req.chapters.forEachIndexed { ci, chapter ->
                if (req.joinMode == "page-title" && ci > 0) {
                    doc.createParagraph().createRun().addBreak(BreakType.PAGE)
                }
                if (req.joinMode != "body-only") {
                    addTitle(doc, chapter)
                }
                chapter.blocks.forEach { block -> addBlock(doc, block) }
            }
            ByteArrayOutputStream().use { out ->
                doc.write(out)
                return out.toByteArray()
            }
        }
    }

    private fun addTitle(
        doc: XWPFDocument,
        chapter: ExportChapterDto,
    ) {
        val p = doc.createParagraph()
        val run = p.createRun()
        run.isBold = true
        run.setFontSize(HEADING_FONT_SIZE[1]!!)
        run.setText(chapter.title)
    }

    private fun addBlock(
        doc: XWPFDocument,
        block: ExportBlockDto,
    ) {
        if (block.type == "hr") {
            doc.createParagraph().createRun().setText("───")
            return
        }
        val p = doc.createParagraph()
        if (block.type == "blockquote") p.indentationLeft = 720
        if (block.type == "listItem") {
            val depth = block.depth ?: 0
            p.indentationLeft = 720 * (depth + 1) // 720 twips ≈ 1.27 cm, 1 depth 당 한 단계 들여쓰기
            // TODO(R7-dogfooding): ordered 번호 — 프론트가 listNumber 전달 후 정확 번호로 교체
            p.createRun().setText("• ")
        }
        val headingSize = if (block.type == "heading" && block.level != null) HEADING_FONT_SIZE[block.level] else null
        addRuns(p, block, baseFontSizePt = headingSize, baseBold = headingSize != null)
    }

    /** marks 구간으로 text 를 잘라 run 마다 스타일 적용. \n(소프트 줄바꿈) → addBreak(). */
    private fun addRuns(
        p: XWPFParagraph,
        block: ExportBlockDto,
        baseFontSizePt: Int? = null,
        baseBold: Boolean = false,
    ) {
        val text = block.text
        if (text.isEmpty()) {
            p.createRun()
            return
        }
        val boundaries = sortedSetOf(0, text.length)
        block.marks.forEach {
            boundaries.add(it.start)
            boundaries.add(it.end)
        }
        val points = boundaries.toList()
        for (i in 0 until points.size - 1) {
            val s = points[i]
            val e = points[i + 1]
            val mark = block.marks.firstOrNull { it.start <= s && e <= it.end }
            val segment = text.substring(s, e)
            val lines = segment.split("\n")
            lines.forEachIndexed { li, line ->
                val run = p.createRun()
                run.isBold = (mark?.bold == true) || baseBold
                if (mark != null) {
                    run.isItalic = mark.italic
                    if (mark.underline) run.setUnderline(UnderlinePatterns.SINGLE)
                    run.isStrikeThrough = mark.strike
                }
                if (baseFontSizePt != null) run.setFontSize(baseFontSizePt)
                run.setText(line)
                if (li < lines.size - 1) run.addBreak()
            }
        }
    }

    companion object {
        /** heading level(1~3) → 직접 서식 폰트 크기(pt). styleId 의존 없이 Word·한컴 무관 렌더 보장. */
        private val HEADING_FONT_SIZE = mapOf(1 to 18, 2 to 15, 3 to 13)
    }
}
