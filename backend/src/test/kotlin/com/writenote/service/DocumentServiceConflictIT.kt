package com.writenote.service

import com.writenote.entity.User
import com.writenote.error.DocumentConflictException
import com.writenote.model.request.CreateProjectRequest
import com.writenote.model.request.SaveDocumentRequest
import com.writenote.repository.DocumentRepository
import com.writenote.repository.UserRepository
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * DocumentService optimistic lock 충돌 IT.
 *
 * saveDocument 호출 시 요청 version 과 DB version 불일치 → DocumentConflictException 발생 검증.
 * JPA 1차 캐시 우회를 위해 flush + clear 후 재조회 패턴 사용.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class DocumentServiceConflictIT
    @Autowired
    constructor(
        private val documentService: DocumentService,
        private val projectService: ProjectService,
        private val userRepository: UserRepository,
        private val documentRepository: DocumentRepository,
        private val entityManager: EntityManager,
    ) {
        private fun savedUser(): User =
            userRepository.saveAndFlush(
                User(
                    email = "doc-conflict-${UUID.randomUUID()}@example.com",
                    passwordHash = "fixture-hash",
                    emailVerifiedAt = Instant.now(),
                ),
            )

        @Test
        @DisplayName("saveDocument — version(updatedAt 토큰) 불일치 시 409 DocumentConflictException + currentVersion/currentBody (US1 / D3)")
        fun `saveDocument throws DocumentConflictException with current state on version mismatch`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "충돌 테스트"))
            entityManager.flush()
            entityManager.clear()

            val document =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectResponse.id)
                    .first()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)
            val token0 = requireNotNull(document.updatedAt)

            // token0 일치 → 정상 저장. 응답의 새 토큰을 token1 로 보관(이후 충돌 판정 기준)
            val firstBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 저장"}]}]}"""
            val firstResponse =
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = firstBody, version = token0),
                )
            val token1 = firstResponse.version

            entityManager.flush()
            entityManager.clear()

            // 구 토큰(token0) 으로 충돌 요청
            val conflictBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"충돌"}]}]}"""

            assertThatThrownBy {
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = conflictBody, version = token0),
                )
            }.isInstanceOf(DocumentConflictException::class.java)
                .satisfies({ ex ->
                    val conflict = ex as DocumentConflictException
                    // currentVersion(DB 의 updatedAt) == 1차 응답 토큰 — 토큰 라운드트립 정밀도 정합 검증
                    assertThat(conflict.currentVersion).isEqualTo(token1)
                    // JSONB 재직렬화로 exact match 불가 — 핵심 텍스트 포함 여부로 검증
                    assertThat(conflict.currentBody).contains("첫 저장")
                })
        }

        @Test
        @DisplayName("saveDocument — version 일치 시 정상 저장 + wordCount 재계산 + 새 토큰 전진 (US1 happy path)")
        fun `saveDocument succeeds and recalculates wordCount on version match`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "word count 검증"))
            entityManager.flush()
            entityManager.clear()

            val document =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectResponse.id)
                    .first()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)
            val token0 = requireNotNull(document.updatedAt)

            val body =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""

            val response =
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = body, version = token0),
                )

            entityManager.flush()
            entityManager.clear()

            val saved = documentRepository.findById(documentId).orElseThrow()
            // "안녕 세계" = 공백 제외 4글자
            assertThat(saved.wordCount).isEqualTo(4)
            // 암호화 적용 후 stored body는 봉투 JSON (평문 포함 안 됨)
            // JSONB 재직렬화 시 공백 추가("v": 1)되므로 공백 허용 패턴으로 검증
            assertThat(saved.body).containsPattern(""""v"\s*:\s*1""")
            assertThat(saved.body).containsAnyOf(""""alg":"A256GCM"""", """"alg": "A256GCM"""")
            assertThat(saved.body).doesNotContain("안녕 세계")
            assertThat(response.wordCount).isEqualTo(4)
            // 토큰 전진: 응답 version 은 저장 전 토큰과 다르고, DB 에 저장된 updatedAt 과 일치
            assertThat(response.version).isNotEqualTo(token0)
            assertThat(response.version).isEqualTo(saved.updatedAt)
        }

        @Test
        @DisplayName("saveDocument — 저장 응답 토큰으로 재저장 시 거짓 충돌 없이 성공 (016 핵심 — 토큰 라운드트립)")
        fun `saveDocument re-save with returned token succeeds without false conflict`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "토큰 라운드트립"))
            entityManager.flush()
            entityManager.clear()

            val document =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectResponse.id)
                    .first()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)
            val token0 = requireNotNull(document.updatedAt)

            val body1 = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"하나"}]}]}"""
            val first =
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = body1, version = token0),
                )

            entityManager.flush()
            entityManager.clear()

            // 클라이언트가 받은 응답 토큰(first.version)을 그대로 다시 보냄 → 거짓 충돌 없이 성공해야 한다
            val body2 = """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"둘"}]}]}"""
            val second =
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = body2, version = first.version),
                )

            assertThat(second.version).isNotEqualTo(first.version)
        }

        @Test
        @DisplayName("saveDocument — version 불일치 시 currentBody 는 마지막으로 저장된 본문 반환 (D3 응답 계약)")
        fun `saveDocument conflict exception contains latest body`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "currentBody 검증"))
            entityManager.flush()
            entityManager.clear()

            val document =
                documentRepository
                    .findByProjectIdAndDeletedAtIsNullOrderBySortOrderAsc(projectResponse.id)
                    .first()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)
            val token0 = requireNotNull(document.updatedAt)

            val latestBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"최신 본문"}]}]}"""
            documentService.saveDocument(
                userId = userId,
                projectId = projectId,
                documentId = documentId,
                request = SaveDocumentRequest(body = latestBody, version = token0),
            )
            entityManager.flush()
            entityManager.clear()

            // 구 토큰으로 충돌 유발
            var caughtConflict: DocumentConflictException? = null
            try {
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = """{"type":"doc","content":[]}""", version = token0),
                )
            } catch (e: DocumentConflictException) {
                caughtConflict = e
            }

            assertThat(caughtConflict).isNotNull
            // JSONB 재직렬화로 exact match 불가 — 핵심 텍스트 포함 여부로 검증
            assertThat(caughtConflict!!.currentBody).contains("최신 본문")
        }
    }
