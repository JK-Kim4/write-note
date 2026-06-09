package com.writenote.controller

import com.writenote.auth.JwtTokenProvider
import com.writenote.entity.Memo
import com.writenote.entity.MemoProject
import com.writenote.entity.Project
import com.writenote.entity.User
import com.writenote.repository.MemoProjectRepository
import com.writenote.repository.MemoRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc
import org.springframework.http.MediaType
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ProjectMemoControllerIT {
    @Autowired private lateinit var mockMvc: MockMvc

    @Autowired private lateinit var userRepository: UserRepository

    @Autowired private lateinit var projectRepository: ProjectRepository

    @Autowired private lateinit var memoRepository: MemoRepository

    @Autowired private lateinit var memoProjectRepository: MemoProjectRepository

    @Autowired private lateinit var jwtTokenProvider: JwtTokenProvider

    @Test
    fun `pin reflects on listing, enforces one-per-project, and clears on unpin`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val project = createProject(owner.id!!, "고정 작품")
        val m1 = linkMemo(owner.id!!, project.id!!, "곁쪽지 1")
        val m2 = linkMemo(owner.id!!, project.id!!, "곁쪽지 2")

        // AS1 — M1 고정 → 목록 반영
        mockMvc
            .perform(
                put("/api/projects/{projectId}/memos/{memoId}/pin", project.id, m1)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"pinned":true}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned").value(true))

        mockMvc
            .perform(get("/api/projects/{projectId}/memos", project.id).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[?(@.memoId == $m1)].pinned").value(true))
            .andExpect(jsonPath("$.data[?(@.memoId == $m2)].pinned").value(false))

        // AS2 — M2 고정 → M1 자동 해제 (작품당 1개)
        mockMvc
            .perform(
                put("/api/projects/{projectId}/memos/{memoId}/pin", project.id, m2)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"pinned":true}"""),
            ).andExpect(status().isOk)

        mockMvc
            .perform(get("/api/projects/{projectId}/memos", project.id).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[?(@.memoId == $m1)].pinned").value(false))
            .andExpect(jsonPath("$.data[?(@.memoId == $m2)].pinned").value(true))

        // AS3 — 해제
        mockMvc
            .perform(
                put("/api/projects/{projectId}/memos/{memoId}/pin", project.id, m2)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"pinned":false}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.data.pinned").value(false))
    }

    @Test
    fun `pin on same memo in different project is independent`() {
        val owner = createUser()
        val bearer = bearerFor(owner)
        val p1 = createProject(owner.id!!, "P1")
        val p2 = createProject(owner.id!!, "P2")
        val memo = createMemo(owner.id!!, "공유 곁쪽지")
        link(memo, p1.id!!)
        link(memo, p2.id!!)

        // P1 에서 고정
        mockMvc
            .perform(
                put("/api/projects/{projectId}/memos/{memoId}/pin", p1.id, memo.id)
                    .header("Authorization", bearer)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"pinned":true}"""),
            ).andExpect(status().isOk)

        // AS4 — P2 에서의 같은 메모 고정 상태는 영향 없음
        mockMvc
            .perform(get("/api/projects/{projectId}/memos", p2.id).header("Authorization", bearer))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.data[?(@.memoId == ${memo.id})].pinned").value(false))
    }

    @Test
    fun `cross user pin returns 404`() {
        val ownerA = createUser()
        val ownerB = createUser()
        val project = createProject(ownerA.id!!, "A 작품")
        val memo = linkMemo(ownerA.id!!, project.id!!, "A 곁쪽지")

        // AS5 — 타 계정 고정 시도 거부
        mockMvc
            .perform(
                put("/api/projects/{projectId}/memos/{memoId}/pin", project.id, memo)
                    .header("Authorization", bearerFor(ownerB))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"pinned":true}"""),
            ).andExpect(status().isNotFound)
    }

    private fun createUser(): User =
        userRepository.saveAndFlush(
            User(email = "pin-${UUID.randomUUID()}@example.com", passwordHash = "test-fixture-password-hash"),
        )

    private fun createProject(
        userId: Long,
        title: String,
    ): Project = projectRepository.saveAndFlush(Project(userId = userId, title = title))

    private fun createMemo(
        userId: Long,
        body: String,
    ): Memo =
        memoRepository.saveAndFlush(
            Memo(userId = userId, body = body, source = "DESKTOP", capturedAt = Instant.now()),
        )

    private fun link(
        memo: Memo,
        projectId: Long,
    ): MemoProject = memoProjectRepository.saveAndFlush(MemoProject(memo = memo, projectId = projectId))

    private fun linkMemo(
        userId: Long,
        projectId: Long,
        body: String,
    ): Long {
        val memo = createMemo(userId, body)
        link(memo, projectId)
        return memo.id!!
    }

    private fun bearerFor(user: User): String = "Bearer ${jwtTokenProvider.createAccessToken(userId = user.id!!, email = user.email)}"
}
