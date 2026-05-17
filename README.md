# write-note

컨텍스트가 안 죽는 작가용 작업공간.

취미로 소설·단막극·시를 쓰는 사람들이 일상의 영감과 글쓰기 세션 사이에서 잃어버리는 *맥락*을 살려주는 사이드 프로젝트. 메모와 글쓰기 에디터가 *같은 시스템*에 살면서, 세션이 끊겨도 컨텍스트가 영속하게 만드는 것이 목표.

## 문서

- [DESIGN.md](./DESIGN.md) — 설계 문서, UI/UX 결정, 디자인 시스템 컴포넌트
- [designs/wireframe.html](./designs/wireframe.html) — 인터랙티브 wireframe (단일 파일, 라이트/다크 토글)
  - 메인 view 9개: 홈, 홈(빈), 메모 inbox, 원고지 200/400/1000, 에디터, 미리보기, 설정
  - 인증 패널 12개: 로그인/회원가입 흐름, 비밀번호 재설정, 이메일 인증, 에러·로딩 상태

## 상태

🟡 V1 wireframe 완료 — 구현 대기

다음 단계: Week 1 (Supabase 셋업 + Auth) 부터 구현 시작.

## 기술 스택 (예정)

| 레이어 | 기술 |
|---|---|
| 프론트 | Next.js 15 (App Router) + TypeScript |
| 에디터 | TipTap |
| 백엔드 | Supabase (Postgres + Auth + RLS + Realtime) |
| 모바일 캡처 | iOS Shortcut → Supabase REST |
| 배포 | Vercel |

상세는 [DESIGN.md `기술 스택`](./DESIGN.md#기술-스택) 참고.
