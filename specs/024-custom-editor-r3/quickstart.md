# R3 Quickstart — dogfooding 시나리오

## 환경

- 풀스택: backend `bootRun`(local) + frontend `pnpm dev`(현재 멈춰 있으면 재기동 필요).
- 계정: custom-r1@writenote.local / dogfood1234, 테스트 작품 3537.
- 라우트: `/b/works/3537/custom` (R3은 아직 실험 라우트에서 dogfooding — 기본 교체는 R4).
- 브라우저: Chrome/Edge(EditContext).

## SC-001 — 5종 블록 + 4종 마크 + 소프트 줄바꿈 무손실 왕복

프레시 챕터에서:

1. **문단·제목**: H1/H2/H3 + 일반 문단 입력. (R1/R2 무회귀 확인)
2. **마크**: 한 줄 안에서 굵게/기울임/밑줄/취소선 부분 적용. (R2 무회귀)
3. **인용**: 툴바 인용 토글 → 좌측 인용선·들여쓰기 표시. 안에 마크 적용.
4. **글머리표 목록**: 항목 2~3개. 각 항목 마커(•).
5. **번호 목록**: 항목 3개 → 1·2·3 자동 번호. 중간 항목 삭제 시 번호 재계산.
6. **구분선**: 툴바 구분선 → 가로선. 위/아래 화살표로 캐럿이 건너뛰는지, Backspace로 삭제되는지.
7. **소프트 줄바꿈**: 번호 목록 항목 안에서 **Shift+Enter** → 같은 번호에 줄 추가. **Enter** → 새 번호.
8. **저장→재로드**: 페이지 새로고침 후 위 전부 그대로인지(손실 0).
9. **페이지 분할**: 본문을 A4 1장 넘게 채워 인용/목록/hr이 페이지 경계에서 안 깨지는지.

**합격 조건**: 8·9에서 화면·구조 손실 0. 거짓 dirty(타자 전 자동저장 발생) 없음.

## 한글 IME 회귀 (PoC 0-1 4케이스 재사용)

10. 빠른 타자(조합 중 다음 자모) / 조합 중 마크 토글 / 한자 변환 / Backspace 분해 — 인용·목록 블록 안에서도 정상.
11. 조합 중 Shift+Enter / 블록 토글이 조합을 깨지 않는지(compositionstart/end 가드).

## 자동 게이트 (dogfooding 전 GREEN 필수)

```bash
cd frontend
pnpm exec tsc --noEmit
pnpm exec vitest run src/components/custom-editor
pnpm build
```

- SC-002(왕복 idempotence)는 `pmConvert.test.ts` 결정론 테스트로 자동 검증.
- SC-004(무회귀)는 R1/R2 바이트 동일 테스트로 자동 검증.
