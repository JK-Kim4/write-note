package com.writenote.config

import com.writenote.auth.ApiTokenAuthenticationFilter
import com.writenote.auth.AuthErrorEntryPoint
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
        loginAttemptFilter: LoginAttemptFilter,
        kakaoOAuth2UserService: KakaoOAuth2UserService,
        oauth2SuccessHandler: OAuth2SuccessHandler,
        oauth2FailureHandler: OAuth2FailureHandler,
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
                    // 그 외 모든 보호 endpoint — JWT 필요
                    .anyRequest()
                    .authenticated()
            }.exceptionHandling { handler ->
                handler.authenticationEntryPoint(authErrorEntryPoint)
            }.httpBasic { basic -> basic.disable() }
            .formLogin { form -> form.disable() }
            .oauth2Login { oauth2 ->
                oauth2
                    .authorizationEndpoint { it.baseUri("/api/auth/oauth") }
                    .redirectionEndpoint { it.baseUri("/api/auth/oauth/*/callback") }
                    .userInfoEndpoint { it.userService(kakaoOAuth2UserService) }
                    .successHandler(oauth2SuccessHandler)
                    .failureHandler(oauth2FailureHandler)
            }.addFilterBefore(apiTokenAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterBefore(loginAttemptFilter, JwtAuthenticationFilter::class.java)
            .build()
}
