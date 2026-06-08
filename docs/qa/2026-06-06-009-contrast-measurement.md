# 009 US5 대비 WCAG 정밀 측정 결과 (SC-006)

- 일시: 2026-06-06
- 방법: OKLCH 토큰값 → 선형 sRGB → WCAG 상대휘도 → 대비비 정적 계산(`opacity`는 gamma 공간 합성 반영). 라이브 렌더 없이 토큰·CSS만으로 계산해 재현 가능.
- 대상: 009로 변경된 화면 전부 — 작품 벽 카드 / 서랍형 집필실 / side-panel / rail / titlebar / 쪽지 책상(scrap 면) / 재진입 한 장 / 작품 이름표 / 선택된 화면 라벨.
- 기준: WCAG AA — 본문·소형 텍스트 ≥4.5:1, 대형(≥24px·UI) ≥3:1.

## 결론

**SC-006(라이트·다크 양면 AA 100%) — 측정 시점 미충족 발견 → 토큰 보정 후 100% 충족.** 라이트 0 FAIL / 다크 0 FAIL.

US5가 적용했던 "OKLCH L값 추정 상향"이 목표(4.5)에 못 미쳤음을 정밀 측정이 잡아냈다(`--faint` 0.520은 sunken 면 위 3.91로 여전히 미달이었음).

## 발견된 미달 (보정 전)

| 텍스트 | 배경 | 라이트 | 다크 | 원인 |
|---|---|---:|---:|---|
| `.input::placeholder` (--faint) | --surface-sunken | 3.91 ❌ | 5.87 | 라이트 --faint 너무 밝음 |
| `.memo__date` / `.panel__hint` (--faint) | --surface | 4.49 ❌ | 5.40 | 〃 (경계) |
| `.scrap__when` (--scrap-ink @.6) | --scrap | 3.44 ❌ | 4.15 ❌ | opacity .6이 실효 대비 깎음 |
| `.reentry__next-text--empty` (@.6) | --scrap | 3.44 ❌ | 4.15 ❌ | 〃 |
| `.reentry__sentence--empty` / `.reentry__label` (@.7) | --scrap | 4.48 ❌ | 5.06 | 〃 (라이트만) |

> `rail__item`은 한때 2.18로 보였으나, rail 배경이 `--bg`(추측)가 아니라 **`--surface`**(실측)임을 확인 → 실제 4.69 PASS. 거짓 양성이었다.

## 적용한 보정 (surgical — 변경 화면 SoT = `desktop/src/styles/app.css`)

1. **라이트 `--faint`: `oklch(0.520 …)` → `oklch(0.480 …)`** — surface-sunken 위 3.91 → 4.64. `--muted`는 전부 PASS라 불변. 다크 `--faint`(0.680)도 전부 PASS라 불변.
2. **scrap-ink 소형 텍스트 4곳 `opacity` `.6`/`.7` → `.72`** — 라이트·다크 둘 다 ≥4.5 되는 최소값. de-emphasis(시각 위계)는 유지(.72는 여전히 옅음).
   - `.scrap__when` / `.reentry__next-text--empty` / `.reentry__sentence--empty` / `.reentry__label`

## 보정 후 (대표 19쌍, 양면 전수 PASS)

| 텍스트 | 라이트 | 다크 |
|---|---:|---:|
| placeholder --faint / surface-sunken | 4.64 | 5.87 |
| memo__date / panel__hint --faint / surface | 5.33 | 5.40 |
| wall 빈문구·next-label --faint / paper | 6.28 | 5.48 |
| rail·titlebar --muted / surface | 4.69 | 5.82 |
| 쪽지 본문 --scrap-ink / scrap | 10.46 | 8.51 |
| 쪽지 날짜 @.72 / scrap | 4.73 | 5.25 |
| 작품 이름표 --on-accent / accent | 6.65 | 7.90 |
| 재진입 마지막문장 --scrap-ink / scrap | 10.46 | 8.51 |
| 재진입 빈문구/라벨 @.72 / scrap | 4.73 | 5.25 |
| 선택된 화면 라벨 --accent-ink / accent-soft | 6.90 | 6.27 |

본문(--ink/paper)은 라이트 14.03 / 다크 11.72로 여유. 본 표는 측정의 일부이며, 변경 화면의 보조·placeholder·de-emphasis 텍스트를 우선 수록.

## 검증

- 보정 후 측정: 라이트 0 FAIL / 다크 0 FAIL.
- `pnpm test` 155 GREEN + `vite build` OK(CSS 토큰 변경 회귀 없음).
- 사용자 dogfooding 시 라이트 테마 보조 글자가 직전보다 또렷한지 눈으로 교차 확인(가이드 5-1/5-2/5-4).
