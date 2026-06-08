package com.writenote.auth

import org.springframework.stereotype.Component
import org.springframework.transaction.event.TransactionPhase
import org.springframework.transaction.event.TransactionalEventListener

@Component
class PasswordResetListener(
    private val mailSenderPort: MailSenderPort,
) {
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    fun handle(event: PasswordResetRequestedEvent) {
        mailSenderPort.sendPasswordReset(event.email, event.plaintextToken)
    }
}
