package com.writenote.controller

import com.writenote.auth.KakaoOAuth2UserService
import com.writenote.entity.User
import com.writenote.repository.UserRepository
import jakarta.servlet.http.HttpServletResponse
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.kotlin.any
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.mock.web.MockHttpServletRequest
import org.springframework.mock.web.MockHttpServletResponse
import org.springframework.mock.web.MockHttpSession
import org.springframework.security.core.authority.SimpleGrantedAuthority
import org.springframework.security.oauth2.client.endpoint.OAuth2AccessTokenResponseClient
import org.springframework.security.oauth2.client.endpoint.OAuth2AuthorizationCodeGrantRequest
import org.springframework.security.oauth2.client.registration.ClientRegistration
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.userinfo.OAuth2UserRequest
import org.springframework.security.oauth2.client.web.HttpSessionOAuth2AuthorizationRequestRepository
import org.springframework.security.oauth2.core.OAuth2AccessToken
import org.springframework.security.oauth2.core.OAuth2AuthenticationException
import org.springframework.security.oauth2.core.OAuth2Error
import org.springframework.security.oauth2.core.endpoint.OAuth2AccessTokenResponse
import org.springframework.security.oauth2.core.endpoint.OAuth2AuthorizationRequest
import org.springframework.security.oauth2.core.endpoint.OAuth2ParameterNames
import org.springframework.security.oauth2.core.user.DefaultOAuth2User
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.cookie
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * T046 — 카카오 OAuth2 콜백 endpoint 통합 테스트.
 *
 * 3 케이스 (contracts/auth-endpoints.md §5 + 005 R-5 쿠키화):
 * - happy: `KakaoOAuth2UserService` 가 OAuth2User 반환 → SuccessHandler → access/refresh httpOnly 쿠키 + 홈(`/`) redirect
 * - `KAKAO_EMAIL_ALREADY_REGISTERED`: KakaoOAuth2UserService 가 OAuth2AuthenticationException throw → FailureHandler → `/auth/login-error?code=KAKAO_EMAIL_ALREADY_REGISTERED`
 * - `OAUTH_FAILED`: `OAuth2AccessTokenResponseClient` 가 OAuth2AuthenticationException throw → FailureHandler → `/auth/login-error?code=OAUTH_FAILED`
 *
 * Mocking 전략 (research.md R-3):
 * - `@MockitoBean OAuth2AccessTokenResponseClient` — 카카오 token endpoint 호출 우회
 * - `@MockitoBean KakaoOAuth2UserService` — 카카오 user info endpoint 호출 우회
 * - `OAuth2SuccessHandler` / `OAuth2FailureHandler` real — redirect 응답 형식 검증
 * - `MockHttpSession` + 사전 `HttpSessionOAuth2AuthorizationRequestRepository.saveAuthorizationRequest` — Spring 의 state 매칭 정합
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
class AuthOauthCallbackWebTest
    @Autowired
    constructor(
        private val mockMvc: MockMvc,
        private val clientRegistrationRepository: ClientRegistrationRepository,
        private val userRepository: UserRepository,
    ) {
        @MockitoBean
        private lateinit var accessTokenResponseClient:
            OAuth2AccessTokenResponseClient<OAuth2AuthorizationCodeGrantRequest>

        @MockitoBean
        private lateinit var kakaoOAuth2UserService: KakaoOAuth2UserService

        private val authzRequestRepository = HttpSessionOAuth2AuthorizationRequestRepository()

        private lateinit var savedSession: MockHttpSession
        private lateinit var savedState: String

        @BeforeEach
        fun primeAuthorizationRequest() {
            savedSession = MockHttpSession()
            savedState = "test-state-${UUID.randomUUID()}"
            val kakao: ClientRegistration =
                clientRegistrationRepository.findByRegistrationId("kakao")
                    ?: error("kakao ClientRegistration must exist in application-test.yml")
            val authzRequest =
                OAuth2AuthorizationRequest
                    .authorizationCode()
                    .authorizationUri(kakao.providerDetails.authorizationUri)
                    .clientId(kakao.clientId)
                    .redirectUri(kakao.redirectUri)
                    .scopes(kakao.scopes)
                    .state(savedState)
                    .attributes(mapOf(OAuth2ParameterNames.REGISTRATION_ID to "kakao"))
                    .build()
            val mockReq =
                MockHttpServletRequest().also {
                    it.setSession(savedSession)
                }
            val mockResp: HttpServletResponse = MockHttpServletResponse()
            authzRequestRepository.saveAuthorizationRequest(authzRequest, mockReq, mockResp)
        }

        @Test
        fun `콜백 happy — JWT 발급 + access_token·refresh_token 쿠키 + 홈 redirect`() {
            val user =
                userRepository.save(
                    User(
                        email = "kakao-user-${UUID.randomUUID()}@example.com",
                        kakaoId = "kakao-id-42",
                        passwordHash = null,
                        emailVerifiedAt = Instant.now(),
                    ),
                )
            given(accessTokenResponseClient.getTokenResponse(any<OAuth2AuthorizationCodeGrantRequest>()))
                .willReturn(mockTokenResponse())
            given(kakaoOAuth2UserService.loadUser(any<OAuth2UserRequest>())).willReturn(
                DefaultOAuth2User(
                    listOf(SimpleGrantedAuthority("ROLE_USER")),
                    mapOf(
                        "id" to "kakao-id-42",
                        "userId" to user.id!!,
                        "kakao_account" to mapOf("email" to user.email),
                    ),
                    "id",
                ),
            )

            mockMvc
                .perform(
                    get("/api/auth/oauth/kakao/callback")
                        .param(OAuth2ParameterNames.CODE, "test-code")
                        .param(OAuth2ParameterNames.STATE, savedState)
                        .session(savedSession),
                ).andExpect(status().is3xxRedirection)
                .andExpect(header().string("Location", "http://localhost:3000/"))
                .andExpect(cookie().exists("access_token"))
                .andExpect(cookie().httpOnly("access_token", true))
                .andExpect(cookie().exists("refresh_token"))
                .andExpect(cookie().httpOnly("refresh_token", true))
        }

        @Test
        fun `콜백 KAKAO_EMAIL_ALREADY_REGISTERED — FailureHandler redirect`() {
            given(accessTokenResponseClient.getTokenResponse(any<OAuth2AuthorizationCodeGrantRequest>()))
                .willReturn(mockTokenResponse())
            willThrow(
                OAuth2AuthenticationException(OAuth2Error("KAKAO_EMAIL_ALREADY_REGISTERED")),
            ).given(kakaoOAuth2UserService).loadUser(any<OAuth2UserRequest>())

            mockMvc
                .perform(
                    get("/api/auth/oauth/kakao/callback")
                        .param(OAuth2ParameterNames.CODE, "test-code")
                        .param(OAuth2ParameterNames.STATE, savedState)
                        .session(savedSession),
                ).andExpect(status().is3xxRedirection)
                .andExpect(
                    header().string(
                        "Location",
                        "http://localhost:3000/auth/login-error?code=KAKAO_EMAIL_ALREADY_REGISTERED",
                    ),
                )
        }

        @Test
        fun `콜백 token endpoint 실패 — OAUTH_FAILED redirect`() {
            willThrow(
                OAuth2AuthenticationException(OAuth2Error("invalid_token_response")),
            ).given(accessTokenResponseClient).getTokenResponse(any<OAuth2AuthorizationCodeGrantRequest>())

            mockMvc
                .perform(
                    get("/api/auth/oauth/kakao/callback")
                        .param(OAuth2ParameterNames.CODE, "test-code")
                        .param(OAuth2ParameterNames.STATE, savedState)
                        .session(savedSession),
                ).andExpect(status().is3xxRedirection)
                .andExpect(
                    header().string(
                        "Location",
                        org.hamcrest.Matchers.endsWith("/auth/login-error?code=invalid_token_response"),
                    ),
                )
        }

        private fun mockTokenResponse(): OAuth2AccessTokenResponse =
            OAuth2AccessTokenResponse
                .withToken("fake-kakao-access-token")
                .tokenType(OAuth2AccessToken.TokenType.BEARER)
                .expiresIn(3600L)
                .build()
    }
