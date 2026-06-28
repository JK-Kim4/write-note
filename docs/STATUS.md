# 프로젝트 상태 — Active Track

**최종 갱신:** 2026-06-27 — 보드(플롯 보드) 도메인 + E1 보드 중심 전환 production 배포(v0.4.0) + 폐기 데스크톱 앱 정리.

> 이 문서는 repository를 처음 보는 사람이 "지금 무엇이 active track인지" 한 번에 알 수 있게 하는 단일 진입점이다.

## 현재 active track: 웹 앱 (soseolbi.com)

본 프로젝트는 **웹 앱**(`frontend/` + `backend/`)이 운영 중이다. production = **https://soseolbi.com** (Vercel 프론트 + OCI Compute 백엔드).

| 트랙 | 상태 | 위치 |
|---|---|---|
| **WEB frontend** | 🟢 운영 중 | `frontend/` (Next.js · Vercel) |
| **WEB backend** | 🟢 운영 중 | `backend/` (Kotlin/Spring · OCI Compute) |
| **어드민** | 🟢 운영 중 | `admin-site/` (별도 Next 앱 · Vercel) |
| ~~Desktop MVP~~ | ❌ **폐기** (2026-06-27) | Electron 데스크톱 앱은 개발 중단·폐기. 코드(`desktop/`)·워크플로우(`release.yml`)·설계문서 제거(git 히스토리에 보존). 본질은 웹 앱으로 검증·운영. |

## 진척 SoT

Phase 단위 진척·이슈·다음 진입점은 **외부 vault**가 상위 SoT다(브랜치 무관 단일 진입점):

- `~/obsidian/write-note/02-PROGRESS.md` — Phase 단위 진척
- `~/obsidian/write-note/03-ISSUES.md` — 이슈 트래킹
- 본 repo `docs/plan/` — 본질·스택·Phase 분해 / `specs/NNN-*/` — Phase별 spec

## 기준 문서

| 문서 | 내용 |
|---|---|
| [전략 PRODUCT.md](../PRODUCT.md) | 누가/무엇을/왜 (register=product) |
| [비주얼 design/DESIGN.md](../design/DESIGN.md) | 색·타이포·컴포넌트 SoT |
| [docs/plan/](./plan/README.md) | 스택·일정·백엔드 요구사항 |
| [릴리즈 노트](./releases/) | 버전별 사용자 릴리즈 노트 (GitHub Releases 동기) |
