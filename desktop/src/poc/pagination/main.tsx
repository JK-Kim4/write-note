import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { PocApp } from "./PocApp";
import "./poc.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PocApp />
  </StrictMode>,
);
