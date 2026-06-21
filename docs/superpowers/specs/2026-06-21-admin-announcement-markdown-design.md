# 어드민 공지 마크다운 스타일링 — 설계

- 작성일: 2026-06-21
- 상태: 설계 확정 (구현 plan 작성 대기)
- 맥락: 030 운영 툴 라이브 후, 어드민 공지 본문에 간단한 스타일(제목·볼드·글머리표)을 넣고 싶다는 요청. 현재 `Announcement.body`는 plain TEXT, `/notice`는 `whitespace-pre-wrap` 평문 렌더.

## 검토 결과 (사실관계)

- **TipTap 재활용 불가**: 본 앱은 TipTap을 자체 에디터로 완전 폐기(`@tiptap` 의존성·소스 0, frontend·admin-site 양쪽). 재활용할 코드 없음.
- **이미지 업로드 인프라 0**: 백엔드에 스토리지 SDK·업로드 엔드포인트·버킷 없음, sanitize 라이브러리도 없음 → 이미지는 별도 무거운 트랙(후속).
- 따라서 본 작업은 **텍스트 스타일링 단독**, 이미지는 범위 밖.

## 결정 요약

| 항목 | 결정 |
|---|---|
| 에디터 방식 | 마크다운 + 경량 툴바(WYSIWYG 아님) |
| 저장 포맷 | `body` TEXT 그대로 — 마크다운 문자열로 해석(스키마·백엔드 변경 0) |
| 사용자 렌더 | `/notice/[id]` 상세만 react-markdown 렌더(배너·목록은 제목만이라 무변경) |
| 의존성 | `react-markdown` + `remark-breaks`(단일 줄바꿈 유지). 원시 HTML 미렌더 → XSS-safe, sanitize 불필요 |
| 이미지 업로드 | 범위 밖(후속 — 저장소 인프라 결정 필요) |
| 배포 | FE 단독(사용자앱 + admin-site), 백엔드 재배포 불필요 |

## 아키텍처 / 컴포넌트

### 1. 저장 (백엔드 변경 0)
- `Announcement.body`(TEXT)를 마크다운 문자열로 해석. 마이그레이션·엔드포인트·DTO 무변경.
- **기존 공지 호환**: 평문은 유효 마크다운. `remark-breaks`로 단일 줄바꿈을 `<br>`로 보존 → 기존 평문 공지(예: prod id 15)의 줄바꿈 시각 유지.

### 2. 어드민 편집 — admin-site `AnnouncementForm.tsx`
- 기존 `body` textarea 유지 + 상단 **경량 툴바** 버튼:
  - 제목: `## ` / `### ` (줄 앞에 삽입)
  - 볼드: 선택영역을 `**...**`로 감쌈
  - 글머리표: 선택 줄들 앞에 `- ` 삽입
- 구현: textarea ref의 `selectionStart/End`로 커서/선택 위치에 마커 삽입(순수 문자열 조작). WYSIWYG 아님 = 마크다운 소스 편집 + 버튼 보조.
- **미리보기 토글**: 하단에 react-markdown으로 현재 body 렌더(편집 ↔ 미리보기). admin-site에도 `react-markdown` + `remark-breaks` 추가.

### 3. 사용자 렌더 — frontend `/notice/[id]/page.tsx`
- 본문 `<div className="whitespace-pre-wrap ...">{data.body}</div>` → `<Markdown>` 컴포넌트로 교체.
- `react-markdown` + `remark-breaks`. `rehype-raw` **미사용**(원시 HTML 차단 = XSS-safe).
- 마크다운 요소 스타일: 최소 수동(제목 h2/h3 크기, `ul` 들여쓰기·디스크, `strong` 굵기, `p` 간격) — react-markdown `components` 또는 래퍼 클래스. `@tailwindcss/typography` 미도입(경량 유지).
- `/notice` 목록·홈 배너 = 제목만 노출 → **무변경**.

## 데이터 흐름
어드민이 마크다운 작성 → `body`(TEXT) 저장(기존 CRUD 그대로) → 공개 `GET /api/announcements/{id}` → `/notice/[id]`가 react-markdown 렌더.

## 에러/엣지
- 빈 body: 기존 검증(@NotBlank) 그대로.
- 잘못된 마크다운: react-markdown이 관대하게 렌더(깨지지 않음).
- 기존 평문 공지: remark-breaks로 줄바꿈 유지 → 시각 변화 최소.
- 매우 긴 본문: 상세 페이지 스크롤(기존과 동일).

## 테스트
- admin-site: 툴바 마커 삽입 순수 함수(선택영역→마크다운 변환) 단위 테스트.
- frontend: `/notice/[id]`가 마크다운(제목/볼드/목록)을 해당 요소로 렌더하는지 RTL(getByRole heading/list). 기존 평문 줄바꿈 보존 1케이스.
- 게이트: frontend·admin-site `typecheck·lint·test·build`.

## 범위 밖 (후속)
- **이미지 업로드**: 저장소(OCI Object Storage vs Vercel Blob) + 업로드 엔드포인트 + URL 서빙. 마크다운이라 이후 `![](url)` 문법으로 자연 확장.
- WYSIWYG(TipTap), 표·체크리스트(remark-gfm), `@tailwindcss/typography`.
