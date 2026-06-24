package com.writenote.nickname

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class NicknameWordsTest {
    @Test
    fun `수식어와 명사 사전은 비어 있지 않다`() {
        assertThat(NicknameWords.MODIFIERS).isNotEmpty()
        assertThat(NicknameWords.NOUNS).isNotEmpty()
    }

    @Test
    fun `큐레이션 어휘에는 금칙어가 포함되지 않는다`() {
        val all = NicknameWords.MODIFIERS + NicknameWords.NOUNS
        val offending = all.filter { ForbiddenWords.contains(it) }
        assertThat(offending).isEmpty()
    }

    @Test
    fun `수식어와 명사 조합은 숫자 포함 16자를 넘지 않는다`() {
        val maxModifier = NicknameWords.MODIFIERS.maxOf { it.length }
        val maxNoun = NicknameWords.NOUNS.maxOf { it.length }
        // 최장 조합 + 6자리 숫자 fallback 까지 16자 이내여야 한다.
        assertThat(maxModifier + maxNoun + 6).isLessThanOrEqualTo(16)
    }
}
