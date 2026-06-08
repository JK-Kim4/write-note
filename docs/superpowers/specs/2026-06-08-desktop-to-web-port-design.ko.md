# 나래 노트 — Desktop → Web 포팅 설계

- **작성일:** 2026-06-08
- **상태:** brainstorming 합의 완료 → 구현 계획(첫 실행 단위 = backend 확장) 대기
- **트리거:** Electron 데스크탑 앱의 코드 서명 부재(macOS/Windows 미서명 → 설치 마찰)로 베타 배포가 막힘. 검증된 desktop 제품을 web 서비스로 포팅해 **설치 없이 베타 테스트** 가능하게 한다.

---

## 1. 확정 결정 (brainstorming)

| 항목 | 결정 | 근거 |
|---|---|---|
| 데이터 모델 | **서버 + 계정 로그인** | 기기 간 동기화·정식 web 서비스 수준 |
| backend | **기존 Spring Boot 재활용 + 확장 4건** | 인증·멀티유저·카카오 OAuth·CRUD 이미 완성(003·004·006) |
| 베타 범위 | **desktop 현재 기능 1:1** | 검증된 제품 그대로. 등장인물·모바일 캡처는 범위 밖(§9) |
| front 구조 | **기존 Next.js 메인 + desktop 화면 이식** | 인증 결선·라우팅 골격 재사용 |
| front 폐기 범위 | **화면(UI) 코드 폐기·교체 / 인증·HTTP 배관 재사용** | 006 화면은 desktop 최신본이 우월, 005 인증 결선은 검증된 자산 |
| 진행 순서 | backend 확장 → front 이식 → 추가 기능 → 런칭 | §7 |

---

## 2. 현황 — 두 트랙

| 트랙 | 위치 | 내용 | 포팅에서의 역할 |
|---|---|---|---|
| **desktop** | `desktop/` | Electron + `node:sqlite` 로컬 단독. 최신 UI(009 작업실 재디자인·010 진짜 페이지 분할)·곁쪽지·집필 기록·작업 세션. renderer = 순수 React + TipTap(Vite SPA), 데이터는 `window.electronAPI`(27 IPC 채널) | **화면 + 데이터 모델의 출처** |
| **backend** | `backend/` | Spring Boot(Kotlin). 인증(로그인·JWT·카카오·비밀번호 재설정)·멀티유저 소유권·projects/documents/memos/character CRUD 완성 | **재활용 + 확장 4건** |
| **frontend** | `frontend/` | Next.js 16 App Router. 인증 쿠키 결선(005)·write/projects/memos 화면(006) | **인증 배관 재사용 / 화면 폐기·교체** |

---

## 3. 아키텍처

핵심은 `ElectronAPI` **인터페이스 경계를 유지**하고 그 뒤의 구현만 교체하는 것이다.

```
[desktop 화면 컴포넌트]  ← UI는 desktop에서 가져옴
        │ 호출
        ▼
[ElectronAPI 인터페이스]  ← 시그니처 고정 (renderer는 구현을 모름)
        │
   ┌────┴─────────────────────┐
   │ 기존(electron)           │ 포팅 후(web)
   ▼                          ▼
ipcRenderer.invoke      fetch(/api/...)  ← frontend client.ts 패턴
   │                          │
   ▼                          ▼
node:sqlite             Spring Boot → Postgres
```

- **셸·인증·라우팅·HTTP 배관** = Next.js(frontend)에서 재사용.
- **화면** = desktop에서 이식.
- **서버** = 기존 Spring Boot + 확장 4건.

---

## 4. Backend 확장 — 하위 작업 1 (첫 실행 단위)

desktop이 추가했지만 backend 모델에 없는 4건 + 소유권 정합.

| 항목 | desktop 위치 | backend 현황 | 작업 |
|---|---|---|---|
| `next_scene` (다음 장면) | `projects.next_scene` | `Project` 엔티티에 없음 | `Project.nextScene` 컬럼 + 마이그레이션 + `PATCH /api/projects/{id}` 반영 |
| `pinned` (곁쪽지 고정) | `memo_projects.pinned` | `MemoProject`에 없음 | `MemoProject.pinned` 컬럼 + 마이그레이션 + 고정 토글 endpoint |
| `project_logs` (집필 기록) | 테이블 | **엔티티 없음** | `ProjectLog` 엔티티/repository/service/endpoint(POST·GET) 신규 |
| `work_sessions` (작업 세션) | 테이블 | **엔티티 없음** | `WorkSession` 엔티티/repository/service 신규 — 세션 시작/종료, 30초 미만 폐기, `endWithLog`(종료+기록 트랜잭션), 비정상 종료 dangling 정리 |

