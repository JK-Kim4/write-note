package com.writenote.service

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test

/**
 * 앵커 범위 검증(046 R2) — 순수 로직. 스냅샷 평문 PM JSON 의 top-level 블록 배열을 파싱해
 * anchorBlockIndex < 블록 수 && anchorStart >= 0 && anchorLength >= 0 && anchorStart + anchorLength <= 블록 텍스트 길이.
 */
@DisplayName("AnchorValidator — 앵커 범위 검증(순수)")
class AnchorValidatorTest {
    private val validator = AnchorValidator()

    private fun doc(vararg paragraphs: String): String {
        val blocks =
            paragraphs.joinToString(",") { text ->
                if (text.isEmpty()) {
                    """{"type":"paragraph"}"""
                } else {
                    """{"type":"paragraph","content":[{"type":"text","text":"$text"}]}"""
                }
            }
        return """{"type":"doc","content":[$blocks]}"""
    }

    @Test
    fun `블록 안의 구간이면 유효하다`() {
        // "안녕하세요" 길이 5, 0..3 구간
        assertThat(validator.isValid(doc("안녕하세요"), anchorBlockIndex = 0, anchorStart = 0, anchorLength = 3)).isTrue()
    }

    @Test
    fun `블록 끝까지의 구간이면 유효하다`() {
        assertThat(validator.isValid(doc("안녕하세요"), anchorBlockIndex = 0, anchorStart = 2, anchorLength = 3)).isTrue()
    }

    @Test
    fun `caret(length 0) 위치는 유효하다`() {
        assertThat(validator.isValid(doc("안녕하세요"), anchorBlockIndex = 0, anchorStart = 5, anchorLength = 0)).isTrue()
    }

    @Test
    fun `start + length 가 블록 텍스트 길이를 넘으면 무효다`() {
        assertThat(validator.isValid(doc("안녕하세요"), anchorBlockIndex = 0, anchorStart = 3, anchorLength = 3)).isFalse()
    }

    @Test
    fun `블록 인덱스가 블록 수 이상이면 무효다`() {
        assertThat(validator.isValid(doc("첫째", "둘째"), anchorBlockIndex = 2, anchorStart = 0, anchorLength = 0)).isFalse()
    }

    @Test
    fun `두번째 블록 안의 구간이면 유효하다`() {
        assertThat(validator.isValid(doc("짧다", "더긴문단입니다"), anchorBlockIndex = 1, anchorStart = 3, anchorLength = 4)).isTrue()
    }

    @Test
    fun `음수 블록 인덱스는 무효다`() {
        assertThat(validator.isValid(doc("안녕"), anchorBlockIndex = -1, anchorStart = 0, anchorLength = 0)).isFalse()
    }

    @Test
    fun `음수 start 는 무효다`() {
        assertThat(validator.isValid(doc("안녕"), anchorBlockIndex = 0, anchorStart = -1, anchorLength = 1)).isFalse()
    }

    @Test
    fun `음수 length 는 무효다`() {
        assertThat(validator.isValid(doc("안녕"), anchorBlockIndex = 0, anchorStart = 0, anchorLength = -1)).isFalse()
    }

    @Test
    fun `빈 문단(텍스트 0)에서 caret 은 유효하고 양수 구간은 무효다`() {
        assertThat(validator.isValid(doc(""), anchorBlockIndex = 0, anchorStart = 0, anchorLength = 0)).isTrue()
        assertThat(validator.isValid(doc(""), anchorBlockIndex = 0, anchorStart = 0, anchorLength = 1)).isFalse()
    }

    @Test
    fun `여러 text run 의 합산 길이를 블록 길이로 본다`() {
        // "가나" + "다라마" = 5 (한 문단의 두 text run 합산)
        val runs = """[{"type":"text","text":"가나"},{"type":"text","text":"다라마"}]"""
        val body = """{"type":"doc","content":[{"type":"paragraph","content":$runs}]}"""
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 1, anchorLength = 4)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 1, anchorLength = 5)).isFalse()
    }

    @Test
    fun `잘못된 JSON 은 무효다`() {
        assertThat(validator.isValid("not-json", anchorBlockIndex = 0, anchorStart = 0, anchorLength = 0)).isFalse()
    }

    @Test
    fun `doc 루트가 아니면 무효다`() {
        assertThat(validator.isValid("""{"type":"paragraph"}""", anchorBlockIndex = 0, anchorStart = 0, anchorLength = 0)).isFalse()
    }

    // ── H1 화해: 프론트 pmConvert 평탄화 동형 (목록=항목별, 인용=단락별, hardBreak=U+2028 1글자) ──

    @Test
    fun `bulletList 는 항목별 블록으로 평탄화된다`() {
        // 프론트는 각 listItem 을 별도 블록으로 — 구버전(top-level 1블록)이라면 blockIndex 1 을 거짓 거부했음.
        val body =
            """{"type":"doc","content":[{"type":"bulletList","content":[""" +
                """{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"첫항목"}]}]},""" +
                """{"type":"listItem","content":[{"type":"paragraph","content":[{"type":"text","text":"둘째항목"}]}]}]}]}"""
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 0, anchorLength = 3)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 1, anchorStart = 0, anchorLength = 4)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 1, anchorStart = 0, anchorLength = 5)).isFalse()
        assertThat(validator.isValid(body, anchorBlockIndex = 2, anchorStart = 0, anchorLength = 0)).isFalse()
    }

    @Test
    fun `blockquote 는 단락별 블록으로 평탄화된다`() {
        val body =
            """{"type":"doc","content":[{"type":"blockquote","content":[""" +
                """{"type":"paragraph","content":[{"type":"text","text":"인용1"}]},""" +
                """{"type":"paragraph","content":[{"type":"text","text":"인용둘"}]}]}]}"""
        assertThat(validator.isValid(body, anchorBlockIndex = 1, anchorStart = 0, anchorLength = 3)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 1, anchorStart = 2, anchorLength = 2)).isFalse()
    }

    @Test
    fun `hardBreak 는 블록 길이에 1글자(U+2028)로 셈된다`() {
        // "ab" + hardBreak + "cd" = 5 (구버전 collectText 는 hardBreak 를 0으로 세 4 → start 5 거짓 거부).
        val body =
            """{"type":"doc","content":[{"type":"paragraph","content":[""" +
                """{"type":"text","text":"ab"},{"type":"hardBreak"},{"type":"text","text":"cd"}]}]}"""
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 0, anchorLength = 5)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 5, anchorLength = 0)).isTrue()
        assertThat(validator.isValid(body, anchorBlockIndex = 0, anchorStart = 5, anchorLength = 1)).isFalse()
    }
}
