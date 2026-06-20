package com.writenote.auth

import com.writenote.enums.AuthErrorCode
import com.writenote.error.AuthException
import io.jsonwebtoken.Jwts
import io.jsonwebtoken.security.Keys
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.Base64
import java.util.Date

class JwtTokenProviderTest {
    // 32 바이트 테스트 시크릿 (base64 디코딩 결과 = 32 바이트)
    private val keyBytes = Base64.getDecoder().decode("d24tdGVzdC1kZXRlcm1pbmlzdGljLWp3dC0zMmJ5dGU=")
    private val provider =
        JwtTokenProvider(
            keyBytes = keyBytes,
            accessTokenValiditySeconds = 3600L,
        )

    @Test
    fun `발급 후 parse round-trip — payload 정확값 검증`() {
        val token = provider.createAccessToken(userId = 42L, email = "test@example.com")
        val principal = provider.parseAccessToken(token)
        assertThat(principal.userId).isEqualTo(42L)
        assertThat(principal.email).isEqualTo("test@example.com")
    }

    @Test
    fun `만료된 토큰 파싱 시 AUTH_TOKEN_EXPIRED`() {
        // now 를 2시간 전으로 주입 → validity 3600초 기준 1시간 전에 만료
        val pastNow = Instant.now().minus(Duration.ofHours(2))
        val expiredToken =
            provider.createAccessToken(
                userId = 1L,
                email = "test@example.com",
                now = pastNow,
            )
        assertThatThrownBy { provider.parseAccessToken(expiredToken) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_EXPIRED)
    }

    @Test
    fun `변조된 토큰 파싱 시 AUTH_TOKEN_INVALID`() {
        val token = provider.createAccessToken(userId = 1L, email = "test@example.com")
        // 서명 중간 문자 변조 — 마지막 문자는 base64url 잔여(하위 2비트 폐기) 영역이라
        // 'a'↔'b' 변조가 동일 서명으로 디코드될 수 있음(토큰이 'a'로 끝날 때 ~1/64 flaky). 중간 문자는 전 비트 유효.
        val tamperIndex = token.lastIndexOf('.') + 10
        val tampered =
            StringBuilder(token)
                .also { it[tamperIndex] = if (it[tamperIndex] == 'a') 'b' else 'a' }
                .toString()
        assertThatThrownBy { provider.parseAccessToken(tampered) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_INVALID)
    }

    @Test
    fun `다른 시크릿으로 발급된 토큰 파싱 시 AUTH_TOKEN_INVALID`() {
        // 다른 32 바이트 시크릿으로 서명한 토큰 생성
        val otherKeyBytes = ByteArray(32) { it.toByte() }
        val otherKey = Keys.hmacShaKeyFor(otherKeyBytes)
        val now = Instant.now()
        val foreignToken =
            Jwts
                .builder()
                .subject("1")
                .claim("email", "test@example.com")
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plus(Duration.ofHours(1))))
                .signWith(otherKey, Jwts.SIG.HS256)
                .compact()
        assertThatThrownBy { provider.parseAccessToken(foreignToken) }
            .isInstanceOf(AuthException::class.java)
            .hasFieldOrPropertyWithValue("errorCode", AuthErrorCode.AUTH_TOKEN_INVALID)
    }
}
