package com.writenote.controller

import com.writenote.error.ResourceNotFoundException
import com.writenote.model.response.Result
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class ResponseContractIT {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @Test
    fun `success responses use the standard envelope`() {
        mockMvc
            .perform(
                post("/test-fixtures/validation")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":"Valid title"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.title").value("Valid title"))
            .andExpect(jsonPath("$.error").doesNotExist())
    }

    @Test
    fun `validation failures use the standard error envelope`() {
        mockMvc
            .perform(
                post("/test-fixtures/validation")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"title":""}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist())
            .andExpect(jsonPath("$.error.code").value("VALIDATION_FAILED"))
            .andExpect(jsonPath("$.error.message").exists())
    }

    @Test
    fun `invalid parameters use the standard error envelope`() {
        mockMvc
            .perform(get("/test-fixtures/invalid-parameter").param("page", "NaN"))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist())
            .andExpect(jsonPath("$.error.code").value("INVALID_PARAMETER"))
    }

    @Test
    fun `not found responses use the standard error envelope`() {
        mockMvc
            .perform(get("/test-fixtures/not-found"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist())
            .andExpect(jsonPath("$.error.code").value("NOT_FOUND"))
            .andExpect(jsonPath("$.error.message").value("Fixture missing"))
    }

    @Test
    fun `conflict responses use the standard error envelope`() {
        mockMvc
            .perform(get("/test-fixtures/conflict"))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.success").value(false))
            .andExpect(jsonPath("$.data").doesNotExist())
            .andExpect(jsonPath("$.error.code").value("CONFLICT"))
    }
}

@RestController
@RequestMapping("/test-fixtures")
class ResponseContractFixtureController {
    @PostMapping("/validation")
    fun validation(
        @Valid @RequestBody request: FixtureRequest,
    ): Result<Map<String, String>> = Result.success(mapOf("title" to request.title))

    @GetMapping("/invalid-parameter")
    fun invalidParameter(
        @RequestParam page: Int,
    ): Result<Map<String, Int>> = Result.success(mapOf("page" to page))

    @GetMapping("/not-found")
    fun notFound(): Result<Unit> = throw ResourceNotFoundException("Fixture missing")

    @GetMapping("/conflict")
    fun conflict(): Result<Unit> = throw DataIntegrityViolationException("duplicate")
}

data class FixtureRequest(
    @field:NotBlank
    val title: String,
)
