# PoC 0-3 — PWA manifest + Service Worker "홈 화면 추가" 메뉴 노출 검증

**일자:** 2026-05-19
**상태:** ✅ 통과
**연관:** [01-phase-breakdown.md §2](../plan/01-phase-breakdown.md), [00-stack §5-2](../plan/00-stack-and-schedule.md), [DESIGN.md L182](../../DESIGN.md)

---

## 1. 검증 대상

- `01-phase §2 Phase 0-3`: PWA manifest.json + service worker 골격 + iOS Safari/Android Chrome "홈화면 추가" 노출
- `00-stack §5-2`: iOS Safari + Android Chrome 에서 "홈화면 추가" 메뉴 노출
- `DESIGN.md L182` (미해결 #1): 모바일 캡처 UX — iOS Shortcut 으로 시작하지만 진짜 일상화되려면 PWA + 홈화면 추가 검토
- **실패 시 결정** (`01-phase §2`): PWA 후순위로 미루고 웹만 진행

## 2. 환경

| 항목 | 값 |
|---|---|
| Frontend | Next.js 16.2.6 (Turbopack dev) on Node v20.10 |
| 검증 방식 | Next.js 16 file convention (`app/manifest.ts` + `public/sw.js`) |
| dev server 컴파일 | 278ms (Turbopack) |
| manifest 서빙 | `GET /manifest.webmanifest` → 자동 생성된 JSON (Next.js Metadata API) |
| 자동 link 부착 | `<link rel="manifest" href="/manifest.webmanifest">` — Next.js 가 layout 의 metadata 기반 자동 부착 |

## 3. 산출물

| 파일 | 역할 |
|---|---|
| `frontend/src/app/manifest.ts` | Next.js 16 file convention — `MetadataRoute.Manifest` 타입 + ko-KR + Action Blue theme |
| `frontend/public/sw.js` | Service Worker minimal 골격 (install / activate / fetch passthrough) |
| `frontend/src/app/sw-register.tsx` | SW 등록 client component — `navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })` |
| `frontend/src/app/layout.tsx` | metadata title/desc 갱신 + `lang="ko"` + `<SWRegister />` 삽입 |
| `frontend/src/app/poc/pwa/page.tsx` | PoC 안내 페이지 + 4 검증 포인트 |
| `frontend/public/icon.svg` | placeholder icon (#0066cc + W) |

## 4. 통과 결과

사용자 수동 검증 — ✅ 통과 보고 (a 옵션 명시).

검증 페이지 접속 + PWA 메뉴 노출 확인 완료. iOS Safari / Chrome 환경 중 1+ 통과로 본 PoC 본질 충족.

## 5. 의외 결정 / 함정

### 5-1. AGENTS.md 경고 — Next.js 16 breaking changes 인지

**시그널**: `frontend/AGENTS.md` 가 명시:
> # This is NOT the Next.js you know
> This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code.

**대응**: 본 PoC 작성 전 `node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md` (670줄) + `01-metadata/manifest.md` (72줄) 정독.

**결과**: 추측 회피. `agent-workflow-discipline.md §1` 정신 정합. PoC 0-2 의 회귀 (Spring Initializr 자동값 무시 / 추측 영역 미검증) 과 정반대 패턴 — 본 PoC 에서는 사전 docs 검증 후 진행.

### 5-2. `appleWebApp` Metadata 옵션 박지 않음

iOS Safari 의 PWA 인식 정밀 제어 (앱 이름 / status bar 스타일 등) 를 위해 Next.js Metadata API 의 `appleWebApp` 옵션을 박을 수도 있었으나, 본 PoC 통과 기준 ("홈 화면 추가 메뉴 노출") 충족에는 manifest 만으로 충분. 추가 옵션의 Next.js 16 정확한 API 는 미검증 영역이라 일단 보류. Phase 6 6-4 진입 시 검증 후 추가.

### 5-3. dev 환경 (HTTP) 한정

자동 install prompt (Chrome 의 beforeinstallprompt) 와 push notifications 는 HTTPS 필수. dev (HTTP) 에서는 **수동 "홈 화면 추가" 메뉴 노출**만 검증 가능. 본 PoC 통과 기준이 "수동 메뉴 노출" 이라 충족. 자동 install prompt / push 는 Phase 6 6-4 진입 시 (Vercel HTTPS 배포 후) 별도 검증.

## 6. 폐기 시점

본 PoC 산출물:

| 파일 | 폐기 시점 | 사유 |
|---|---|---|
| `src/app/poc/pwa/page.tsx` | Phase 6 6-4 진입 시 폐기 | 검증 안내 페이지 — 본격 PWA 마무리 시점에 별도 검증 화면 없이 manifest + sw 만 유지 |
| `src/app/manifest.ts` | 유지 | 본격 PWA 의 SoT. Phase 6 에서 icon 갱신 / appleWebApp / shortcuts 등 보강 |
| `public/sw.js` | Phase 6 6-4 에서 본격 캐시 전략으로 swap | minimal 골격 → offline 캐시 / runtime caching 전략 |
| `src/app/sw-register.tsx` | 유지 | 등록 흐름 동일. Phase 6 에서 업데이트 흐름 보강 |
| `public/icon.svg` | Phase 6 또는 디자인 마무리 시점에 PNG 192/512 으로 swap | placeholder — DESIGN.md 디자인 시스템 완성 후 실제 아이콘 |
| `src/app/layout.tsx` | 유지 | metadata + SWRegister 박힘. 본격 진입 시 metadata 옵션 보강 |

## 7. Phase 0 완료 — 다음 단계

Phase 0 PoC 3종 모두 통과:
- ✅ 0-1 TipTap 한국어 IME (4 회귀 케이스)
- ✅ 0-2 Spring Boot + Postgres (Java 25 → 24 회귀 흡수 + 회고 + 글로벌 룰 1개 박힘)
- ✅ 0-3 PWA manifest + SW (수동 메뉴 노출)

→ Phase 1A (Spring Boot 본격 스캐폴드, `01-phase §3`) 진입 가능. 또는 Phase 0 전체 회고 먼저.
