# 자체 에디터 엔진 2라운드(마크·혼합폰트) — 인수인계

- 일자: 2026-06-15
- 브랜치: `024-custom-editor` (base develop) · 워크트리: `../write-note-024-custom-editor` (repo 바깥, 격리)
- 상태: **1라운드 완료(US1~US3 + dogfooding 통과, 커밋 `973f63c`까지).** 다음 = 2라운드(마크 + 혼합 스타일 줄 측정)
- 독자: 컨텍스트 0인 새 세션. 이 문서 하나로 진입 가능하게 작성.

---

## 0. TL;DR

집필 에디터를 TipTap(CSS `column-wrap`)에서 **자체 EditContext 엔진**으로 교체하는 다라운드 작업. **1라운드(구조: 문단·제목·저장·분할·undo·클립보드)는 끝났고 실제 집필실(`/b/works/[id]/custom`)에서 dogfooding 통과**했다. **2라운드 = 마크(bold/italic/underline/strike) + 한 줄 *안* 혼합 스타일 측정** — 1라운드가 의도적으로 미룬 "드래그한 부분만 굵게/폰트"가 여기.

**바로 보기:** 풀스택 띄우고(§6) Chrome 으로 `/b/works/<projectId>/custom`.
**엔진 테스트:** `cd frontend && pnpm exec vitest run src/components/custom-editor` (115 GREEN)

---

## 1. 먼저 읽을 것 (진입 자료)

1. **본 문서** — 2라운드 진입점.
2. `specs/024-custom-editor-r1/` — 1라운드 SDD 산출물(spec·plan·research·data-model·contracts·tasks). **2라운드도 이 토대 위에서 spec/plan/tasks를 새로 뜬다.**
3. `docs/retrospectives/2026-06-15-custom-editor-r1-build-dogfooding.md` — 1라운드 회고. **§4 어긋난 점·§5 교훈을 반드시 정독**(같은 회귀 반복 금지).
4. `docs/handoff/2026-06-15-custom-editor-handoff-to-fullbuild.md` — 1라운드 진입 핸드오프(PoC 결과·근본동기·전체 로드맵).
5. 코드: `frontend/src/components/custom-editor/` 전체.

---

## 2. 2라운드 범위 (GitHub 마일스톤 #8 = "자체 에디터 R2: 마크·혼합폰트 줄측정")

이슈 5개(작업내용 coarse 추적 — 진입 시 speckit으로 세부 분해):
- **#65 마크 데이터 모델** — 평문 버퍼 → run 단위 속성(구간별 bold/italic/underline/strike). **열린 설계: flat run-list vs tree**(research §8). 브레인스토밍에서 확정.
- **#66 혼합 스타일 줄 측정/캐럿/선택 일반화 (가장 무거운 작업)** — 한 줄 안에서 run마다 글자 advance가 달라짐 → `measureParagraphLines`/`measureLineXs`/`caretToScreen`/`screenToCaret`/`selectionRects`를 run 단위 가변 폰트로. **canvas 금지(DOM Range 유지 — 1라운드 회귀룰).**
- **#67 PM JSON 마크 왕복 + 마크 툴바/단축키** — `pmConvert`가 마크 무손실 왕복(현재 평탄화) + 토글 UI(Cmd+B/I/U). **IME 가드 정합(아래 §5).**
- **#68 caret affinity 정식 추적** — 1라운드 `< vs <=` 워크어라운드 대체(wrap/마크 경계).
- **#69 dogfooding + 무회귀** — CDP + 한글 IME + 1라운드 기능 무회귀.

R3~R5(패리티·완전대체·후반)는 마일스톤 #9/#10/#11 + 에픽 #70/#71/#72. 2라운드 범위 밖.

---

## 3. 1라운드가 만들어 둔 것 — 코드맵 (`frontend/src/components/custom-editor/`)

