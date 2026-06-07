import { createRoot } from "react-dom/client";
import { PaginatedEditor } from "./PaginatedEditor";
import "./poc.css";

// StrictMode 미사용 — effect 이중 실행이 EditContext 를 2개 붙여(입력 분할→자모 분해/커서 2개) 깨뜨린다.
createRoot(document.getElementById("root")!).render(<PaginatedEditor />);
