import { BrowserRouter, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { AppShell } from "./components/AppShell";
import Announcement from "./routes/Announcement";
import Dashboard from "./routes/Dashboard";
import Docs from "./routes/Docs";
import ForgotPassword from "./routes/ForgotPassword";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import OAuthSetup from "./routes/OAuthSetup";
import Plan from "./routes/Plan";
import ProjectDetail from "./routes/ProjectDetail";
import Projects from "./routes/Projects";
import Register from "./routes/Register";
import ResetPassword from "./routes/ResetPassword";
import Settings from "./routes/Settings";
import VerifyEmail from "./routes/VerifyEmail";
import "./index.css";
import { initializeTheme } from "./lib/theme";

// Before the first render, not in an effect: see initializeTheme for why an
// effect is too late.
initializeTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/auth/setup" element={<OAuthSetup />} />
        <Route path="/plan" element={<Plan />} />
        <Route path="/announcement" element={<Announcement />} />
        {/* Both spellings land on the page so neither URL 404s. */}
        <Route path="/annoucement" element={<Announcement />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/docs/:slug" element={<Docs />} />
        {/* Guides are linked from the corpus as /docs/guides/<slug> but the page
            itself is registered under <slug> alone, so :slug above would capture
            "guides" and leave the real segment stranded against the catch-all
            below. Declared here so those forty cross links land on a page. */}
        <Route path="/docs/guides/:slug" element={<Docs />} />
        <Route element={<AppShell />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/projects" element={<Projects />} />
          <Route path="/app/settings" element={<Settings />} />
          <Route path="/app/projects/:id" element={<ProjectDetail />} />
          <Route path="/app/projects/:id/database" element={<ProjectDetail />} />
          <Route path="/app/projects/:id/bucket" element={<ProjectDetail />} />
          {/* Bucket settings is a page of its own, declared before the project's
              settings tab would be reached by accident. It has to be listed ahead
              of any path that could match it as a suffix, since the bucket tab is
              the section it belongs to and not a tab of its own. */}
          <Route path="/app/projects/:id/bucket/settings" element={<ProjectDetail />} />
          {/* The settings tab is a real URL like the others. Without this route
              the tab fell through to the catch-all NotFound page. */}
          <Route path="/app/projects/:id/settings" element={<ProjectDetail />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
