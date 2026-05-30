package com.writenote.repository

import com.writenote.entity.Memo
import org.springframework.data.domain.Page
import org.springframework.data.domain.Pageable
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query

interface MemoRepository : JpaRepository<Memo, Long> {
    fun findByIdAndUserId(
        id: Long,
        userId: Long,
    ): Memo?

    /**
     * 메모 전체 목록 — MemoProject + MemoProjectCharacter JOIN FETCH (N+1 회피).
     *
     * countQuery 분리 — 컬렉션 fetch + 페이징 HibernateException 우회.
     */
    @Query(
        value = """
            SELECT DISTINCT m FROM Memo m
            LEFT JOIN FETCH m.memoProjects mp
            LEFT JOIN FETCH mp.characters
            WHERE m.userId = :userId
        """,
        countQuery = "SELECT COUNT(m) FROM Memo m WHERE m.userId = :userId",
    )
    fun findAllWithConnectionsByUserId(
        userId: Long,
        pageable: Pageable,
    ): Page<Memo>

    /**
     * 미분류 메모 — MemoProject 연결이 없는 메모만.
     */
    @Query(
        value = """
            SELECT m FROM Memo m
            WHERE m.userId = :userId
              AND NOT EXISTS (SELECT mp FROM MemoProject mp WHERE mp.memo = m)
        """,
        countQuery = """
            SELECT COUNT(m) FROM Memo m
            WHERE m.userId = :userId
              AND NOT EXISTS (SELECT mp FROM MemoProject mp WHERE mp.memo = m)
        """,
    )
    fun findUnclassifiedByUserId(
        userId: Long,
        pageable: Pageable,
    ): Page<Memo>

    /**
     * 특정 프로젝트에 연결된 메모 목록.
     */
    @Query(
        value = """
            SELECT DISTINCT m FROM Memo m
            LEFT JOIN FETCH m.memoProjects mp
            LEFT JOIN FETCH mp.characters
            WHERE m.userId = :userId
              AND EXISTS (SELECT mp2 FROM MemoProject mp2 WHERE mp2.memo = m AND mp2.projectId = :projectId)
        """,
        countQuery = """
            SELECT COUNT(m) FROM Memo m
            WHERE m.userId = :userId
              AND EXISTS (SELECT mp2 FROM MemoProject mp2 WHERE mp2.memo = m AND mp2.projectId = :projectId)
        """,
    )
    fun findAllWithConnectionsByUserIdAndProjectId(
        userId: Long,
        projectId: Long,
        pageable: Pageable,
    ): Page<Memo>

    /**
     * 특정 인물에 연결된 메모 목록.
     */
    @Query(
        value = """
            SELECT DISTINCT m FROM Memo m
            LEFT JOIN FETCH m.memoProjects mp
            LEFT JOIN FETCH mp.characters mpc
            WHERE m.userId = :userId
              AND EXISTS (
                SELECT mpc2 FROM MemoProjectCharacter mpc2
                WHERE mpc2.memoProject.memo = m AND mpc2.characterId = :characterId
              )
        """,
        countQuery = """
            SELECT COUNT(m) FROM Memo m
            WHERE m.userId = :userId
              AND EXISTS (
                SELECT mpc2 FROM MemoProjectCharacter mpc2
                WHERE mpc2.memoProject.memo = m AND mpc2.characterId = :characterId
              )
        """,
    )
    fun findAllWithConnectionsByUserIdAndCharacterId(
        userId: Long,
        characterId: Long,
        pageable: Pageable,
    ): Page<Memo>

    /**
     * 태그 필터 — Postgres TEXT[] 는 JPQL MEMBER OF 미지원 → native SQL.
     */
    @Query(
        value = """
            SELECT * FROM memos m
            WHERE m.user_id = :userId
              AND :tag = ANY(m.tags)
            ORDER BY m.captured_at DESC
        """,
        countQuery = """
            SELECT COUNT(*) FROM memos m
            WHERE m.user_id = :userId
              AND :tag = ANY(m.tags)
        """,
        nativeQuery = true,
    )
    fun findByUserIdAndTagNative(
        userId: Long,
        tag: String,
        pageable: Pageable,
    ): Page<Memo>

    /**
     * 텍스트 검색 (body ILIKE).
     */
    @Query(
        value = """
            SELECT DISTINCT m FROM Memo m
            LEFT JOIN FETCH m.memoProjects mp
            LEFT JOIN FETCH mp.characters
            WHERE m.userId = :userId
              AND LOWER(m.body) LIKE LOWER(CONCAT('%', :q, '%'))
        """,
        countQuery = """
            SELECT COUNT(m) FROM Memo m
            WHERE m.userId = :userId
              AND LOWER(m.body) LIKE LOWER(CONCAT('%', :q, '%'))
        """,
    )
    fun findAllWithConnectionsByUserIdAndQuery(
        userId: Long,
        q: String,
        pageable: Pageable,
    ): Page<Memo>
}
