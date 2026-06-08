package com.writenote

import org.assertj.core.api.Assertions.assertThat
import org.assertj.core.api.Assertions.assertThatThrownBy
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.core.env.Environment
import org.springframework.core.io.ClassPathResource
import org.springframework.test.context.ActiveProfiles

@SpringBootTest
@ActiveProfiles("test")
class BackendApplicationTests {
    @Autowired
    private lateinit var environment: Environment

    @Test
    fun contextLoads() {
    }

    @Test
    fun `poc runtime classes are absent`() {
        assertThatThrownBy { Class.forName("com.writenote.poc.PingEntity") }
            .isInstanceOf(ClassNotFoundException::class.java)
        assertThatThrownBy { Class.forName("com.writenote.poc.PingRepository") }
            .isInstanceOf(ClassNotFoundException::class.java)
    }

    @Test
    fun `test profile starts without production secrets`() {
        assertThat(environment.activeProfiles).contains("test")
        assertThat(environment.getProperty("spring.datasource.url"))
            .isEqualTo("jdbc:postgresql://localhost:5432/writenote")
        assertThat(environment.getProperty("spring.datasource.username")).isEqualTo("writenote")
        assertThat(environment.getProperty("spring.datasource.password")).isEqualTo("writenote-local-dev")
    }

    @Test
    fun `production datasource configuration uses environment placeholders only`() {
        val prodConfig = ClassPathResource("application-prod.yml").inputStream.bufferedReader().use { reader -> reader.readText() }

        assertThat(prodConfig).contains("\${DATABASE_URL}")
        assertThat(prodConfig).contains("\${DATABASE_USERNAME}")
        assertThat(prodConfig).contains("\${DATABASE_PASSWORD}")
        assertThat(prodConfig).contains("\${FRONTEND_ORIGINS}")
        assertThat(prodConfig).doesNotContain("writenote-local-dev")
        assertThat(prodConfig).doesNotContain("jdbc:postgresql://localhost")
    }
}
