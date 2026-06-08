package com.writenote.config

import org.springframework.context.annotation.Configuration

/**
 * Kakao OAuth2 client configuration placeholder.
 *
 * Spring Security 가 application.yml 의 spring.security.oauth2.client.{registration,provider}.kakao 를
 * 자동 처리 (ClientRegistrationRepository 자동 등록). 카카오 OAuth user info 매핑은 별도
 * KakaoOAuth2UserService 에서 처리 (US2 영역, 본 spec 의 Phase 4).
 *
 * 출처: research.md R-3, contracts/auth-endpoints.md §4·§5, application.yml.
 */
@Configuration
class OAuth2Config
