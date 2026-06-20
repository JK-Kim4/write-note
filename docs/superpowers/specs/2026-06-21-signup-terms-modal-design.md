# 회원가입 약관 동의 모달 — 설계

- 작성일: 2026-06-21
- 범위: frontend (Next.js App Router) 전용. 백엔드 변경 0.
- 트랙: develop 직접 작업 (작은 FE 기능)

## 1. 목적 / 배경

현재 이메일 회원가입 화면(`SignupEmailForm.tsx`)은 **체크박스 1개**로 "이용약관 및 개인정보 처리방침에 동의합니다"를 통합 처리하며, **약관 본문을 열람할 방법이 전혀 없다**. 사용자가 무엇에 동의하는지 확인하지 못한 채 체크하게 되는 구조다.

개선 목표: 회원가입 화면에서 **이용약관·개인정보처리방침을 모달로 열람**하고, **개별 동의**할 수 있게 한다.

## 2. 확정된 결정 (사용자 인터뷰 2026-06-21)

| 결정 항목 | 선택 |
|---|---|
| 이용약관 본문 | **신규 초안 작성** (소설비 서비스 맞춤) |
| 동의 흐름 | 체크박스는 클릭으로 직접 켬 + **각 항목 옆 "약관 보기" 링크** → 모달 |
| 동의 항목 | **개별 2개** (이용약관 / 개인정보처리방침), 둘 다 필수 |

> 참고: 사용자 최초 표현은 "체크 전에 모달"이었으나, 인터뷰에서 "체크박스는 그대로 + 옆에 보기 링크"(선택적 열람, 강제성 낮음)를 명시 선택함.

## 3. 현재 상태 (코드 확인 완료)

- `frontend/src/components/auth/SignupEmailForm.tsx` — `agreed` 단일 boolean 상태, `!agreed` 시 "이용약관에 동의해주세요." 에러. 체크박스 1개 (104~113줄).
- `frontend/src/app/privacy/page.tsx` — 개인정보처리방침 전문 + `Section`/`SubTitle`/`Table` 헬퍼가 한 파일에 인라인 스타일로 존재. 공개 URL `https://soseolbi.com/privacy` (카카오 심사 제출용).
- `frontend/src/components/memos/QuickCaptureModal.tsx` — 재사용할 모달 패턴: `role="dialog"` + `aria-modal` + `fixed inset-0 z-50` 오버레이 + `--w-*` 토큰 카드 + Escape 닫기 + 백드롭 클릭 닫기.
- **이용약관 본문은 코드·문서 어디에도 없음** → 신규 작성 대상.
- 범용 Modal 컴포넌트 없음.

## 4. 설계

### 4-1. 약관 본문 모듈 (`frontend/src/content/legal/`)

두 약관 본문을 **공유 모듈**로 분리해 `/privacy` 페이지와 모달이 동일 소스를 쓰게 한다 (두 곳 불일치 방지).

- `legalPrimitives.tsx` — `/privacy/page.tsx`의 `Section`/`SubTitle`/`Table` 헬퍼를 그대로 이동 (named export). 인라인 스타일·`--w-*` fallback 유지.
- `PrivacyContent.tsx` — 기존 `/privacy/page.tsx`의 본문(`<h1>`~마지막 `<Section>`)을 `PrivacyContent` 컴포넌트로 추출. `legalPrimitives` 헬퍼 사용.
- `TermsContent.tsx` — **신규** 이용약관 초안. `legalPrimitives` 헬퍼로 동일 스타일.

이용약관 초안 섹션 구성 (신규 작성, 소설비 맞춤):
1. 목적
2. 정의 (서비스, 이용자, 콘텐츠)
3. 약관의 효력 및 변경
4. 서비스의 제공 및 변경
5. 회원가입 및 계정
6. 이용자의 의무 (금지 행위)
7. **콘텐츠의 저작권** — 이용자가 작성한 글·메모 등 콘텐츠의 저작권은 **작성자(작가) 본인에게 귀속**. 서비스는 운영·표시에 필요한 범위로만 처리.
8. 서비스 이용의 중단·해지 (회원 탈퇴)
9. 면책 조항
10. 준거법 및 분쟁 해결

> 초안 성격: 법률 자문 아닌 표준 템플릿 기반 초안. 본문에 "본 약관은 표준 초안이며 운영 중 보완될 수 있음" 취지 명시. 최종 수정일 표기.
>
> 운영자/문의 연락처 섹션은 **이용약관에 두지 않는다** (사용자 결정 2026-06-21). 연락처는 개인정보처리방침의 보호책임자(김종완 / jongbell4@gmail.com)에 위임. 사업자 정보 표기 없음.

### 4-2. `TermsModal` 컴포넌트 (`frontend/src/components/auth/TermsModal.tsx`, 신규)

