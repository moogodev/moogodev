import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { initializeTheme } from "./lib/theme";
import "./index.css";

// Before anything renders: the class decides the palette, and #root is empty
// until React mounts, so the only thing that can show first is the background.
initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
