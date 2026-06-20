package com.writenote.spike

import kr.dogfoot.hwpxlib.`object`.HWPXFile
import kr.dogfoot.hwpxlib.`object`.content.section_xml.SectionXMLFile
import kr.dogfoot.hwpxlib.`object`.content.section_xml.paragraph.Para
import kr.dogfoot.hwpxlib.`object`.content.section_xml.paragraph.Run
import kr.dogfoot.hwpxlib.tool.blankfilemaker.BlankFileMaker
import kr.dogfoot.hwpxlib.writer.HWPXWriter
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.io.File

/**
 * HWPX 생성 실현가능성 Spike — GitHub #42
 *
 * 목적: kr.dogfoot:hwpxlib:1.0.5 로 .hwpx 파일 생성 가능 여부 + 매핑 범위 확인.
 * DB / 네트워크 접근 없음. 파일 생성 전용.
 */
@DisplayName("HWPX 생성 Spike (#42)")
class HwpxSpikeTest {
    private val outputDir = "build/spike"

    @Test
    @DisplayName("1. 최소 단락 — 안녕하세요 텍스트 단일 단락 생성")
    fun minimalSingleParagraph() {
        val hwpxFile = BlankFileMaker.make()
        val section = hwpxFile.sectionXMLFileList().get(0)

        addPara(section, "1", "0", "안녕하세요, 소설비입니다.")

        save(hwpxFile, "minimal.hwpx")
    }

    @Test
    @DisplayName("2. 복수 단락 — 여러 단락 구조 생성")
    fun multipleParagraphs() {
        val hwpxFile = BlankFileMaker.make()
        val section = hwpxFile.sectionXMLFileList().get(0)

        val lines =
            listOf(
                "첫 번째 단락입니다.",
                "두 번째 단락입니다.",
                "세 번째 단락입니다.",
            )

        lines.forEachIndexed { index, text ->
            addPara(section, "${index + 1}", "0", text)
        }

        save(hwpxFile, "multiple-paragraphs.hwpx")
    }

    @Test
    @DisplayName("3. 제목 스타일 — styleIDRef 로 H1~H3 매핑 시도 (렌더링은 한컴 확인 필요)")
    fun headingStyles() {
        // NOTE: hwpxlib BlankFileMaker 의 기본 스타일 정의는 ID 0 (본문)만.
        // H1/H2/H3 는 한컴오피스 내장 스타일 ID(보통 1~3) 에 의존한다.
        // styleIDRef 를 "1"/"2"/"3" 으로 직접 참조 시도.
        // 실제 제목 렌더링 여부는 사용자의 한컴오피스 열기로만 확인 가능.
        val hwpxFile = BlankFileMaker.make()
        val section = hwpxFile.sectionXMLFileList().get(0)

        addPara(section, "10", "0", "제목 1 — 소설비 (styleIDRef=1 시도)") { para ->
            para.styleIDRefAnd("1")
        }
        addPara(section, "11", "0", "제목 2 — 챕터 소개 (styleIDRef=2 시도)") { para ->
            para.styleIDRefAnd("2")
        }
        addPara(section, "12", "0", "제목 3 — 절 이름 (styleIDRef=3 시도)") { para ->
            para.styleIDRefAnd("3")
        }
        addPara(section, "13", "0", "본문 — 일반 텍스트입니다.")

        save(hwpxFile, "heading-styles.hwpx")
    }

    @Test
    @DisplayName("4. 볼드/이탤릭 — 헤더 CharPr 에 bold/italic 추가 후 charPrIDRef 참조")
    fun boldItalic() {
        // NOTE: hwpxlib 의 CharPr 에 createBold()/createItalic() 메서드가 있음.
        // BlankFileMaker 가 만든 charProperties 목록에 bold/italic CharPr 를 추가하고
        // charPrIDRef 로 참조하는 방식으로 구현.
        val hwpxFile = BlankFileMaker.make()

        // 헤더 refList 에서 charProperties 가져오기
        val charProps = hwpxFile.headerXMLFile()?.refList()?.charProperties()

        // charProps 에 bold CharPr 추가 (ID "10")
        if (charProps != null) {
            val boldPr = charProps.addNew()
            boldPr.idAnd("10").heightAnd(1000)
            boldPr.createBold()

            // italic CharPr 추가 (ID "11")
            val italicPr = charProps.addNew()
            italicPr.idAnd("11").heightAnd(1000)
            italicPr.createItalic()

            // bold+italic CharPr 추가 (ID "12")
            val boldItalicPr = charProps.addNew()
            boldItalicPr.idAnd("12").heightAnd(1000)
            boldItalicPr.createBold()
            boldItalicPr.createItalic()
        }

        val section = hwpxFile.sectionXMLFileList().get(0)
        addPara(section, "20", "0", "일반 텍스트 — 기준선")
        addPara(section, "21", "10", "볼드 텍스트 — charPrIDRef=10")
        addPara(section, "22", "11", "이탤릭 텍스트 — charPrIDRef=11")
        addPara(section, "23", "12", "볼드+이탤릭 — charPrIDRef=12")

        save(hwpxFile, "bold-italic.hwpx")
    }

