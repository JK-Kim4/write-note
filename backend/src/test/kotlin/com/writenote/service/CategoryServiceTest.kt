package com.writenote.service

import com.writenote.entity.Category
import com.writenote.error.ResourceNotFoundException
import com.writenote.error.ValidationException
import com.writenote.mapper.CategoryMapper
import com.writenote.model.request.CreateCategoryRequest
import com.writenote.model.request.UpdateCategoryRequest
import com.writenote.repository.CategoryProjectCount
import com.writenote.repository.CategoryRepository
import com.writenote.repository.ProjectRepository
import com.writenote.repository.UserRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.Optional

class CategoryServiceTest {
    private lateinit var categoryRepository: CategoryRepository
    private lateinit var projectRepository: ProjectRepository
    private lateinit var userRepository: UserRepository
    private lateinit var categoryMapper: CategoryMapper
    private lateinit var service: CategoryService

    @BeforeEach
    fun setUp() {
        categoryRepository = mockk()
        projectRepository = mockk()
        userRepository = mockk()
        categoryMapper = CategoryMapper()
        service = CategoryService(categoryRepository, projectRepository, userRepository, categoryMapper)
    }

    private fun count(
        categoryId: Long,
        cnt: Long,
    ): CategoryProjectCount =
        object : CategoryProjectCount {
            override val categoryId = categoryId
            override val cnt = cnt
        }

    private fun savedCategory(c: Category): Category =
        c.apply {
            id = id ?: 100L
            createdAt = createdAt ?: Instant.now()
            updatedAt = updatedAt ?: Instant.now()
        }

    // ── create ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("create — name trim 영속, sortOrder = max+1, projectCount 0")
    fun `create persists trimmed name with next sortOrder`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { categoryRepository.maxSortOrder(eq(1L)) } returns 4
        val captured = slot<Category>()
        every { categoryRepository.save(capture(captured)) } answers { savedCategory(firstArg()) }

        val response = service.create(1L, CreateCategoryRequest(name = "  단편 모음  "))

