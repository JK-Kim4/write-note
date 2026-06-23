package com.writenote.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.scheduling.annotation.EnableAsync
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor
import java.util.concurrent.Executor

/**
 * @Async 활성화 + 전용 executor.
 *
 * 복호 실패 디스코드 알림([DecryptionFailureNotifier.notify])을 요청 스레드 밖에서 실행하기 위함.
 * best-effort 알림이므로 작은 풀 + 유계 큐로 격리한다.
 */
@Configuration
@EnableAsync
class AsyncConfig {
    @Bean("alertExecutor")
    fun alertExecutor(): Executor =
        ThreadPoolTaskExecutor().apply {
            corePoolSize = 1
            maxPoolSize = 2
            queueCapacity = 50
            setThreadNamePrefix("alert-")
            initialize()
        }
}