| 파일 | 역할 | 2라운드 영향 |
|---|---|---|
| `geometry.ts` | 용지·폰트→기하(실제 mm), `blockFont`(heading 배수), A2 포함 | 마크별 폰트(굵게=동일 fontSize, 측정만 변동)는 measure에서 처리 |
| `layoutEngine.ts` | 순수 분할(줄별 height만 봄) | **무수정**(가변 줄높이 이미 처리) |
| `measure.ts` | DOM Range 측정(`measureParagraphLines`/`measureLineXs`) — **단일 폰트 파라미터** | ★ **run 단위 가변 스타일로 일반화**(핵심) |
| `model.ts` | `DocModel`={buffer, blockAttrs} + 편집연산 + `reconcileAttrs`·`blockIndexAt`·`toggleHeading` | ★ **run 단위 마크 속성 추가** |
| `pmConvert.ts` | PM JSON ↔ 모델(문단·제목; **마크 평탄화**) | ★ **마크 무손실 왕복** |
| `history.ts` | undo/redo 스냅샷 | 스냅샷에 마크 포함 |
| `outline.ts`·`useCustomOutline.ts` | 목차(모델 파생 + DOM 스크래핑 body 관찰) | 무영향 |
| `CustomEditor.tsx` | **메인** — EditContext 입력루프·캐럿/선택/드래그/키보드·렌더·툴바(본문/제목)·zoom·fit-to-width·copy/cut/paste·undo·**composingRef IME 가드** | ★ run 단위 캐럿/선택/렌더 + 마크 툴바 |
| `BCustomChapterEditor.tsx` | `useDocumentSession` 결선(serverBody 정규화·flushLatest) | 무영향(경계 변환만) |

라우트 `frontend/src/app/b/works/[id]/custom/page.tsx` + 공유 셸 `frontend/src/components/b/BStudioShell.tsx`(1라운드 추출, 기본 B형과 공유 — 패널 240/240).

**아키텍처 핵심:** 디스크는 PM JSON(`documents.bodyJson`) 유지, 경계 양방향 변환. 자동저장(016)·버전토큰·충돌·draft 무수정 재사용. **백엔드 변경 0**(2라운드도 유지 목표).

---

## 4. 검증된 사실 (1라운드 dogfooding 통과)

문단·제목 쓰기 / 저장·재로드 / 줄단위 페이지분할 / 제목 H1~3·목차 / undo·redo / 복사·잘라내기·평문붙여넣기 / **한글 IME 조합** / fit-to-width·확대축소 — 전부 실제 집필실에서 통과. 순수 테스트 115 GREEN, 기존 B형 page.test 7 무회귀.

---

## 5. 핵심 gotchas (1라운드 회귀 — 2라운드에서 다시 밟지 말 것)

1. **IME 가드 = `e.isComposing` 신뢰 금지.** EditContext는 keydown `e.isComposing`을 설정하지 않는다. 조합은 EditContext `compositionstart/compositionend`로 추적한 `composingRef`로 가드(`CustomEditor.tsx` onKey 최상단). 마크 단축키(Cmd+B 등)도 이 가드 아래. (회귀: 한글 Enter 이중개행.)
2. **직렬화 왕복 idempotence(HARD-GATE, `code-quality.md`에 룰화됨).** 모델↔PM JSON 왕복이 비정규화면 로드 즉시 거짓 dirty→유실. 마크 추가 시 `serverBody` 정규화(`modelToPmJson(pmJsonToModel(...))`) 유지하고 왕복 테스트로 보호.
3. **측정은 DOM Range로 통일(canvas 금지).** canvas measureText는 한글 폰트를 좁게 폴백→캐럿 드리프트. 마크 run 측정도 오프스크린 DOM으로.
4. **자체 캐럿 = host `caret-color: transparent`**(네이티브 캐럿 2개 방지).
5. **셸 전환 flush는 stale 빈 본문을 넘긴다** → `BCustomChapterEditor.flushLatest`가 실제 최신 모델을 flush(인자 무시). 마크 모델로 바뀌어도 이 패턴 유지.
6. **자체 렌더 에디터는 클립보드·캐럿 가시화가 기본 부속** — 1라운드에 직접 구현됨. 마크 복붙(서식 paste)은 2라운드 결정 대상(현재 평문 only).
7. **커스텀 훅 반환 안정성** — `useCustomOutline`/세션 반환을 deps에 직접 넣지 말 것(무한루프 OOM 회귀, `code-quality.md`).

