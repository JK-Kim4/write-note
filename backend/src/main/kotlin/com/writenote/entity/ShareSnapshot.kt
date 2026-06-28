package com.writenote.entity

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.GeneratedValue
import jakarta.persistence.GenerationType
import jakarta.persistence.Id
import jakarta.persistence.PrePersist
import jakarta.persistence.Table
import java.time.Instant

/**
 * 공유 스냅샷(046) — 공유 시점에 동결된 작품 본문(불변). 공개 작품 목록 겸용.
 *
 * [bodySnapshot] = 공유 시점 documents.body 암호문(owner 키)의 복사본 — 재암호화 불필요(같은 owner·DEK),
 * 공개 read 시 [com.writenote.crypto.BodyCipherService.decryptToPlain]([ShareLink.ownerId], bodySnapshot)로 평문 PM JSON 복원.
 * [projectId] 는 진짜 FK 없음(대상 삭제 보존 — 앱레벨 정합). [titleSnapshot] 으로 작품 삭제 후에도 표시 가능.
 */
@Entity
@Table(name = "share_snapshot")
class ShareSnapshot(
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    var id: Long? = null,
    @Column(name = "share_link_id", nullable = false)
    var shareLinkId: Long = 0,
    @Column(name = "project_id", nullable = false)
    var projectId: Long = 0,
    @Column(name = "title_snapshot", nullable = false)
    var titleSnapshot: String = "",
    @Column(name = "body_snapshot", nullable = false)
    var bodySnapshot: String = "",
    @Column(name = "created_at", nullable = false, updatable = false)
    var createdAt: Instant? = null,
) {
    @PrePersist
    fun prePersist() {
        if (createdAt == null) {
            createdAt = Instant.now()
        }
    }
}
