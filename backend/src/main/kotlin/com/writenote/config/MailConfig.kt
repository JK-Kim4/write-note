package com.writenote.config

import org.springframework.context.annotation.Configuration

/**
 * Mail configuration placeholder.
 *
 * - Local/test profile: LoggingMailSender 가 자동 등록 (app.mail.mode = log).
 * - Prod profile: spring-boot-starter-mail 의 JavaMailSender 자동 빈 위에
 *   어댑터를 별도 트랙에서 결선.
 *
 * 출처: research.md R-2, contracts/auth-endpoints.md §6.
 */
@Configuration
class MailConfig
