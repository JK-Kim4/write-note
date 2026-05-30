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
        @DisplayName("saveDocument — version 불일치 시 409 DocumentConflictException + currentVersion/currentBody (US1 / D3)")
        fun `saveDocument throws DocumentConflictException with current state on version mismatch`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            // 프로젝트 + 문서 생성 (version = 0)
            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "충돌 테스트"))
            entityManager.flush()
            entityManager.clear()

            val document = documentRepository.findByProjectId(projectResponse.id).orElseThrow()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)
            val currentBodyBeforeConflict = document.body

            // version = 0 으로 정상 저장 (version 0 → 1 로 증가)
            val firstBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"첫 저장"}]}]}"""
            documentService.saveDocument(
                userId = userId,
                projectId = projectId,
                documentId = documentId,
                request = SaveDocumentRequest(body = firstBody, version = 0),
            )

            entityManager.flush()
            entityManager.clear()

            // 이제 DB version = 1. 구버전(version = 0) 으로 충돌 요청
            val conflictBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"충돌"}]}]}"""

            assertThatThrownBy {
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = conflictBody, version = 0),
                )
            }.isInstanceOf(DocumentConflictException::class.java)
                .satisfies({ ex ->
                    val conflict = ex as DocumentConflictException
                    assertThat(conflict.currentVersion).isEqualTo(1)
                    // JSONB 재직렬화로 exact match 불가 — 핵심 텍스트 포함 여부로 검증
                    assertThat(conflict.currentBody).contains("첫 저장")
                })
        }

        @Test
        @DisplayName("saveDocument — version 일치 시 정상 저장 + wordCount 재계산 (US1 happy path)")
        fun `saveDocument succeeds and recalculates wordCount on version match`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "word count 검증"))
            entityManager.flush()
            entityManager.clear()

            val document = documentRepository.findByProjectId(projectResponse.id).orElseThrow()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)

            val body =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"안녕 세계"}]}]}"""

            val response =
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = body, version = 0),
                )

            entityManager.flush()
            entityManager.clear()

            val saved = documentRepository.findById(documentId).orElseThrow()
            // "안녕 세계" = 공백 제외 4글자
            assertThat(saved.wordCount).isEqualTo(4)
            // JSONB 는 키 정렬/공백 재직렬화하므로 exact match 대신 포함 여부 검증
            assertThat(saved.body).contains("안녕 세계")
            assertThat(saved.version).isEqualTo(1)
            assertThat(response.wordCount).isEqualTo(4)
        }

        @Test
        @DisplayName("saveDocument — version 불일치 시 currentBody 는 마지막으로 저장된 본문 반환 (D3 응답 계약)")
        fun `saveDocument conflict exception contains latest body`() {
            val user = savedUser()
            val userId = requireNotNull(user.id)

            val projectResponse = projectService.createProject(userId, CreateProjectRequest(title = "currentBody 검증"))
            entityManager.flush()
            entityManager.clear()

            val document = documentRepository.findByProjectId(projectResponse.id).orElseThrow()
            val projectId = projectResponse.id
            val documentId = requireNotNull(document.id)

            val latestBody =
                """{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"최신 본문"}]}]}"""
            documentService.saveDocument(
                userId = userId,
                projectId = projectId,
                documentId = documentId,
                request = SaveDocumentRequest(body = latestBody, version = 0),
            )
            entityManager.flush()
            entityManager.clear()

            // 구버전으로 충돌 유발
            var caughtConflict: DocumentConflictException? = null
            try {
                documentService.saveDocument(
                    userId = userId,
                    projectId = projectId,
                    documentId = documentId,
                    request = SaveDocumentRequest(body = """{"type":"doc","content":[]}""", version = 0),
                )
            } catch (e: DocumentConflictException) {
                caughtConflict = e
            }

            assertThat(caughtConflict).isNotNull
            // JSONB 재직렬화로 exact match 불가 — 핵심 텍스트 포함 여부로 검증
            assertThat(caughtConflict!!.currentBody).contains("최신 본문")
            assertThat(caughtConflict.currentVersion).isEqualTo(1)
        }
    }
