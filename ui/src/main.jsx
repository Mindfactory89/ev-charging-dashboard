import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import App from "./App.jsx";
import { bootstrapRuntimeShell } from "./platform/runtime.js";

bootstrapRuntimeShell();
createRoot(document.getElementById("root")).render(<App />);
