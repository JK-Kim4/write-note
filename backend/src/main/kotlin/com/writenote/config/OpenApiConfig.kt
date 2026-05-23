package com.writenote.config

import io.swagger.v3.oas.models.Components
import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
import io.swagger.v3.oas.models.security.SecurityScheme
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration

@Configuration
class OpenApiConfig {
    @Bean
    fun writeNoteOpenApi(): OpenAPI =
        OpenAPI()
            .info(
                Info()
                    .title("write-note API")
                    .version("v1")
                    .description("Backend API for write-note"),
            ).components(
                Components()
                    .addSecuritySchemes(
                        "BearerJwt",
                        SecurityScheme()
                            .type(SecurityScheme.Type.HTTP)
                            .scheme("bearer")
                            .bearerFormat("JWT")
                            .description("브라우저 access token (Bearer eyJ...)"),
                    ).addSecuritySchemes(
                        "BearerApiToken",
                        SecurityScheme()
                            .type(SecurityScheme.Type.HTTP)
                            .scheme("bearer")
                            .description("모바일 캡처 장기 토큰 (Bearer wnt_...), POST /api/capture 한정"),
                    ),
            )
}
