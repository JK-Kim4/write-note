package com.writenote.config

import com.writenote.auth.ApiTokenAuthenticationFilter
import com.writenote.auth.AuthErrorEntryPoint
import com.writenote.auth.CsrfDefenseFilter
import com.writenote.auth.JwtAuthenticationFilter
import com.writenote.auth.KakaoOAuth2UserService
import com.writenote.auth.LoginAttemptFilter
import com.writenote.auth.OAuth2FailureHandler
import com.writenote.auth.OAuth2SuccessHandler
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository
import org.springframework.security.oauth2.client.web.DefaultOAuth2AuthorizationRequestResolver
import org.springframework.security.oauth2.client.web.OAuth2AuthorizationRequestResolver
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfigurationSource

@Configuration
class SecurityConfig {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        corsConfigurationSource: CorsConfigurationSource,
        authErrorEntryPoint: AuthErrorEntryPoint,
        jwtAuthenticationFilter: JwtAuthenticationFilter,
        apiTokenAuthenticationFilter: ApiTokenAuthenticationFilter,
        csrfDefenseFilter: CsrfDefenseFilter,
        loginAttemptFilter: LoginAttemptFilter,
        kakaoOAuth2UserService: KakaoOAuth2UserService,
        oauth2SuccessHandler: OAuth2SuccessHandler,
        oauth2FailureHandler: OAuth2FailureHandler,
        adminAuthorizationManager: AdminAuthorizationManager,
        kakaoAuthorizationRequestResolver: OAuth2AuthorizationRequestResolver,
    ): SecurityFilterChain =
        http
            .csrf { csrf -> csrf.disable() }
            .cors { cors -> cors.configurationSource(corsConfigurationSource) }
            .sessionManagement { session ->
                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
            }.authorizeHttpRequests { requests ->
                requests
                    // 공개 endpoint (contracts/security-filter-chain.md §2)
                    .requestMatchers(HttpMethod.POST, "/api/auth/signup/email")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/verify-email")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/resend-verification")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/login")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/auth/oauth/kakao")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/api/auth/oauth/kakao/callback")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/password-reset/request")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/password-reset/confirm")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/auth/refresh")
                    .permitAll()
                    // 모바일 캡처 (Week 4 영역, 본 spec 진입 시 ApiTokenAuthenticationFilter 가 401)
                    .requestMatchers(HttpMethod.POST, "/api/capture")
                    .permitAll()
                    // 모니터링
                    .requestMatchers("/actuator/health")
                    .permitAll()
                    .requestMatchers("/swagger-ui.html", "/swagger-ui/**", "/api-docs/**")
                    .permitAll()
                    // 로그인 에러 페이지 (OAuth2FailureHandler 가 redirect) — Security 필터 외부 영역
                    .requestMatchers(HttpMethod.GET, "/auth/login-error")
                    .permitAll()
                    // 공개 공지 조회 (030 운영 툴) — 비인증 허용, 공개 공지만 노출
                    .requestMatchers(HttpMethod.GET, "/api/announcements", "/api/announcements/*")
                    .permitAll()
                    // 공개 공유 열람 (046) — 비로그인 허용, optional auth(JwtAuthenticationFilter pass-through).
                    // /api/share-links/** 는 보호(anyRequest authenticated). 댓글 POST(R2)는 컨트롤러가 회원 검증(nullable principal).
                    .requestMatchers(HttpMethod.GET, "/api/shared/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.POST, "/api/shared/**")
                    .permitAll()
                    // 운영 툴 어드민 (030) — 단일 관리자(app.admin.email)만
                    .requestMatchers("/api/admin/**")
                    .access(adminAuthorizationManager)
                    // 본 spec US6 의 owner-context 교체 영역 — JWT 인증 강제
                    // (contracts/owner-context-migration.md §3)
                    .requestMatchers("/api/projects/**")
                    .authenticated()
                    // 그 외 모든 보호 endpoint — JWT 필요
                    .anyRequest()
                    .authenticated()
            }.exceptionHandling { handler ->
                handler.authenticationEntryPoint(authErrorEntryPoint)
            }.httpBasic { basic -> basic.disable() }
            .formLogin { form -> form.disable() }
            .oauth2Login { oauth2 ->
                oauth2
                    .authorizationEndpoint { it.authorizationRequestResolver(kakaoAuthorizationRequestResolver) }
                    .redirectionEndpoint { it.baseUri("/api/auth/oauth/*/callback") }
                    .userInfoEndpoint { it.userService(kakaoOAuth2UserService) }
                    .successHandler(oauth2SuccessHandler)
                    .failureHandler(oauth2FailureHandler)
            }.addFilterBefore(csrfDefenseFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(apiTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(loginAttemptFilter, JwtAuthenticationFilter::class.java)
            .build()

    /**
     * 카카오 인증 요청에 prompt=login 을 박아 매번 재로그인을 강제한다.
     *
     * 미설정 시 카카오 SSO 세션이 살아있으면 로그아웃 후 재로그인할 때 카카오가 로그인 화면을
     * 건너뛰고 silent 재인증 → 계정 전환 불가. baseUri 는 authorizationEndpoint 와 동일하게 맞춘다.
     */
    @Bean
    fun kakaoAuthorizationRequestResolver(clientRegistrationRepository: ClientRegistrationRepository): OAuth2AuthorizationRequestResolver {
        val resolver =
            DefaultOAuth2AuthorizationRequestResolver(clientRegistrationRepository, "/api/auth/oauth")
        resolver.setAuthorizationRequestCustomizer { builder ->
            builder.additionalParameters { params -> params["prompt"] = "login" }
        }
        return resolver
    }
}