        assertThat(captured.captured.name).isEqualTo("단편 모음")
        assertThat(captured.captured.userId).isEqualTo(1L)
        assertThat(captured.captured.sortOrder).isEqualTo(5)
        assertThat(captured.captured.parentId).isNull()
        assertThat(response.projectCount).isEqualTo(0)
    }

    @Test
    @DisplayName("create — 첫 모음 sortOrder = 0 (max=-1)")
    fun `create first category sortOrder zero`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { categoryRepository.maxSortOrder(eq(1L)) } returns -1
        val captured = slot<Category>()
        every { categoryRepository.save(capture(captured)) } answers { savedCategory(firstArg()) }

        service.create(1L, CreateCategoryRequest(name = "첫 모음"))

        assertThat(captured.captured.sortOrder).isEqualTo(0)
    }

    @Test
    @DisplayName("create — parentId 비-null 은 ValidationException (v1 1뎁스 강제)")
    fun `create rejects non-null parentId`() {
        every { userRepository.existsById(eq(1L)) } returns true

        assertThatThrownBy { service.create(1L, CreateCategoryRequest(name = "하위", parentId = 9L)) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("create — 공백만 name 은 ValidationException")
    fun `create rejects blank name`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { categoryRepository.maxSortOrder(eq(1L)) } returns -1

        assertThatThrownBy { service.create(1L, CreateCategoryRequest(name = "   ")) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("create — 존재하지 않는 사용자는 ResourceNotFoundException")
    fun `create rejects unknown user`() {
        every { userRepository.existsById(eq(9L)) } returns false

        assertThatThrownBy { service.create(9L, CreateCategoryRequest(name = "x")) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── list ────────────────────────────────────────────────────────────────

    @Test
    @DisplayName("list — 빈 모음 포함 전량 + projectCount 매핑(없으면 0)")
    fun `list maps projectCount including empty categories`() {
        val now = Instant.now()
        every { userRepository.existsById(eq(1L)) } returns true
        every { categoryRepository.findByUserIdOrderBySortOrderAscIdAsc(eq(1L)) } returns
            listOf(
                Category(id = 10L, userId = 1L, name = "A", sortOrder = 0, createdAt = now, updatedAt = now),
                Category(id = 20L, userId = 1L, name = "B(빈)", sortOrder = 1, createdAt = now, updatedAt = now),
            )
        every { projectRepository.countActiveByCategory(eq(1L)) } returns listOf(count(10L, 3L))

        val result = service.list(1L)

        assertThat(result).hasSize(2)
        assertThat(result.first { it.id == 10L }.projectCount).isEqualTo(3)
        assertThat(result.first { it.id == 20L }.projectCount).isEqualTo(0)
    }

    @Test
    @DisplayName("list — 모음 없으면 빈 목록 (count 쿼리 미호출)")
    fun `list returns empty without count query`() {
        every { userRepository.existsById(eq(1L)) } returns true
        every { categoryRepository.findByUserIdOrderBySortOrderAscIdAsc(eq(1L)) } returns emptyList()

        assertThat(service.list(1L)).isEmpty()
        verify(exactly = 0) { projectRepository.countActiveByCategory(any()) }
    }

    // ── rename ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("rename — name trim 갱신, sortOrder 갱신")
    fun `rename updates name and sortOrder`() {
        val category =
            Category(id = 7L, userId = 1L, name = "임시", sortOrder = 0, createdAt = Instant.now(), updatedAt = Instant.now())
        every { categoryRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns Optional.of(category)
        every { projectRepository.countActiveByCategory(eq(1L)) } returns listOf(count(7L, 2L))

        val response = service.rename(1L, 7L, UpdateCategoryRequest(name = "  장편 판타지  ", sortOrder = 3))

        assertThat(category.name).isEqualTo("장편 판타지")
        assertThat(category.sortOrder).isEqualTo(3)
        assertThat(response.projectCount).isEqualTo(2)
    }

    @Test
    @DisplayName("rename — 공백만 name 은 ValidationException")
    fun `rename rejects blank name`() {
        val category =
            Category(id = 7L, userId = 1L, name = "임시", createdAt = Instant.now(), updatedAt = Instant.now())
        every { categoryRepository.findByIdAndUserId(eq(7L), eq(1L)) } returns Optional.of(category)

        assertThatThrownBy { service.rename(1L, 7L, UpdateCategoryRequest(name = "   ")) }
            .isInstanceOf(ValidationException::class.java)
    }

    @Test
    @DisplayName("rename — 본인 모음 아니면 ResourceNotFoundException")
    fun `rename rejects non-owner`() {
        every { categoryRepository.findByIdAndUserId(eq(99L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy { service.rename(1L, 99L, UpdateCategoryRequest(name = "x")) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }

    // ── delete ──────────────────────────────────────────────────────────────

    @Test
    @DisplayName("delete — 본인 모음 repository.delete 위임(작품 보존은 DB SET NULL)")
    fun `delete delegates to repository`() {
        val category =
            Category(id = 8L, userId = 1L, name = "삭제대상", createdAt = Instant.now(), updatedAt = Instant.now())
        every { categoryRepository.findByIdAndUserId(eq(8L), eq(1L)) } returns Optional.of(category)
        every { categoryRepository.delete(eq(category)) } returns Unit

        service.delete(1L, 8L)

        verify(exactly = 1) { categoryRepository.delete(eq(category)) }
    }

    @Test
    @DisplayName("delete — 본인 모음 아니면 ResourceNotFoundException")
    fun `delete rejects non-owner`() {
        every { categoryRepository.findByIdAndUserId(eq(99L), eq(1L)) } returns Optional.empty()

        assertThatThrownBy { service.delete(1L, 99L) }
            .isInstanceOf(ResourceNotFoundException::class.java)
    }
}
