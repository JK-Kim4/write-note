# 로그인 이메일 기억하기 + 비밀번호 표시 토글 — 설계

- 일자: 2026-06-21
- 범위: 프론트엔드 단독 (백엔드 변경 0)
- 브랜치: `develop` 직접 작업 (작은 FE 기능)

## 배경 / 문제

로그인·회원가입 화면에 표준 UX 두 가지가 누락되어 있다.

1. **로그인 화면** — "이메일 기억하기" 부재. 매번 이메일을 다시 입력해야 한다.
2. **회원가입·로그인 화면** — 비밀번호 입력값이 항상 마스킹(•)되어, 오타 확인을 위해 평문으로 볼 수 없다.

## 확정 사항 (사용자 컨펌, 2026-06-21)

- **"기억하기" 의미 = 이메일만 기억.** 체크 시 다음 방문에 이메일 입력칸 자동 채움. (세션 유지가 아님 — 인증은 httpOnly 쿠키라 JS로 만질 수 없고, 토큰 수명 변경 같은 백엔드 작업은 범위 밖.) 비밀번호는 절대 저장하지 않는다.
- **비밀번호 표시 토글 범위 = 회원가입 + 로그인 둘 다.**
- **컴포넌트 전략 = 별도 `PasswordInput` 래퍼 신설** (`FormInput` 미수정). `FormInput`은 인증 외 영역에서도 쓰이는 공통 컴포넌트라, `type="password"`에 자동 토글을 붙이는 부작용을 피하고 단일 책임으로 분리한다.
- **회원가입 두 비밀번호 필드(`password`, `passwordConfirm`)는 독립 토글** — 각 필드에 개별 눈 버튼 (표준 UX).

## 현재 코드 (확인 완료)

- `frontend/src/components/auth/LoginForm.tsx` — `email`/`password` `useState`, `FormInput` 사용. 성공 시 `['auth','me']` 무효화 → `/` 이동. localStorage 미사용.
- `frontend/src/components/auth/SignupEmailForm.tsx` — `password`+`passwordConfirm` 두 `FormInput` 모두 `type="password"`.
- `frontend/src/components/ui/FormInput.tsx` — `forwardRef`, `FormInputProps extends InputHTMLAttributes<HTMLInputElement>` + `error?`/`label?`. props를 `input`에 그대로 spread. label은 `<label>`로 감싸 내부 input을 묶음.
- localStorage 선례: 테마 설정 키 `writenote.preferences.v1` (layout.tsx).

## 설계

### 1. `PasswordInput` (신규 — `frontend/src/components/ui/PasswordInput.tsx`)

`FormInput`을 감싸 우측에 표시/숨김 버튼을 얹는 래퍼.

- **Props**: `FormInputProps`와 동일(= `InputHTMLAttributes` + `error?` + `label?`)에서 `type`만 내부 제어로 제거. 나머지(`label`, `name`, `value`, `onChange`, `error`, `autoComplete`, `placeholder` 등)는 `FormInput`에 그대로 전달.
- **상태**: `const [visible, setVisible] = useState(false)`. `type = visible ? "text" : "password"`.
- **버튼**:
  - `type="button"` (폼 제출 방지 — 회귀 룰: form 내 인라인 버튼).
  - `aria-label`: visible이면 "비밀번호 숨기기", 아니면 "비밀번호 표시".
  - `aria-pressed={visible}`.
  - 위치: input 우측 내부. `FormInput`의 label-flex 구조 안에서 input을 감싸는 relative wrapper + absolute 버튼. (FormInput 내부 구조를 바꾸지 않기 위해, `PasswordInput`은 `FormInput`을 `position: relative` 컨테이너로 감싸고 버튼을 absolute 배치.)
- **forwardRef**: 호출부에서 ref가 필요 없으므로 v1에서는 ref 전달 생략(현재 LoginForm/SignupEmailForm 모두 password ref 미사용). 단순 함수 컴포넌트.

> 레이아웃 주의: `FormInput`이 `<label>` 안에 `<span>label</span> + <input>`을 세로 flex로 두므로, 버튼을 input에만 겹치려면 `PasswordInput`이 `FormInput`을 relative div로 감싸고 버튼을 `right`/`top` 기준 절대배치하되 label 높이를 감안한다. 정밀 위치는 dogfooding으로 조정.

### 2. `LoginForm` 수정

- import `PasswordInput`.
- password `FormInput` → `PasswordInput`로 교체 (props 동일).
- **이메일 기억하기**:
  - localStorage 키 상수 `REMEMBERED_EMAIL_KEY = "writenote.rememberedEmail.v1"`.
  - `const [remember, setRemember] = useState(false)`.
  - **마운트 복원**: `useEffect(() => { const saved = localStorage.getItem(KEY); if (saved) { setEmail(saved); setRemember(true); } }, [])`. (SSR hydration 안전 위해 effect에서 읽음.)
  - **성공 시 반영**: `onSuccess`에서 `remember ? localStorage.setItem(KEY, email) : localStorage.removeItem(KEY)`.
  - **UI**: 비밀번호 필드 아래 체크박스 `<label>` "이메일 기억하기" (회원가입 약관 체크박스 마크업 패턴 참고).

### 3. `SignupEmailForm` 수정

- import `PasswordInput`.
- `password`, `passwordConfirm` 두 `FormInput` → 각각 `PasswordInput`로 교체 (props 동일, error 포함). 각자 독립 토글 상태.

## 테스트 (Vitest + RTL, 행위 기준)

- **`PasswordInput.test.tsx`** (신규):
  - 초기 input `type="password"` → 버튼 클릭 → `type="text"` → 재클릭 → `type="password"`.
  - 버튼 `aria-pressed` / `aria-label`이 상태 따라 전환.
- **`LoginForm.test.tsx`** (기존 확장):
  - 저장된 이메일 있을 때 마운트 → 이메일칸 복원 + 체크박스 ON.
  - 체크 ON + 로그인 성공 → localStorage에 이메일 저장.
  - 체크 OFF + 로그인 성공 → localStorage에서 삭제.
  - (localStorage는 jsdom 환경 — 시스템 경계 mock 불필요, 실제 localStorage 사용 후 정리.)

## 검증 / 배포

- `cd frontend && pnpm lint && pnpm typecheck && pnpm test && pnpm build` GREEN.
- 백엔드 변경 0 → 배포 순서 무관. `develop` push → Vercel preview, main 승격 시 production.
- dogfooding: 토글 버튼 위치/정렬, 이메일 복원 동작, 비밀번호 미저장 확인.

## 비범위 (YAGNI)

- 로그인 세션 유지 / 토큰 TTL 변경 (백엔드).
- 비밀번호 강도 미터, caps-lock 경고.
- "기억하기" 다중 계정 목록.
