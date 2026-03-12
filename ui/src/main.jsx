import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { I18nProvider } from "./i18n/I18nProvider.jsx";
import { bootstrapRuntimeShell } from "./platform/runtime.js";

bootstrapRuntimeShell();
createRoot(document.getElementById("root")).render(
  <I18nProvider>
    <App />
  </I18nProvider>
);
