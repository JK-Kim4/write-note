# Owner Context Migration Contract — Phase 1B Backend Auth Foundation

**Date**: 2026-05-23
**Spec**: [../spec.md](../spec.md) / **Plan**: [../plan.md](../plan.md)

본 문서는 001 spec (`specs/001-phase-1a-backend-scaffold`) 에서 도입한 임시 `X-User-Id` 헤더 기반 owner 식별을 본 spec 의 인증된 principal 기반으로 교체하는 흐름을 박는다. FR-027, FR-028, SC-008 의 구현 contract.

---

## 1. 기존 (001) 흐름

001 의 `ProjectController` (검증 필요 — 구현 단계 진입 시 grep 으로 실제 구조 확인):

```kotlin
@RestController
@RequestMapping("/api/projects")
class ProjectController(
    private val projectService: ProjectService,
) {
    @GetMapping
    fun list(
        @RequestHeader("X-User-Id") userId: Long,
        pageable: Pageable,
    ): ResponseEntity<Result<Page<ProjectResponse>>> = ...

    @PostMapping
    fun create(
        @RequestHeader("X-User-Id") userId: Long,
        @Valid @RequestBody request: CreateProjectRequest,
    ): ResponseEntity<Result<ProjectResponse>> = ...

    // 그 외 4 endpoint (단건 조회 / 수정 / 보관 / 보관 해제) 동일 패턴
}
```

`ProjectService` 가 `userId` 파라미터를 받아 Repository 호출 시 `WHERE user_id = :userId` 강제.

**문제**: 클라이언트가 헤더로 owner 를 임의 변조 가능 — 다른 사용자의 데이터에 접근 가능 (`X-User-Id: 1` → `X-User-Id: 2` 로 변조). 본 spec 인증 도입 이전의 placeholder 기제.

---

## 2. 본 spec 의 교체

`ProjectController` 갱신:

```kotlin
@RestController
@RequestMapping("/api/projects")
class ProjectController(
    private val projectService: ProjectService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @PageableDefault(size = 20, sort = ["updatedAt"], direction = Sort.Direction.DESC) pageable: Pageable,
    ): ResponseEntity<Result<Page<ProjectResponse>>> =
        ResponseEntity.ok(Result.ok(projectService.list(principal.userId, pageable)))

    @PostMapping
    fun create(
        @AuthenticationPrincipal principal: AuthenticatedPrincipal,
        @Valid @RequestBody request: CreateProjectRequest,
    ): ResponseEntity<Result<ProjectResponse>> = ...

    // 그 외 동일 — @RequestHeader("X-User-Id") userId 모두 @AuthenticationPrincipal principal 로 교체
}
```

`ProjectService.list(userId, pageable)` 시그니처는 유지 — 호출자가 헤더 대신 principal 에서 userId 추출하여 전달.

---

## 3. 변경 범위 매트릭스

| 파일 | 변경 |
|---|---|
| `controller/ProjectController.kt` | `@RequestHeader("X-User-Id")` 모두 `@AuthenticationPrincipal AuthenticatedPrincipal` 로 교체 (6 endpoint) |
| `service/ProjectService.kt` | 시그니처 변경 없음 (이미 `userId: Long` 파라미터 받음) |
| `config/SecurityConfig.kt` | `/api/projects/**` 를 보호 endpoint 로 명시 (현재 baseline 가 permit-all 이라면 본 spec 에서 보호로 전환) |
| `test/.../ProjectControllerWebTest.kt` (기존) | mock 호출 시 `X-User-Id` 헤더 → `@WithMockUser` 또는 `MockMvc` 의 JWT 헤더 주입으로 교체 |
| `test/.../ProjectControllerOwnerCleanupTest.kt` (신설) | 회귀 테스트 — X-User-Id 헤더 명시 + JWT 둘 다 보내도 JWT 가 우선 |

→ 본 변경은 단일 controller + 시그니처 명확 → R-12 의 "직접 수행" 범위.

---

## 4. 회귀 테스트 cover 목표

1. **인증된 호출**: 유효 JWT 로 `/api/projects` 호출 → 200 + 본인 프로젝트 list
2. **비인증 호출**: JWT 없이 호출 → 401 `AUTH_TOKEN_MISSING`
3. **X-User-Id 헤더 변조 시도**: `X-User-Id: 99` 명시 + 유효 JWT (sub=42) → 응답 본문이 user 42 의 프로젝트만 (헤더 무시)
4. **다른 사용자 리소스 접근**: user 42 의 JWT 로 user 99 의 프로젝트 단건 조회 → 404 `RESOURCE_NOT_FOUND` (정보 노출 회피)
5. **owner 변조 시도 (생성)**: JWT (sub=42) + body 에 `userId: 99` 명시 (만약 DTO 가 그 필드를 가지고 있다면) → user 42 의 프로젝트로 생성 (DTO 의 userId 무시 또는 DTO 자체에 userId 필드 미포함)

DTO 검증:
- `CreateProjectRequest` / `UpdateProjectRequest` 에 `userId` 필드가 있으면 본 spec 진입 시 제거. owner 는 principal 에서만 도출.

---

## 5. SC-008 검증

본 spec 완료 시점에 임시 `X-User-Id` 헤더의 런타임 사용처가 0건 (SC-008). 검증 방법:

```bash
# backend/src/main/kotlin 안에서 X-User-Id 사용처 검색
grep -rn "X-User-Id" /Users/jongwan-air/Desktop/workspaces/write-note/backend/src/main/
# 결과 0건 의무
```

(테스트 코드 안의 X-User-Id 검색도 회귀 테스트의 "변조 시도 헤더 무시" 검증 외에는 0건이어야 한다.)

---

## 6. 002 (frontend) 와의 정합

002 의 `frontend/src/lib/api/client.ts` 가 임시 `X-User-Id` 헤더를 자동 주입하고 있다 (`docs/plan/02-progress.md §1 002`). 본 spec 완료 시점에 backend 가 헤더를 무시하므로 frontend 의 헤더 주입도 제거해야 하지만, 본 spec 은 **백엔드 한정** 이라 frontend 의 헤더 주입 코드 제거는 본 spec 의 직접 산출물 아님.

**처리 방향**:
- 본 spec 완료 시점에 backend 가 `X-User-Id` 헤더를 받아도 무시 (보호 endpoint 의 401 + JWT 우선) → frontend 의 임시 주입 코드가 그대로여도 동작은 깨지지 않음 (헤더만 무시).
- frontend 의 `X-User-Id` 주입 제거 + JWT 헤더 자동 주입 추가는 **별도 spec** (인증 화면 결선 spec) 의 산출물. 본 spec 의 SC-008 은 backend 한정.
- 본 spec 완료 시점에 `docs/plan/02-progress.md` 의 §3 별도 트랙 entry 박음 — "frontend `X-User-Id` 헤더 자동 주입 제거 + JWT 자동 주입 추가".

---

## 7. 본 contract 의 회귀 차단 효과

본 contract 정합 후 회귀 방지 영역:

- 임시 헤더로 owner 변조 시도 → 무시 (보안 회귀 차단)
- 비인증 호출 → 401 (인증 우회 회귀 차단)
- 다른 사용자 리소스 접근 → 404 (정보 노출 회피 회귀 차단)
- DTO 에 owner 필드 noise → 제거 (불필요 필드 회귀 차단)

→ FR-026 ~ FR-028, SC-007, SC-008.
