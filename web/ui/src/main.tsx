import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { createRoot } from "react-dom/client";
import { StrictMode } from "react";
import { AppShell } from "./components/AppShell";
import About from "./routes/About";
import Announcement from "./routes/Announcement";
import Contact from "./routes/Contact";
import Dashboard from "./routes/Dashboard";
import Docs from "./routes/Docs";
import ForgotPassword from "./routes/ForgotPassword";
import Landing from "./routes/Landing";
import Login from "./routes/Login";
import NotFound from "./routes/NotFound";
import OAuthSetup from "./routes/OAuthSetup";
import Plan from "./routes/Plan";
import Privacy from "./routes/Privacy";
import ProjectDetail from "./routes/ProjectDetail";
import Projects from "./routes/Projects";
import Register from "./routes/Register";
import ResetPassword from "./routes/ResetPassword";
import Settings from "./routes/Settings";
import Terms from "./routes/Terms";
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
        {/* The published typo redirects to the correct spelling. The server
            answers a direct load with a 301 before the app boots; this covers
            a navigation that somehow still carries the old path. */}
        <Route path="/annoucement" element={<Navigate to="/announcement" replace />} />
        {/* About, Contact, and the legal pages are ordinary routes, declared
            like the others so a direct link or a hard refresh renders them
            rather than the catch-all below. */}
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
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
