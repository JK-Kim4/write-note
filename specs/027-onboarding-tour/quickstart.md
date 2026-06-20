# Quickstart: 온보딩 가이드 투어 검증

## 자동 게이트

```bash
# 백엔드 — settings 키 검증 테스트 + 전체 게이트
cd backend && ./gradlew ktlintMainSourceSetCheck ktlintTestSourceSetCheck checkstyleMain test build

# 프론트 — 행위 테스트 + 타입 + RSC 경계
cd frontend && pnpm lint && pnpm typecheck && pnpm vitest run && pnpm build
```

기대:
- BE: `onboardingCompleted: "true"` 허용 / `"false"` 거부 GREEN.
- FE: OnboardingTour 행위 3종(미완료→drive / 완료→미시작 / onDestroyed→PUT) GREEN, `pnpm build` 성공(RSC 경계).

## Dogfooding (실제 브라우저)

가이드는 시각·DOM 오버레이라 단위 테스트로 못 잡는 영역(딤·강조·말풍선 위치)은 직접 확인.

1. **최초 노출**: `onboardingCompleted` 미저장 계정으로 로그인 → 홈 진입 → 가이드 자동 시작, "새 작품" 버튼 강조 + 말풍선.
2. **단계 진행**: "다음" → 메모 → 인물 → 집필 순서로 강조 이동. 진행 표시("1 of 4").
3. **완료 저장**: 마지막 "시작하기" → 가이드 종료. 새로고침/재로그인 시 **다시 안 뜸**.
4. **건너뛰기**: (다른 계정) 첫 단계에서 close/ESC → 즉시 종료 + 완료 저장 → 재진입 미노출.
5. **기기 무관 1회**: 한 기기에서 완료 후 다른 브라우저로 로그인 → 미노출(서버 영속 확인).
6. **모바일 네비**: 좁은 폭에서 네비가 접히는 경우 대상 강조 동작 확인(research R-4).
7. **비차단**: 가이드 도중/실패해도 로그인·집필 등 핵심 동작 정상(FR-007/SC-004).

## 배포 메모

- 백엔드 변경(허용 키 1줄)은 FE 가 `onboardingCompleted` 를 PUT 하기 전에 라이브여야 함
  (미등록 키면 400). → **BE 선행 → FE 후행** 배포.
