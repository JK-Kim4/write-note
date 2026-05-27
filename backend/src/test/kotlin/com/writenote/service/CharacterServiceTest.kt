package com.writenote.service

import com.writenote.components.characters.CharacterReorderValidator
import com.writenote.entity.Character
import com.writenote.entity.Project
import com.writenote.error.ResourceNotFoundException
import com.writenote.mapper.CharacterMapper
import com.writenote.model.request.CreateCharacterRequest
import com.writenote.model.request.ReorderCharactersRequest
import com.writenote.model.request.UpdateCharacterRequest
import com.writenote.model.response.CharacterResponse
import com.writenote.repository.CharacterRepository
import io.mockk.every
import io.mockk.mockk
import io.mockk.slot
import io.mockk.verify
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.DisplayName
import org.junit.jupiter.api.Test
import org.springframework.data.domain.PageImpl
import org.springframework.data.domain.PageRequest
import java.time.Instant
import java.util.Optional

class CharacterServiceTest {
    private lateinit var characterRepository: CharacterRepository
    private lateinit var projectService: ProjectService
    private lateinit var characterMapper: CharacterMapper
    private lateinit var reorderValidator: CharacterReorderValidator
    private lateinit var service: CharacterService

    @BeforeEach
    fun setUp() {
        characterRepository = mockk()
        projectService = mockk()
        characterMapper = mockk()
        reorderValidator = mockk(relaxed = true)
        service = CharacterService(characterRepository, projectService, characterMapper, reorderValidator)
    }

    private fun newProject(
        userId: Long = 1L,
        projectId: Long = 10L,
    ): Project =
        Project(
            id = projectId,
            userId = userId,
            title = "x",
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    private fun newCharacter(
        id: Long = 100L,
        projectId: Long = 10L,
        name: String = "민지",
        displayOrder: Int = 0,
    ): Character =
        Character(
            id = id,
            projectId = projectId,
            name = name,
            shortDescription = "주인공",
            notes = null,
            displayOrder = displayOrder,
            createdAt = Instant.now(),
            updatedAt = Instant.now(),
        )

    private fun stubMapper(character: Character): CharacterResponse {
        val response =
            CharacterResponse(
                id = character.id ?: 999L,
                projectId = character.projectId,
                name = character.name,
                shortDescription = character.shortDescription,
                notes = character.notes,
                displayOrder = character.displayOrder,
                createdAt = character.createdAt ?: Instant.now(),
                updatedAt = character.updatedAt ?: Instant.now(),
            )
        every { characterMapper.toResponse(eq(character)) } returns response
        return response
    }

    @Test
    @DisplayName("listCharacters — ownership 통과 후 Page 반환 (display_order ASC 정렬은 Repository 책임)")
    fun `listCharacters returns paged response after ownership check`() {
        val project = newProject()
        val character1 = newCharacter(id = 101L, displayOrder = 0)
        val character2 = newCharacter(id = 102L, name = "할머니", displayOrder = 1)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(eq(10L), any())
        } returns PageImpl(listOf(character1, character2), PageRequest.of(0, 50), 2)
        every { characterMapper.toResponse(any()) } answers { stubMapper(firstArg<Character>()) }

        val response = service.listCharacters(userId = 1L, projectId = 10L, page = 0, size = 50)

        assertThat(response.totalElements).isEqualTo(2)
        assertThat(response.content).hasSize(2)
        assertThat(response.content[0].id).isEqualTo(101L)
        assertThat(response.content[1].id).isEqualTo(102L)
    }

    @Test
    @DisplayName("getCharacter — ownership 통과 후 단건 반환")
    fun `getCharacter returns single after ownership and lookup`() {
        val project = newProject()
        val character = newCharacter()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { characterRepository.findByIdAndProjectId(eq(100L), eq(10L)) } returns Optional.of(character)
        every { characterMapper.toResponse(eq(character)) } answers { stubMapper(character) }

        val response = service.getCharacter(userId = 1L, projectId = 10L, characterId = 100L)

        assertThat(response.id).isEqualTo(100L)
        assertThat(response.name).isEqualTo("민지")
    }

