package com.writenote.controller

import com.writenote.model.response.Result
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController

@RestController
class HealthController {
    @GetMapping("/api/health")
    fun health(): Result<Map<String, String>> = Result.success(mapOf("status" to "UP"))
}
