package com.writenote.config

import io.swagger.v3.oas.models.OpenAPI
import io.swagger.v3.oas.models.info.Info
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
            )
}