    @Test
    @DisplayName("getCharacter — 다른 projectId 의 character 접근 시 ResourceNotFoundException (FR-015)")
    fun `getCharacter throws when character not in project`() {
        val project = newProject()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { characterRepository.findByIdAndProjectId(eq(999L), eq(10L)) } returns Optional.empty()

        assertThatThrownBy {
            service.getCharacter(userId = 1L, projectId = 10L, characterId = 999L)
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }

    @Test
    @DisplayName("createCharacter — name + displayOrder default 0 + 영속 (US4)")
    fun `createCharacter persists with default displayOrder`() {
        val project = newProject()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        val captured = slot<Character>()
        every { characterRepository.save(capture(captured)) } answers { firstArg<Character>().apply { id = 100L } }
        every { characterMapper.toResponse(any()) } answers { stubMapper(firstArg<Character>()) }

        val request =
            CreateCharacterRequest(
                name = "민지",
                shortDescription = "주인공",
                notes = "회상 능숙",
                displayOrder = null,
            )

        service.createCharacter(userId = 1L, projectId = 10L, request = request)

        val saved = captured.captured
        assertThat(saved.projectId).isEqualTo(10L)
        assertThat(saved.name).isEqualTo("민지")
        assertThat(saved.shortDescription).isEqualTo("주인공")
        assertThat(saved.notes).isEqualTo("회상 능숙")
        assertThat(saved.displayOrder).isEqualTo(0)
    }

    @Test
    @DisplayName("createCharacter — displayOrder 명시값은 그대로 박힘")
    fun `createCharacter respects explicit displayOrder`() {
        val project = newProject()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        val captured = slot<Character>()
        every { characterRepository.save(capture(captured)) } answers { firstArg<Character>().apply { id = 100L } }
        every { characterMapper.toResponse(any()) } answers { stubMapper(firstArg<Character>()) }

        service.createCharacter(
            userId = 1L,
            projectId = 10L,
            request = CreateCharacterRequest(name = "할머니", displayOrder = 5),
        )

        assertThat(captured.captured.displayOrder).isEqualTo(5)
    }

    @Test
    @DisplayName("updateCharacter — null 필드는 미변경, 명시값은 갱신 (FR-014)")
    fun `updateCharacter only mutates specified fields`() {
        val project = newProject()
        val existing = newCharacter()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { characterRepository.findByIdAndProjectId(eq(100L), eq(10L)) } returns Optional.of(existing)
        every { characterMapper.toResponse(eq(existing)) } answers { stubMapper(existing) }

        service.updateCharacter(
            userId = 1L,
            projectId = 10L,
            characterId = 100L,
            request =
                UpdateCharacterRequest(
                    shortDescription = "주인공, 24세 갱신",
                    notes = null,
                ),
        )

        assertThat(existing.name).isEqualTo("민지")
        assertThat(existing.shortDescription).isEqualTo("주인공, 24세 갱신")
        assertThat(existing.notes).isNull()
        assertThat(existing.displayOrder).isEqualTo(0)
    }

    @Test
    @DisplayName("deleteCharacter — ownership + character load 후 entity-level delete (default A 패턴)")
    fun `deleteCharacter loads and deletes via repository`() {
        val project = newProject()
        val character = newCharacter()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every { characterRepository.findByIdAndProjectId(eq(100L), eq(10L)) } returns Optional.of(character)
        every { characterRepository.delete(eq(character)) } returns Unit

        service.deleteCharacter(userId = 1L, projectId = 10L, characterId = 100L)

        verify(exactly = 1) { characterRepository.delete(eq(character)) }
    }

    @Test
    @DisplayName("reorderCharacters — ownership + Validator 호출 + displayOrder = index 일괄 갱신 (FR-016)")
    fun `reorderCharacters updates displayOrder by index`() {
        val project = newProject()
        val char1 = newCharacter(id = 101L, displayOrder = 0)
        val char2 = newCharacter(id = 102L, name = "할머니", displayOrder = 1)
        val char3 = newCharacter(id = 103L, name = "옆집", displayOrder = 2)
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(eq(10L))
        } returns listOf(char1, char2, char3)
        every { characterMapper.toResponse(any()) } answers { stubMapper(firstArg<Character>()) }

        // new order = [102, 101, 103] → 102 = 0, 101 = 1, 103 = 2
        val response =
            service.reorderCharacters(
                userId = 1L,
                projectId = 10L,
                request = ReorderCharactersRequest(characterIds = listOf(102L, 101L, 103L)),
            )

        verify(exactly = 1) {
            reorderValidator.validate(
                match { it.characterIds == listOf(102L, 101L, 103L) },
                eq(listOf(char1, char2, char3)),
            )
        }
        assertThat(char2.displayOrder).isEqualTo(0)
        assertThat(char1.displayOrder).isEqualTo(1)
        assertThat(char3.displayOrder).isEqualTo(2)
        assertThat(response.totalElements).isEqualTo(3)
        // 응답 순서 = 새 순서 (contracts #24)
        assertThat(response.content.map { it.id }).containsExactly(102L, 101L, 103L)
    }

    @Test
    @DisplayName("reorderCharacters — 빈 배열 + 인물 0명 = no-op (contracts #24 Edge case)")
    fun `reorderCharacters no-op for empty project`() {
        val project = newProject()
        every { projectService.requireOwnedProject(eq(1L), eq(10L)) } returns project
        every {
            characterRepository.findAllByProjectIdOrderByDisplayOrderAscCreatedAtAsc(eq(10L))
        } returns emptyList()

        val response =
            service.reorderCharacters(
                userId = 1L,
                projectId = 10L,
                request = ReorderCharactersRequest(characterIds = emptyList()),
            )

        assertThat(response.totalElements).isEqualTo(0)
        assertThat(response.content).isEmpty()
    }

    @Test
    @DisplayName("cross user — requireOwnedProject 가 throw 박으면 그대로 전파 (FR-015)")
    fun `cross user access throws via project ownership check`() {
        every { projectService.requireOwnedProject(eq(99L), eq(10L)) } throws
            ResourceNotFoundException("Project not found")

        assertThatThrownBy {
            service.listCharacters(userId = 99L, projectId = 10L, page = 0, size = 50)
        }.isInstanceOf(ResourceNotFoundException::class.java)
        assertThatThrownBy {
            service.createCharacter(
                userId = 99L,
                projectId = 10L,
                request = CreateCharacterRequest(name = "spy"),
            )
        }.isInstanceOf(ResourceNotFoundException::class.java)
    }
}
