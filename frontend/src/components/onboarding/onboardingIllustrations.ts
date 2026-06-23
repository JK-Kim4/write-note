/**
 * 온보딩 인트로 카드 일러스트 — driver.js popover description 에 innerHTML 로 주입되는 SVG 마크업.
 *
 * 순수 문자열(사이드이펙트 0). 애니메이션·정지(prefers-reduced-motion) 스타일은 globals.css 의
 * `.ob-intro` / `.ob-*` 규칙이 담당(popover 가 body 에 append 되므로 전역 CSS 로 도달).
 * 실제 앱 시각언어(책등 시리즈·작품 카드·내보내기) 정합. 목업: docs/research/2026-06-23-onboarding-intro-animations.html
 */

/** 카드 1 — 시리즈 생성: 책등이 차례로 올라와 스택을 이루고 terracotta + 배지 pop */
const SERIES_ILLUS = `
<div class="ob-illus">
  <svg viewBox="0 0 280 124" role="img" aria-label="책등들이 모여 시리즈가 만들어지는 모습">
    <line x1="78" y1="98.5" x2="202" y2="98.5" stroke="#e7ddcc" stroke-width="1.5" />
    <rect class="ob-spine-rise" style="animation-delay:0s"   x="88"  y="46" width="16" height="52" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-spine-rise" style="animation-delay:.12s" x="110" y="34" width="16" height="64" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-spine-rise" style="animation-delay:.24s" x="132" y="44" width="16" height="54" rx="2" fill="#f6e3d6" stroke="#d48d62" />
    <rect class="ob-spine-rise" style="animation-delay:.24s" x="132" y="44" width="16" height="7"  rx="2" fill="#a8542e" />
    <rect class="ob-spine-rise" style="animation-delay:.36s" x="154" y="30" width="16" height="68" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-spine-rise" style="animation-delay:.48s" x="176" y="50" width="16" height="48" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <g class="ob-plus-pop">
      <circle cx="196" cy="34" r="11" fill="#a8542e" />
      <path d="M196 29.5 v9 M191.5 34 h9" stroke="#fff" stroke-width="2" stroke-linecap="round" />
    </g>
  </svg>
</div>`;

/** 카드 2 — 작품 담기: 작품(작은 책)이 왼쪽에서 날아와 시리즈로 들어가며 새 책등 pop */
const COLLECT_ILLUS = `
<div class="ob-illus">
  <svg viewBox="0 0 280 124" role="img" aria-label="작품(책)이 시리즈로 담기는 모습">
    <line x1="150" y1="98.5" x2="232" y2="98.5" stroke="#e7ddcc" stroke-width="1.5" />
    <rect x="160" y="52" width="14" height="46" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect x="178" y="42" width="14" height="56" rx="2" fill="#f6e3d6" stroke="#d48d62" />
    <rect x="196" y="50" width="14" height="48" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-new-spine" x="214" y="46" width="14" height="52" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <!-- 날아드는 작품 = 작은 책(좌측 책등 + 표지) 2권 -->
    <g class="ob-work-fly" style="animation-delay:0s">
      <rect x="40" y="40" width="34" height="44" rx="3" fill="#fffdf8" stroke="#e7ddcc" />
      <rect x="40" y="40" width="8" height="44" rx="3" fill="#a8542e" />
      <rect x="54" y="49" width="15" height="3.5" rx="1.75" fill="#d48d62" />
      <rect x="54" y="57" width="12" height="2.5" rx="1.25" fill="#e7ddcc" />
    </g>
    <g class="ob-work-fly" style="animation-delay:1.9s">
      <rect x="40" y="40" width="34" height="44" rx="3" fill="#fffdf8" stroke="#e7ddcc" />
      <rect x="40" y="40" width="8" height="44" rx="3" fill="#76753f" />
      <rect x="54" y="49" width="13" height="3.5" rx="1.75" fill="#76753f" />
      <rect x="54" y="57" width="15" height="2.5" rx="1.25" fill="#e7ddcc" />
    </g>
  </svg>
</div>`;

/** 카드 3 — 내보내기: 책등들이 한 장의 문서로 합쳐져 아래로 내보내짐 + PDF 태그 */
const EXPORT_ILLUS = `
<div class="ob-illus">
  <svg viewBox="0 0 280 124" role="img" aria-label="시리즈가 한 문서로 합쳐져 내보내지는 모습">
    <rect class="ob-merge-spine" style="--mx:34px"  x="86"  y="40" width="14" height="58" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-merge-spine" style="--mx:16px"  x="104" y="34" width="14" height="64" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <rect class="ob-merge-spine" style="--mx:-2px"  x="122" y="44" width="14" height="54" rx="2" fill="#f6e3d6" stroke="#d48d62" />
    <rect class="ob-merge-spine" style="--mx:-20px" x="140" y="38" width="14" height="60" rx="2" fill="#fbf7ee" stroke="#e7ddcc" />
    <g class="ob-sheet-in">
      <rect x="106" y="26" width="58" height="74" rx="4" fill="#fffdf8" stroke="#e7ddcc" />
      <path d="M150 26 h14 l-14 14 z" fill="#f6e3d6" stroke="#e7ddcc" />
      <rect x="116" y="46" width="38" height="3.5" rx="1.75" fill="#e7ddcc" />
      <rect x="116" y="55" width="38" height="3.5" rx="1.75" fill="#e7ddcc" />
      <rect x="116" y="64" width="28" height="3.5" rx="1.75" fill="#e7ddcc" />
      <rect x="116" y="78" width="22" height="3.5" rx="1.75" fill="#d48d62" />
    </g>
    <g class="ob-export-arrow">
      <path d="M191 44 v22 M183 58 l8 8 l8 -8" stroke="#a8542e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    </g>
    <g class="ob-tag-pop">
      <rect x="176" y="74" width="36" height="18" rx="9" fill="#a8542e" />
      <text x="194" y="86.5" text-anchor="middle" font-family="SF Pro Text, system-ui, sans-serif" font-size="9" font-weight="700" fill="#fff">PDF</text>
    </g>
  </svg>
</div>`;

/**
 * 인트로 카드 description HTML 빌더 — 일러스트(상단) + 제목 + 설명.
 * driver.js 가 description 을 innerHTML 로 렌더(title 은 미사용 → 정렬을 이 빌더가 통제).
 */
export function introCard(illus: string, title: string, text: string): string {
    return `${illus}<h2 class="ob-title">${title}</h2><p class="ob-text">${text}</p>`;
}

export const ONBOARDING_ILLUSTRATIONS = {
    series: SERIES_ILLUS,
    collect: COLLECT_ILLUS,
    export: EXPORT_ILLUS,
} as const;
