package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Memo
import com.writenote.entity.User
import com.writenote.repository.MemoRepository
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

/**
 * US1 (A1 / #36) — POST /api/memos/{id}/restore 엔드포인트.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class MemoRestoreWebTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var memoRepository: MemoRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "restore-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun createMemo(userId: Long): Memo =
        memoRepository.saveAndFlush(
            Memo(userId = userId, body = "곁쪽지", source = "DESKTOP", capturedAt = Instant.now()),
        )

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"

    @Test
    fun `delete then restore round-trips and list reflects exclusion`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val memo = createMemo(owner.id!!)

        // 버리기 — 204
        mockMvc
            .perform(delete("/api/memos/{id}", memo.id).header("Authorization", bearer))
            .andExpect(status().isNoContent)

        // 목록에서 제외
        mockMvc
            .perform(get("/api/memos").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.content[?(@.id == ${memo.id})]").isEmpty)

        // 되돌리기 — 200 + 본문
        mockMvc
            .perform(post("/api/memos/{id}/restore", memo.id).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.id").value(memo.id!!.toInt()))

        // 목록 복귀
        mockMvc
            .perform(get("/api/memos").header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data.content[?(@.id == ${memo.id})]").isNotEmpty)
    }

    @Test
    fun `cross user restore returns 404`() {
        val owner = createUser()
        val other = createUser()
        val memo = createMemo(owner.id!!)
        mockMvc
            .perform(delete("/api/memos/{id}", memo.id).header("Authorization", bearerFor(owner)))
            .andExpect(status().isNoContent)

        mockMvc
            .perform(post("/api/memos/{id}/restore", memo.id).header("Authorization", bearerFor(other)))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `unauthenticated restore returns 401`() {
        val owner = createUser()
        val memo = createMemo(owner.id!!)
        mockMvc
            .perform(post("/api/memos/{id}/restore", memo.id))
            .andExpect(status().isUnauthorized)
    }
}
