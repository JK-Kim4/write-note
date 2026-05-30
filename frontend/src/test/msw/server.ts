import { setupServer } from "msw/node";

/**
 * MSW 테스트 서버 — HTTP 경계 mock (testing-strategy 의 허용 mock 대상).
 * 핸들러는 각 테스트에서 `server.use(...)` 로 등록.
 */
export const server = setupServer();
