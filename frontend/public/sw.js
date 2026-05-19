// PoC 0-3 — Service Worker minimal 골격.
//
// 임시 — Phase 6 (Week 6) 의 6-4 (PWA manifest 마무리 + service worker 캐시 전략) 진입 시 본격 구현으로 swap.
// 본 SW 는 등록 동작 + lifecycle 이벤트 처리만. 캐시 / offline / push 전부 V1 후반 영역.
// 출처: node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md §5

self.addEventListener("install", () => {
    // 새 SW 가 대기 없이 즉시 활성화 — dev 반복 디버깅 편의
    self.skipWaiting();
});

self.addEventListener("activate", (event) => {
    // 모든 client 즉시 점유
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
    // PoC 단계 — 단순 passthrough. 캐시 전략은 Phase 6 영역.
    event.respondWith(fetch(event.request));
});