`QuickCaptureModal` 패턴 차용한 범용 약관 모달.

- props: `title: string`, `children: React.ReactNode`, `onClose: () => void`.
- 구조: `role="dialog"` + `aria-modal="true"` + `aria-label={title}` + `fixed inset-0 z-50` 오버레이(반투명 배경) + 카드.
- 카드: `--w-canvas` 배경, `--w-hairline` 보더, **본문 영역 세로 스크롤**(`max-height` + `overflow-y-auto`) — 약관이 길기 때문.
- 닫기: 우상단 닫기(✕) 버튼 + Escape 키 + 백드롭 클릭.
- `'use client'` (이벤트 핸들러·useEffect 사용).

### 4-3. `SignupEmailForm` 수정

- 상태: `agreed: boolean` → `agreedTerms: boolean`, `agreedPrivacy: boolean`.
- 모달 상태: `openModal: "terms" | "privacy" | null`.
- UI: 통합 체크박스 1개 → 체크박스 **2줄**.
  - "[ ] **이용약관**에 동의합니다. (보기)" — (보기) 클릭 → `openModal="terms"`.
  - "[ ] **개인정보처리방침**에 동의합니다. (보기)" — (보기) 클릭 → `openModal="privacy"`.
  - "(보기)"는 `type="button"` 텍스트 버튼/링크 (form submit 방지).
- 검증: `if (!agreedTerms || !agreedPrivacy)` → "이용약관과 개인정보처리방침에 모두 동의해주세요."
- 모달 렌더: `openModal === "terms"` → `<TermsModal title="이용약관" onClose={...}><TermsContent /></TermsModal>`, `"privacy"` → `PrivacyContent` 동일.

### 4-4. `/privacy/page.tsx` 수정

- 본문·헬퍼 추출 후, 페이지는 `PrivacyContent`를 import 해 기존 `<main>` 래퍼 안에 렌더 (외관·URL·metadata 동일 유지). 중복 제거.

## 5. 데이터 흐름

```
SignupEmailForm
  ├─ 체크박스(agreedTerms / agreedPrivacy)  ← 직접 클릭으로 토글
  ├─ "(보기)" 버튼 → openModal 상태 변경
  └─ openModal 에 따라 TermsModal 렌더
        └─ children = TermsContent | PrivacyContent  (← src/content/legal/, /privacy 와 공유)
```

## 6. 에러 처리

- 미동의 제출: 로컬 검증 에러 메시지 (네트워크 요청 전 차단). 기존 `localError` 흐름 재사용.
- 모달: 닫기 3경로(✕/Escape/백드롭). 모달은 약관 표시 전용 — 자체 제출/네트워크 없음.

## 7. 테스트 / 검증

- 단위(Vitest + RTL, 행위 기준):
  - 두 체크박스 모두 체크해야 가입 mutation 호출, 하나라도 미체크면 에러 메시지 표시.
  - "(보기)" 클릭 시 해당 약관 모달 본문이 화면에 나타남(`getByText`/`getByRole("dialog")`).
  - 모달 닫기(Escape/✕/백드롭) 동작.
- 렌더/RSC 경계: 작성 직후 `pnpm build` — server/client 경계 위반 검출 (TermsModal·SignupEmailForm `'use client'` 확인).
- dogfooding 위임: 실제 모달 스크롤·라이트/다크 테마·모바일 표시(한국어 본문 문단)는 single source 추출 후 시각 확인 게이트.

## 8. 회귀 주의점 (프로젝트 룰 정합)

- **RSC 경계**(typescript/code-quality §"server/client 경계"): `TermsModal`·수정된 `SignupEmailForm`은 이벤트 핸들러 보유 → `'use client'` 의무. `PrivacyContent`/`TermsContent`/`legalPrimitives`는 핸들러 없으므로 server component 가능(스타일·텍스트만) — 단 모달(client)이 children 으로 받는 구조라 무방.
- **frontend/AGENTS.md**: "node_modules/next/dist/docs/ 정독" 명시 — 단, 과거 세션(agent-workflow-discipline §5)에서 해당 디렉토리 부재 확인됨. 본 작업은 신규 docs 의존 API 미사용(기존 패턴 답습)이라 영향 낮음. 구현 진입 시 실제 존재 1회 확인.
- 백엔드·DB·마이그레이션 변경 0 → 배포는 FE 단독 (`vercel --prod`).

## 9. 범위 밖 (YAGNI)

- 약관 동의 시각/버전을 서버에 저장(동의 이력 영속) — 이번 범위 아님. 클라이언트 검증만.
- "전체 동의" 통합 체크박스, 마케팅 수신 등 선택 동의 항목 — 없음 (필수 2개만).
- 약관 변경 알림/재동의 플로우 — 없음.