    @Test
    @DisplayName("5. 용지 크기 — Run.secPr 로 PagePr 접근, A4 설정 시도")
    fun paperSize() {
        // NOTE: OWPML 에서 용지 크기는 section 내 Run 의 SecPr > PagePr 에서 정의.
        // BlankFileMaker 가 만든 section 첫 번째 Run 에 secPr 를 생성해 A4 크기 설정 시도.
        // hwpxlib 단위: 1/100 mm (HWP UNIT). A4 = 21000 × 29700
        val hwpxFile = BlankFileMaker.make()
        val section = hwpxFile.sectionXMLFileList().get(0)

        val para: Para = section.addNewPara()
        para
            .idAnd("30")
            .paraPrIDRefAnd("0")
            .styleIDRefAnd("0")
            .pageBreakAnd(false)
            .columnBreakAnd(false)

        val run: Run = para.addNewRun()
        run.charPrIDRefAnd("0")

        // SecPr 생성 후 PagePr 로 용지 크기 설정
        run.createSecPr()
        val secPr = run.secPr()
        if (secPr != null) {
            secPr.createPagePr()
            secPr.pagePr()?.widthAnd(21000)?.heightAnd(29700) // A4
        }

        run.addNewT().addText("A4 용지 설정 테스트 (21000×29700, 1/100mm) — 소설비")

        save(hwpxFile, "paper-size-a4.hwpx")
    }

    @Test
    @DisplayName("6. 한국어 폰트 — Fontfaces hangulFontface 첫 번째 폰트를 나눔명조로 변경")
    fun koreanFont() {
        // NOTE: BlankFileMaker 기본 한글 폰트 = 함초롬돋움.
        // Fontfaces.hangulFontface() 로 HANGUL face 접근 후 getFont(0) 으로 첫 폰트 변경.
        val hwpxFile = BlankFileMaker.make()

        val fontfaces = hwpxFile.headerXMLFile()?.refList()?.fontfaces()
        var fontChanged = false

        if (fontfaces != null) {
            val hangulFace = fontfaces.hangulFontface()
            if (hangulFace != null && hangulFace.countOfFont() > 0) {
                hangulFace.getFont(0)?.faceAnd("나눔명조")
                fontChanged = true
            }
        }

        val section = hwpxFile.sectionXMLFileList().get(0)
        addPara(section, "40", "0", "나눔명조 폰트 테스트 — 폰트 변경 성공: $fontChanged")

        save(hwpxFile, "korean-font.hwpx")
    }

    // ---- 헬퍼 ----

    private fun addPara(
        section: SectionXMLFile,
        id: String,
        charPrRef: String,
        text: String,
        paraConfig: ((Para) -> Unit)? = null,
    ) {
        val para: Para = section.addNewPara()
        para
            .idAnd(id)
            .paraPrIDRefAnd("0")
            .styleIDRefAnd("0")
            .pageBreakAnd(false)
            .columnBreakAnd(false)
        paraConfig?.invoke(para)

        val run: Run = para.addNewRun()
        run.charPrIDRefAnd(charPrRef)
        run.addNewT().addText(text)
    }

    private fun save(
        hwpxFile: HWPXFile,
        filename: String,
    ) {
        val dir = File(outputDir)
        if (!dir.exists()) dir.mkdirs()
        val path = "${dir.absolutePath}/$filename"
        HWPXWriter.toFilepath(hwpxFile, path)
        println("[HWPX-SPIKE] 생성 완료: $path")
    }
}
