package com.writenote.auth

import com.writenote.components.KakaoConflictChecker
import com.writenote.components.KakaoLoginDecision
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import com.writenote.service.AccountLinkService
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.userinfo.DefaultOAuth2UserService
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.oauth2.core.OAuth2AccessToken
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.user.DefaultOAuth2User
import org.springframework.security.oauth2.core.user.OAuth2User
import java.time.Instant

class KakaoOAuth2UserServiceTest {
    private val userRepository = mockk<UserRepository>()
    private val conflictChecker = mockk<KakaoConflictChecker>()
    private val accountLinkService = mockk<AccountLinkService>()
    private val delegate = mockk<DefaultOAuth2UserService>()
    private val service = KakaoOAuth2UserService(userRepository, conflictChecker, accountLinkService, delegate)

    @Test
    fun `신규 가입 — NewKakaoUser 분기 시 User INSERT 후 userId attribute 박힌 OAuth2User 반환`() {
        every { delegate.loadUser(any()) } returns kakaoOAuth2User(kakaoId = 123L, email = "new@example.com")
        every {
            conflictChecker.evaluateForLogin(eq("123"), eq("new@example.com"))
        } returns KakaoLoginDecision.NewKakaoUser(kakaoId = "123", email = "new@example.com")
        val savedSlot = slot<User>()
        every { userRepository.save(capture(savedSlot)) } answers {
            savedSlot.captured.apply { id = 7L }
        }

        val result = service.loadUser(fakeOAuth2UserRequest())

        verify {
            userRepository.save(
                match<User> {
                    it.kakaoId == "123" &&
                        it.email == "new@example.com" &&
                        it.emailVerifiedAt != null &&
                        it.lastLoginAt != null &&
                        it.passwordHash == null
                },
            )
        }
        assertThat(result.attributes["userId"]).isEqualTo(7L)
        assertThat(result.name).isEqualTo("123")
    }

    @Test
    fun `기존 연결 — ExistingKakaoUser 분기 시 lastLoginAt 갱신 후 userId attribute 박힌 OAuth2User 반환`() {
        val existing =
            User(
                id = 42L,
                email = "linked@example.com",
                kakaoId = "123",
                passwordHash = null,
                emailVerifiedAt = Instant.parse("2026-01-01T00:00:00Z"),
                lastLoginAt = Instant.parse("2026-04-01T00:00:00Z"),
            )
        every { delegate.loadUser(any()) } returns kakaoOAuth2User(kakaoId = 123L, email = "linked@example.com")
        every {
            conflictChecker.evaluateForLogin(eq("123"), eq("linked@example.com"))
        } returns KakaoLoginDecision.ExistingKakaoUser(existing)
        every { userRepository.save(eq(existing)) } returns existing

        val result = service.loadUser(fakeOAuth2UserRequest())

        verify {
            userRepository.save(
                match<User> {
                    it.id == 42L &&
                        it.lastLoginAt != null &&
                        it.lastLoginAt!! > Instant.parse("2026-04-01T00:00:00Z")
                },
            )
        }
        assertThat(result.attributes["userId"]).isEqualTo(42L)
        assertThat(result.name).isEqualTo("123")
    }

    @Test
    fun `이메일 충돌 — EmailConflictNotLinked 분기 시 OAuth2AuthenticationException + KAKAO_EMAIL_ALREADY_REGISTERED throw`() {
        every { delegate.loadUser(any()) } returns kakaoOAuth2User(kakaoId = 999L, email = "conflict@example.com")
        every {
            conflictChecker.evaluateForLogin(eq("999"), eq("conflict@example.com"))
        } returns KakaoLoginDecision.EmailConflictNotLinked

        assertThatThrownBy { service.loadUser(fakeOAuth2UserRequest()) }
            .isInstanceOf(OAuth2AuthenticationException::class.java)
            .extracting { (it as OAuth2AuthenticationException).error.errorCode }
            .isEqualTo("KAKAO_EMAIL_ALREADY_REGISTERED")

        verify(exactly = 0) { userRepository.save(any<User>()) }
    }

    private fun kakaoOAuth2User(
        kakaoId: Long,
        email: String,
    ): OAuth2User {
        val attributes =
            mapOf<String, Any>(
                "id" to kakaoId,
                "kakao_account" to mapOf("email" to email),
            )
        return DefaultOAuth2User(
            listOf(SimpleGrantedAuthority("ROLE_USER")),
            attributes,
            "id",
        )
    }

    private fun fakeOAuth2UserRequest(): OAuth2UserRequest {
        val clientRegistration =
            ClientRegistration
                .withRegistrationId("kakao")
                .clientId("client-id")
                .clientSecret("client-secret")
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost/callback")
                .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                .tokenUri("https://kauth.kakao.com/oauth/token")
                .userInfoUri("https://kapi.kakao.com/v2/user/me")
                .userNameAttributeName("id")
                .build()
        val accessToken =
            OAuth2AccessToken(
                OAuth2AccessToken.TokenType.BEARER,
                "fake-access-token",
                Instant.now(),
                Instant.now().plusSeconds(3600),
            )
        return OAuth2UserRequest(clientRegistration, accessToken)
    }
}
