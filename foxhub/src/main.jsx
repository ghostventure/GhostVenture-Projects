import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import RuntimeErrorBoundary from "./RuntimeErrorBoundary.jsx";
import { RUNTIME_RELIABILITY_MARKERS, installRuntimeReliabilityGuards } from "./runtimeReliability.js";
import "./styles.css";

installRuntimeReliabilityGuards();
void RUNTIME_RELIABILITY_MARKERS;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RuntimeErrorBoundary>
      <App />
    </RuntimeErrorBoundary>
  </React.StrictMode>
);
