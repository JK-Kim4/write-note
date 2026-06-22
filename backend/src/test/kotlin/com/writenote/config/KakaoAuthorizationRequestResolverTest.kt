package com.writenote.config

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.InMemoryClientRegistrationRepository
import org.springframework.security.oauth2.core.AuthorizationGrantType
import org.springframework.security.oauth2.core.ClientAuthenticationMethod

/**
 * 카카오 OAuth 인증 요청이 항상 재로그인(prompt=login)을 강제하는지 검증.
 *
 * 로그아웃 후 다시 로그인 시 카카오 SSO 세션이 살아있으면 카카오가 로그인 화면을 건너뛰고
 * silent 재인증한다 — 계정 전환을 막는다. authorize 요청에 prompt=login 을 박아 매번 재인증시킨다.
 */
class KakaoAuthorizationRequestResolverTest {
    private val clientRegistrationRepository =
        InMemoryClientRegistrationRepository(
            ClientRegistration
                .withRegistrationId("kakao")
                .clientId("test-client")
                .clientSecret("test-secret")
                .clientAuthenticationMethod(ClientAuthenticationMethod.CLIENT_SECRET_POST)
                .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
                .redirectUri("http://localhost:8080/api/auth/oauth/kakao/callback")
                .scope("profile_nickname", "account_email")
                .authorizationUri("https://kauth.kakao.com/oauth/authorize")
                .tokenUri("https://kauth.kakao.com/oauth/token")
                .userInfoUri("https://kapi.kakao.com/v2/user/me")
                .userNameAttributeName("id")
                .clientName("Kakao")
                .build(),
        )

    @Test
    @DisplayName("카카오 인증 요청에 prompt=login 을 강제해 매번 재로그인시킨다")
    fun `forces prompt=login on kakao authorization request`() {
        val resolver = SecurityConfig().kakaoAuthorizationRequestResolver(clientRegistrationRepository)
        val request = MockHttpServletRequest("GET", "/api/auth/oauth/kakao")

        val authorizationRequest = resolver.resolve(request)

        assertThat(authorizationRequest).isNotNull
        assertThat(authorizationRequest!!.additionalParameters["prompt"]).isEqualTo("login")
    }
}
