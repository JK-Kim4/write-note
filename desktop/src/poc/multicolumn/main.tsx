import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { McApp } from "./McApp";
import "./poc.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <McApp />
  </StrictMode>,
);
