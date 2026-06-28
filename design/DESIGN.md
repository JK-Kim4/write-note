---
name: Soseolbi
colors:
  surface: '#fbf9f4'
  surface-dim: '#dbdad5'
  surface-bright: '#fbf9f4'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3ee'
  surface-container: '#f0eee9'
  surface-container-high: '#eae8e3'
  surface-container-highest: '#e4e2dd'
  on-surface: '#1b1c19'
  on-surface-variant: '#43474c'
  inverse-surface: '#30312e'
  inverse-on-surface: '#f2f1ec'
  outline: '#74777d'
  outline-variant: '#c4c6cd'
  surface-tint: '#4e6073'
  primary: '#162839'
  on-primary: '#ffffff'
  primary-container: '#2c3e50'
  on-primary-container: '#96a9be'
  inverse-primary: '#b5c8df'
  secondary: '#735c00'
  on-secondary: '#ffffff'
  secondary-container: '#fed65b'
  on-secondary-container: '#745c00'
  tertiary: '#4e1100'
  on-tertiary: '#ffffff'
  tertiary-container: '#741d00'
  on-tertiary-container: '#ff845f'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4fb'
  primary-fixed-dim: '#b5c8df'
  on-primary-fixed: '#091d2e'
  on-primary-fixed-variant: '#36485b'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#ffdbd1'
  tertiary-fixed-dim: '#ffb59f'
  on-tertiary-fixed: '#3a0a00'
  on-tertiary-fixed-variant: '#862300'
  background: '#fbf9f4'
  on-background: '#1b1c19'
  surface-variant: '#e4e2dd'
typography:
  display-lg:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Source Serif 4
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Source Serif 4
    fontSize: 28px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Source Serif 4
    fontSize: 24px
    fontWeight: '500'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.8'
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: Work Sans
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.2'
    letterSpacing: 0.05em
  label-sm:
    fontFamily: Work Sans
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.2'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 960px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
  stack-sm: 12px
  stack-md: 24px
  stack-lg: 48px
---

> **결정본 (2026-06-08):** 본 시안 = 소설비(Soseolbi) 프로토타입 디자인 결정본. 로고(펜촉+날개)는 `Gemini_Generated_Image_4czvzi4czvzi4czv.png`(원본) → `soseolbi-mark-mask.png`(테마 마스크)·`soseolbi-icon-1024.png`(앱 아이콘)로 추출. 앱 적용: 배경 = 평평한 양피지(나무 책상·텍스처 제거), 보조 액센트 = 잉크블루 단일(골드/오렌지 미도입), 폰트 = 한글 우선(Gowun Batang / Noto Sans KR — 아래 라틴 폰트는 영문 워드마크 참고용). 실시간 토큰 SoT = `frontend/src/styles/tokens.css`, 비주얼 시스템 서술 = `docs/DESIGN.md`.

## Brand & Style
The brand personality is rooted in the concept of a "digital sanctuary" for the creative mind. It evokes the feeling of a quiet, sun-drenched writing studio—minimalist, inspiring, and profoundly warm. The design system prioritizes focus by eliminating peripheral noise, allowing the user's thoughts to take center stage.

The design style is a blend of **Minimalism** and **Tactile/Skeuomorphism**, utilizing soft paper textures and subtle depth to mimic physical stationery without the clutter. It is a poetic interface that feels less like a tool and more like an invitation to create. The emotional response should be one of calm clarity and creative momentum.

## Colors
The palette is inspired by traditional writing materials and the transition of light throughout the day.
- **Primary (Ink Blue):** A muted, deep blue-grey used for primary text and structural UI elements, providing high legibility and a sense of permanence.
- **Secondary (Vintage Gold):** An accent for active states, delicate highlights, and icons, adding a touch of prestige and warmth.
- **Tertiary (Sunset Orange):** A soft, energetic highlight used sparingly for "call to inspiration" moments or notifications.
- **Neutral (Parchment):** The foundation of the system. A warm, off-white background that reduces eye strain compared to pure white and mimics the texture of high-quality paper.

## Typography
Typography is the core of the writing experience. 
- **Headlines:** Uses `sourceSerif4` to provide an authoritative yet literary feel. It creates a clear distinction between the "content" (the story) and the "container" (the app).
- **Body:** Uses `beVietnamPro` for its friendly and contemporary proportions. The line height is intentionally generous (1.6 to 1.8) to allow the text to "breathe" and prevent visual fatigue during long writing sessions.
- **Labels:** Uses `workSans` for its neutral, grounded, and highly legible characteristics in small UI elements like buttons, sidebars, and metadata.

## Layout & Spacing
This design system employs a **Fixed Grid** philosophy for the writing canvas to maintain focus, while the surrounding UI uses a fluid model.
- **The Canvas:** Centered layout with a maximum width of 960px to ensure optimal line length for readability.
- **Rhythm:** An 8px base grid ensures consistent vertical rhythm.
- **Responsive Behavior:** On desktop, large side margins create a "letterhead" feel. On tablet, margins shrink to 40px. On mobile, margins reduce to 20px, and the sidebar transitions to a bottom-sheet or hidden drawer to maximize the writing area.

## Elevation & Depth
Depth is communicated through **Tonal Layers** and **Ambient Shadows** rather than harsh borders.
- **Surface 0 (Background):** The Parchment neutral color.
- **Surface 1 (Panels):** Slightly lighter than the background or a subtle 5% opacity "Ink Blue" overlay.
- **Floating Elements:** Modals and menus use a very soft, diffused shadow (15% opacity Ink Blue) with a large blur radius (20px-40px) to simulate paper resting on a desk.
- **Depth of Focus:** When in "Focus Mode," the background layers dim slightly, and the main writing area remains elevated through brightness and clarity.

## Shapes
The shape language is **Soft**. It avoids the clinical feel of sharp corners while remaining more structured than a fully rounded system.
- **Cards and Panels:** Use `rounded-lg` (0.5rem) to suggest the edges of a stack of paper.
- **Buttons and Inputs:** Use the base `rounded` (0.25rem) for a precise, professional feel.
- **Small Accents:** Chips for tags use `rounded-xl` (0.75rem) to distinguish them as interactive metadata.

## Components
- **Buttons:** Primary buttons use a solid Ink Blue background with Gold text. Secondary buttons are "ghost" style with a thin Ink Blue border. All hover states involve a gentle shift in the background color to a lighter tint of the base color.
- **Input Fields:** Minimalist design with only a bottom border in a 20% Ink Blue. On focus, the border transitions to Vintage Gold.
- **Cards:** Used for "Project Folders." They feature a subtle paper texture and a very light bottom-right shadow to mimic stacked sheets.
- **Chips:** Small, pill-shaped tags used for categorizing notes. They use low-contrast backgrounds (a 10% tint of the primary color) to remain unobtrusive.
- **The "Writing Sheet":** A specialized component with a fixed maximum width, ample top padding, and a subtle "grain" texture overlay to enhance the tactile feeling.
- **Custom Scrollbar:** Thin, Ink Blue, and minimalist to avoid distracting from the prose.