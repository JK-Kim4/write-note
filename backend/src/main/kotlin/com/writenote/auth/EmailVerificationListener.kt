package com.writenote.auth

import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class EmailVerificationListener(
    private val mailSenderPort: MailSenderPort,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun handle(event: EmailVerificationRequestedEvent) {
        mailSenderPort.sendEmailVerification(event.email, event.plaintextToken)
    }
}
