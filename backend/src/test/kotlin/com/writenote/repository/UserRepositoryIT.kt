package com.writenote.repository

import com.writenote.entity.User
import jakarta.persistence.EntityManager
import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.test.context.ActiveProfiles
import org.springframework.transaction.annotation.Transactional

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class UserRepositoryIT
    @Autowired
    constructor(
        private val userRepository: UserRepository,
        private val entityManager: EntityManager,
    ) {
        @Test
        fun `insert flush clear and select user with database created timestamp`() {
            val saved = userRepository.save(User(email = "writer@example.com"))

            entityManager.flush()
            entityManager.clear()

            val found = userRepository.findById(saved.id!!).orElseThrow()

            assertThat(found.email).isEqualTo("writer@example.com")
            assertThat(found.createdAt).isNotNull()
        }

        @Test
        fun `email must be unique`() {
            userRepository.save(User(email = "duplicate@example.com"))
            entityManager.flush()

            assertThatThrownBy { userRepository.saveAndFlush(User(email = "duplicate@example.com")) }
                .isInstanceOf(DataIntegrityViolationException::class.java)
        }
    }
