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
        p.style = "Heading1"
        p.createRun().setText(chapter.title)
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
        if (block.type == "heading" && block.level != null) {
            p.style = "Heading${block.level}"
        }
        if (block.type == "blockquote") p.indentationLeft = 720
        addRuns(p, block)
    }

    /** marks 구간으로 text 를 잘라 run 마다 스타일 적용. \n(소프트 줄바꿈) → addBreak(). */
    private fun addRuns(
        p: XWPFParagraph,
        block: ExportBlockDto,
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
                if (mark != null) {
                    run.isBold = mark.bold
                    run.isItalic = mark.italic
                    if (mark.underline) run.setUnderline(UnderlinePatterns.SINGLE)
                    run.isStrikeThrough = mark.strike
                }
                run.setText(line)
                if (li < lines.size - 1) run.addBreak()
            }
        }
    }
}