---

## 6. 실행 / dogfooding 환경

**풀스택 필요**(자체 엔진이 `/api/documents`에 저장). local profile 외부 시크릿 불필요.
```bash
# 1) DB (이미 떠 있을 수 있음 — 공유 docker)
docker compose up -d --wait postgres
# 2) backend (백그라운드)
cd backend && ./gradlew bootRun --args='--spring.profiles.active=local'   # :8080
# 3) frontend (백그라운드)
cd frontend && pnpm dev                                                    # :3000, Chrome/Edge 121+
```
- **테스트 계정(공유 DB에 영속):** `custom-r1@writenote.local` / `dogfood1234` (이메일 인증 완료)
- **테스트 작품:** id `3537`("자체에디터 테스트 작품") · 빈 챕터 있음
- **진입:** 로그인 → `http://localhost:3000/b/works/3537/custom` (또는 본인 작품 + `/custom`)
- ⚠️ **프레시 테스트 챕터에서만**(변환기가 미지원 서식 평탄화). 마크 작업 중엔 마크 왕복이 들어가므로 점진 확장.
- 메일 인증 토큰은 백엔드 콘솔 로그 `[MAIL]`에 출력(local `app.mail.mode=log`).

**게이트:** `pnpm exec tsc --noEmit` · `pnpm exec vitest run src/components/custom-editor` · `pnpm build`(RSC 경계, dev 서버와 경합 주의). IME는 사용자 dogfooding.

---

## 7. 권장 진행 방식

1. **ad-hoc 금지.** brainstorming → speckit(specify→plan→tasks→analyze) → 구현. 1라운드와 동일.
2. **2라운드 첫 결정 = 마크 데이터 구조(flat run-list vs tree)**(#65, research §8 열린 질문). 브레인스토밍에서 확정 후 model/measure/pmConvert/CustomEditor 일반화.
3. **sub-agent 위임 + 모델 규모별 선정(haiku 금지).** 순수 TDD(model/measure/pmConvert)=sonnet, 캐럿/선택/렌더 run 일반화(#66, 최난도)=opus. 절대경로·워크트리 한정·검증 cap·5~12줄 보고 지시. **메인 repo(023-export 미커밋) 비접촉.**
4. **§11(관찰→확정→수정).** 캐럿/측정 버그는 화면/모델/측정 3레이어 관찰로 확정 후 수정(1라운드 회고 §4 패턴 재사용 — 결정론적 probe·임시 콘솔 진단).
5. **§10(핵심을 첫 dogfoodable에서).** 마크 한 줄도 실제 집필실에서 조기 dogfooding.

## 8. 제약 / 주의

- **023-export 브랜치 미커밋 패치 비접촉**(다른 세션 소유: `BEditor.tsx`·`paper-editor.css`·`pageLayout.ts`·`b.css`·`write/page.tsx`). 자체 엔진은 `custom-editor/`·`BStudioShell`·`/custom` 라우트만 건드린다.
- Chromium(Chrome/Edge 121+) 전용. Safari/Firefox는 R5.
- 공동집필 version 충돌 감지 제거 금지(`useDocumentSession`).
- 미반영 룰 후보 A/B/D는 [[ISSUE-032]](vault) / 회고 §5-2에 보류 — 동종 재발 시 승격.

## 9. 참조

- **1라운드 spec/plan/tasks:** `specs/024-custom-editor-r1/`
- **회고:** `docs/retrospectives/2026-06-15-custom-editor-r1-build-dogfooding.md`
- **GitHub:** 마일스톤 #8(R2) + 이슈 #65~#69 / #9·#10·#11(R3~R5) 에픽 #70~#72
- **vault:** `02-PROGRESS.md`(024 1라운드 엔트리) · `03-ISSUES.md` ISSUE-032
- **커밋(1라운드):** `3ed09de`(SDD) → `08da021`(US1+픽스) → `6138160`(US3) → `d5f7e45`(US2+dogfooding2) → `973f63c`(회고+룰)
