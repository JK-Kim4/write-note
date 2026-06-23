# Contract: DOM 마커 + 핸드오프 키

투어가 스포트라이트할 요소의 `data-tour` 마커와 멀티페이지 핸드오프 키. 마커 추가는 **기존 요소 동작을 바꾸지 않는다**(속성만 부착).

## data-tour 마커

| 마커 | 요소 | 파일 | 상태 |
|---|---|---|---|
| `nav-works` | 작품 메뉴 링크(`/library`) | `app/(main)/layout.tsx` | **신규 추가** |
| `nav-memos` | 메모 메뉴 링크(`/memos`) | `app/(main)/layout.tsx` | 기존 재사용 |
| `nav-characters` | 인물 메뉴 링크(`/characters`) | `app/(main)/layout.tsx` | 기존 재사용 |
| `new-series` | "+새 시리즈" 버튼 | `components/library/LibraryBoard.tsx`(L350 부근) | **신규 추가** |
| `new-work-root` | "+새 작품 시작하기" 버튼(루트/미분류) | `components/library/LibraryBoard.tsx`(L370 부근) | **신규 추가** |

- 모바일 햄버거 메뉴에서도 작품/메모/인물 링크가 존재 → 데스크탑 nav 기준으로 마커 부착(기존 `nav-memos`/`nav-characters` 부착 위치 답습). 마커 중복 시 driver.js 는 첫 매치 사용 — 기존 패턴과 동일하게 처리.
- 마커는 `data-tour` 속성만 추가(클래스·핸들러·레이아웃 무변경) → SC-006 회귀 0.

## 핸드오프 키

| 키 | 저장소 | 값 | 수명 |
|---|---|---|---|
| `writenote.onboarding.stage.v1` | `sessionStorage` | `"library"` | "더 보기" 시 set → /library 2차 투어 시작 시 제거 |

- 버전 접미사 `v1` — 향후 단계 추가 대비.
- `sessionStorage`(탭 한정·임시) — 영속 오염·기기 동기화 불필요. 새로고침 후 잔존 방지 위해 시작 즉시 제거.