- **소유권:** 신규 엔티티도 `userId`/project 소유 검증을 기존 패턴(JWT principal.userId)과 정합.
- **IPC ↔ REST 계약:** desktop 27 IPC 채널 → 기존+신규 endpoint 매핑표를 확정해 front 이식 시 계약으로 사용.
- **마이그레이션:** Flyway 신규 버전(컬럼 2건 + 테이블 2건).

---

## 5. Front 이식 — 하위 작업 2

- **화면:** `desktop/src` 화면(작품 벽·서랍형 집필실·페이지 분할·곁쪽지·기록·문의)을 Next.js로 이식. **frontend 006 화면은 폐기.**
- **라우팅:** desktop의 자체 화면 전환(screen-state) → Next App Router URL 라우팅으로 변환. (패러다임 차이 — §10 리스크)
- **데이터 계층:** `window.electronAPI`를 **동일 인터페이스의 web 구현체**(IPC `invoke` 대신 `fetch`)로 교체. frontend `client.ts`·React Query 패턴 위에 구현. 현재 `preload.ts`가 web 구현체의 청사진.
- **인증:** frontend 005 자산 재사용 — `client.ts`(credentials:include + 401 reactive refresh)·React Query·인증 쿠키·`guard`·same-origin 프록시 + 기존 로그인/회원가입 화면.
- **electron 전용 교체:** `shell.openExternal` → `window.open`(문의 화면 카카오 채널), 문의 폼 메타(앱 버전·OS)는 main 첨부 대신 web 컨텍스트에서 생성.
- **검증 전략(합의):** `projects` 도메인 하나를 backend→front→연동 테스트까지 **풀스택으로 먼저 관통**해 패턴 확립 후 `documents`/`memos`/`logs`/`sessions`로 복제. backend 전체를 검증 없이 쌓고 마지막에 통합하는 리스크 완화.

---

## 6. 진행 순서

```
1. backend 확장 (§4)        — next_scene · pinned · project_logs · work_sessions + IPC↔REST 계약
2. front 이식 (§5)          — Next 인프라 위 desktop 화면 + API 연동 (projects 풀스택 먼저)
3. 추가 기능 (§9)           — 등장인물 UI · 모바일 캡처 · (선택) 로컬 .db 가져오기
4. 런칭                     — Vercel(Next.js) + Render(Spring Boot)
```

각 하위 작업은 자체 spec → plan → 구현 사이클을 가진다. 본 문서는 마스터 설계이며 **다음 단계는 하위 작업 1(backend 확장)의 구현 계획**이다.

---

## 7. 데이터 마이그레이션

베타는 **계정 새로 시작**(기존 로컬 `.db` 가져오기 제외). 본인 dogfooding 데이터 이전이 필요하면 1회성 import 스크립트를 하위 작업 3에서 다룬다.

---

## 8. 배포

| 레이어 | 호스팅 | 비고 |
|---|---|---|
| front (Next.js) | Vercel | same-origin 프록시로 backend 호출(005 패턴) |
| backend (Spring Boot) | Render | 기존 계획 유지 |
| DB | Supabase Postgres | 기존 계획 유지 |

---

## 9. 범위 밖 (하위 작업 3 — 베타 이후)

- **등장인물(Character) UI** — backend는 완성, web front 화면만 신규.
- **모바일 캡처** — iOS 단축어 → `/api/capture`(ApiToken). backend는 완성, 토큰 발급·관리 UI 신규.
- **로컬 `.db` → 계정 가져오기** — 1회성 import.

---

## 10. 리스크 / 미해결

- **SPA screen-state ↔ Next App Router 변환** — 화면 전환 패러다임 차이. `projects` 도메인 풀스택 관통에서 패턴을 먼저 확립.
- **페이지 분할(010 CSS `column-wrap`)의 Next 환경 동작** — `'use client'` + 브라우저 CSS 레이아웃 의존. SSR/하이드레이션 환경에서 정상 동작 검증 필요(Electron Chromium 148 ↔ 브라우저 버전 차이 포함).
- **TipTap 한글 IME** — desktop PoC 0-1/Phase 4 검증 자산 재사용. Next 이식 후 4케이스 회귀 검증.
- **문의 폼 메타 출처** — 앱 버전·OS 첨부 방식 web 재설계.
- **한글 폰트 fallback chain** — `next/font` 한국어 subset 미지원(frontend `code-quality.md` 기록) — 시스템 fallback 정합.

---

## 11. 다음 단계

하위 작업 1(backend 확장)의 구현 계획 수립. 본 프로젝트 관행(speckit SDD 파이프라인) vs superpowers writing-plans 중 선택은 사용자 확인.
