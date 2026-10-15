import React from "react";
import { recordRuntimeEvent } from "./runtimeReliability.js";

function getErrorMessage(error) {
  if (error instanceof Error) return error.message;
  return String(error || "FoxHub hit a runtime issue.");
}

export default class RuntimeErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    recordRuntimeEvent("react.boundary", {
      error: `${getErrorMessage(error)} ${info?.componentStack || ""}`.trim()
    });
  }

  reset = () => {
    this.setState({ error: null });
  };

  reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  goHome = () => {
    if (typeof window !== "undefined") window.location.assign("/");
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div
        className="runtime-fallback"
        role="alert"
        data-runtime-boundary="RuntimeErrorBoundary"
        data-lazy-import-guard="createRetryingLazyImport"
      >
        <div className="runtime-fallback-card">
          <p className="eyebrow">FoxHub</p>
          <h1>FoxHub recovered a page issue.</h1>
          <p>Your browser session stayed open. Retry this view, reload the app, or return to the public home page.</p>
          <div className="inline-actions wrap">
            <button type="button" className="accent-button" onClick={this.reset}>
              Retry view
            </button>
            <button type="button" className="ghost-button small" onClick={this.reload}>
              Reload
            </button>
            <button type="button" className="ghost-button small" onClick={this.goHome}>
              Go home
            </button>
          </div>
        </div>
      </div>
    );
  }
}
