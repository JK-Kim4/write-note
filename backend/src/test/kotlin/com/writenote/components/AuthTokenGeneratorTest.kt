package com.writenote.components

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test

class AuthTokenGeneratorTest {
    private val generator = AuthTokenGenerator()

    @Test
    fun `generate 시 plaintext 43자 hash 64자`() {
        val pair = generator.generate()
        // 32 바이트 base64url no-padding = 43자
        assertThat(pair.plaintext.length).isEqualTo(43)
        // SHA-256 hex = 64자
        assertThat(pair.hash.length).isEqualTo(64)
    }

    @Test
    fun `generate 두 번 호출 시 서로 다른 plaintext 와 hash`() {
        val first = generator.generate()
        val second = generator.generate()
        assertThat(first.plaintext).isNotEqualTo(second.plaintext)
        assertThat(first.hash).isNotEqualTo(second.hash)
    }

    @Test
    fun `같은 plaintext 를 hash 두 번 호출 시 동일한 hex`() {
        val plaintext = generator.generate().plaintext
        val hash1 = generator.hash(plaintext)
        val hash2 = generator.hash(plaintext)
        assertThat(hash1).isEqualTo(hash2)
    }
}
