# Quickstart: 작품 카테고리 분류 (032)

## 무엇을 만드나
작품 페이지(`/library`)에 "모음(폴더)"을 도입. 루트에 모음 타일 + 미분류 작품, 모음을 열고 들어가 탐색(드릴인), 작품 카드를 모음 타일로 드래그해 분류. N뎁스 설계 보유(v1 1뎁스).

## 검증 게이트
- **BE**: `cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build`
- **FE**: `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
- **DB**: 마이그레이션 적용은 **사용자 컨펌**(external-infra-safety). IT 는 Testcontainers 자동.

## 라운드 (BE 선행 → FE 후행)

### R1 — 백엔드 (먼저 배포)
1. `V20__create_categories_and_project_category.sql` 작성(data-model.md SQL)
2. `Category` 엔티티 + `CategoryRepository`(findByIdAndUserId, findByUserIdOrderBySortOrderAscIdAsc, projectCount group-by)
3. `Project` 엔티티 `categoryId` 필드 + `ProjectResponse`/`ProjectCardResponse`/`ProjectMapper` categoryId
4. `CategoryService`(create/list+count/rename/delete) + `ProjectService.moveCategory`
5. `CategoryController`(POST/GET/PATCH/DELETE) + `ProjectController` 이동 엔드포인트
6. 게이트 GREEN → BE 배포(Docker blue-green)

### R2 — 프론트 (BE 배포 후)
1. 훅: `useCategories`(GET), `useCreateCategory`/`useRenameCategory`/`useDeleteCategory`, `useMoveProjectCategory`(PATCH, 낙관적 업데이트+롤백). `useProjectCards` 재사용
2. `/library` 드릴인: `?folder=<id>` URL 상태. 루트=모음 타일+미분류 / 폴더=경로+해당 작품
3. `@dnd-kit` DndContext + 카드 useDraggable + 타일/경로 useDroppable. activation distance 로 클릭(열기)/드래그(이동) 구분
4. 카드 `⋯ 이동` 메뉴(터치·키보드 대안) + 모음 타일 `⋯`(이름변경/삭제 confirm)
5. "+ 새 모음" 생성. 용어 전부 "모음"
6. 게이트 GREEN(특히 `pnpm build` = RSC 경계) → FE 배포(git push)

## TDD 순서 (CLAUDE.md §5)
- BE: Category 매핑/검증 → CategoryService 유스케이스(create/list/rename/delete/move, 소유 404, parentId 400) → Controller IT(Testcontainers). 한 번에 1 테스트.
- FE: 훅 매핑/이동 낙관적 업데이트 → 컴포넌트 행위(드래그 드롭 후 그룹 이동, ⋯ 메뉴 이동, 드릴인). dnd-kit 은 행위 검증.

## dogfooding 게이트 (자체 검증 한계 영역)
- 드래그 드롭 실제 감각(데스크탑) / 터치 ⋯ 이동 / 드릴인 뒤로가기·새로고침 URL 보존 / 모음 삭제 시 작품 미분류 복귀 / 빈 모음 표시 — 운영(인증 뒤) 검증. 자동 게이트 GREEN 을 authed 정합 증거로 단정 금지(CLAUDE.md §19).
