# Quickstart: Round 1 스키마 확장 기능

**Date**: 2026-06-11 · 구현·검증 진입점. 세 US 는 독립이라 어느 것부터든 시작 가능(권장 순서 = 우선순위 P1→P3).

## 사전 준비

```bash
docker compose up -d --wait postgres   # 로컬 dev DB (마이그레이션 V9~V11 적용 대상)
```

마이그레이션은 백엔드 부팅/테스트 시 Flyway 가 자동 적용(로컬 dev + Testcontainers). **운영 Supabase 적용 금지** — Round 4 일괄(사용자 컨펌 영역).

## US1 — 곁쪽지 삭제/되돌리기

**백엔드**:
1. V9 마이그레이션(`memos.deleted_at` + 부분 인덱스)
2. `Memo.kt` 에 `deletedAt: Instant?` 추가
3. `MemoRepository` 7개 쿼리(research D1 표)에 deleted 제외 — JPQL 6개 `AND m.deletedAt IS NULL`(+count 쿼리), native 1개 `AND m.deleted_at IS NULL`, `MemoProjectRepository.findAllByProjectIdWithMemo` 에 `AND m.deletedAt IS NULL`
4. 단건 경로용 `findByIdAndUserIdAndDeletedAtIsNull` 신설 → getMemo/updateMemo/curation/pin 교체. delete/restore 는 `findByIdAndUserId` 유지
5. `MemoEditService.deleteMemo` → soft delete(연결행 보존, `deleted_at=now()`). `restoreMemo` 신설
6. `MemoController` 에 `POST /{id}/restore`

**프론트**:
7. `frontend/src/components/ui/Toast.tsx` — desktop Toast 1:1 포팅(`'use client'` 추가)
8. `lib/api/memo.ts` 에 `restoreMemo` 추가
9. `webElectronApi.memos` 에 `delete`/`restore` 추가(보류 주석 해소)
10. `app/memos/page.tsx` — 삭제 버튼 + `pendingDelete` state + Toast(desktop MemoInboxScreen 1:1)

**검증**:
```bash
cd backend && ./gradlew test                        # restore·필터 통합 테스트 GREEN
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
- dogfooding: 책상에서 버리기 → 사라짐 → 되돌리기 → 작품 연결 복귀. 작품 서랍·재진입 카드에서도 제외 확인

## US2 — 설정 서버 영속

**백엔드**:
1. V10 마이그레이션(`user_settings` 테이블)
2. `UserSetting.kt`(복합키 `@IdClass`/`@EmbeddedId`) + `UserSettingRepository`
3. `SettingsService`(allowlist 검증 + upsert) + `SettingsController`(`GET`/`PUT /api/settings`)

**프론트**:
4. `lib/api/settings.ts` — `fetchSettings`/`putSettings`
5. `PreferencesSync`(client) — 인증 후 1회 hydrate(없으면 로컬값 시딩) + store 변경 구독 디바운스 PUT. 루트 레이아웃에 마운트
6. `layout.tsx` FOUC 스크립트·기존 store 소비자 무변경 확인

**검증**:
```bash
cd backend && ./gradlew test
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
- dogfooding: 브라우저 프로필 A 다크 변경 → 프로필 B 로그인 → 다크 확인. 오프라인에서 설정 변경 비차단. 새로고침 FOUC 0회

## US3 — 등장인물 확장

**백엔드**:
1. V11 마이그레이션(`age`/`gender`/`traits` + gender CHECK)
2. `Character.kt` 3필드 추가
3. `Create/UpdateCharacterRequest` + `CharacterResponse` + `CharacterMapper` 확장, gender 검증

**프론트**:
4. `lib/api/characters` `CreateCharacterInput` 확장
5. `CharacterForm` — 나이 입력 + 성별 드롭다운 + 특징 textarea
6. `Rail.tsx` — 등장인물 메뉴(목적지 = 마지막 작품 → 없으면 작품 벽)

**검증**:
```bash
cd backend && ./gradlew test
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
- dogfooding: 인물에 나이·성별·특징 저장 → 목록·집필실 인물 패널 표시. 기존 인물 무손상. Rail 메뉴 진입

## 전체 게이트 (마무리)

```bash
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build
cd frontend && pnpm typecheck && pnpm lint && pnpm test && pnpm build
```
ktlint 는 main+test **양쪽** 소스셋(회귀 사례 — agent-workflow-discipline §4).
