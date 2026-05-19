/**
 * PoC 0-3 — PWA "홈 화면 추가" 메뉴 노출 수동 검증 페이지.
 *
 * 임시 — Phase 6 (Week 6) 6-4 (PWA manifest 마무리 + service worker 캐시 전략) 진입 시 폐기.
 *
 * 검증 대상 (DESIGN.md L182 + 01-phase §2 + 00-stack §5-2):
 *   1. iOS Safari — 공유 메뉴 → "홈 화면에 추가" 노출 + write-note 이름/아이콘 인식
 *   2. Android Chrome (또는 macOS Chrome) — "Install app" / "앱 설치" 메뉴 노출
 *
 * 통과 시 Phase 0 PoC 3종 완료 → Phase 1A 진입.
 * 실패 시 PWA 후순위 (`01-phase §2 §실패 시 결정`) — 웹만 진행.
 */
export default function PwaPocPage() {
    return (
        <main style={{ padding: "2rem", maxWidth: "800px", margin: "0 auto" }}>
            <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
                PWA "홈 화면 추가" PoC (Phase 0-3)
            </h1>
            <p style={{ color: "#666", marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                통과 기준 (`00-stack §5-2`): iOS Safari + Android Chrome 에서 "홈 화면 추가" 메뉴 노출.
                실패 시 PWA 후순위.
            </p>

            <section style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>현재 셋업</h2>
                <ul style={{ paddingLeft: "1.5rem", lineHeight: 1.7 }}>
                    <li>
                        <code>src/app/manifest.ts</code> — Next.js 16 file convention (자동{" "}
                        <code>/manifest.webmanifest</code> 서빙 + <code>&lt;link rel="manifest"&gt;</code>{" "}
                        자동 부착)
                    </li>
                    <li>
                        <code>public/sw.js</code> — Service Worker minimal 골격 (install / activate /
                        fetch passthrough)
                    </li>
                    <li>
                        <code>src/app/sw-register.tsx</code> — SW 등록 client component (layout 에서 박힘)
                    </li>
                    <li>
                        <code>public/icon.svg</code> — placeholder icon (#0066cc accent + W 글자)
                    </li>
                </ul>
            </section>

            <section style={{ marginBottom: "1.5rem", fontSize: "0.9rem" }}>
                <h2 style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>검증 방법</h2>
                <ol style={{ paddingLeft: "1.5rem", lineHeight: 1.7 }}>
                    <li>
                        <strong>iOS Safari</strong> — 같은 Wi-Fi 의 iPhone Safari 로{" "}
                        <code>http://192.168.x.x:3000</code> (dev server Network URL) 접속 → 공유 버튼 →{" "}
                        "홈 화면에 추가" 메뉴 노출 확인 + 미리보기에 "write-note" 이름 + W 아이콘 노출
                    </li>
                    <li>
                        <strong>Android Chrome</strong> — 같은 방식 접속 → 우상단 ⋮ 메뉴 → "앱 설치" /
                        "홈 화면에 추가" 옵션 노출 확인
                    </li>
                    <li>
                        <strong>macOS / Desktop Chrome</strong> — <code>http://localhost:3000</code>{" "}
                        접속 → 주소창 우측 "설치" 아이콘 또는 ⋮ 메뉴 → "write-note 설치" 옵션 노출
                    </li>
                    <li>
                        <strong>DevTools 검증 (선택)</strong> — Chrome DevTools → Application →
                        Manifest 탭: manifest 내용 정상 파싱 / icons 표시. Service Workers 탭: sw.js
                        activated / running
                    </li>
                </ol>
            </section>

            <section style={{ fontSize: "0.85rem", color: "#666" }}>
                <p>
                    <strong>주의:</strong> iOS Safari 의 자동 install prompt 는 HTTPS 필수. dev 환경{" "}
                    (HTTP) 에서는 <strong>수동 "공유 → 홈 화면 추가"</strong> 메뉴 노출만 검증 가능.
                    Push notifications / 자동 prompt 는 Phase 6 6-4 진입 시 (Vercel HTTPS 배포 후) 별도
                    검증.
                </p>
                <p>
                    결과 보고 양식: iOS Safari ✅/⚠️/❌ + Android Chrome (또는 macOS Chrome) ✅/⚠️/❌ +
                    관찰 메모.
                </p>
            </section>
        </main>
    );
}
