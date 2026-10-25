"use client";

import { useEffect, useState } from "react";

const storageKey = "bls-appearance-preferences-v1";
const defaults = { textSize: "default", contrast: false, reduceMotion: false };

function readPreferences() {
  try {
    const value = JSON.parse(window.localStorage.getItem(storageKey) || "null");
    return {
      textSize: ["small", "default", "large"].includes(value?.textSize) ? value.textSize : defaults.textSize,
      contrast: Boolean(value?.contrast),
      reduceMotion: Boolean(value?.reduceMotion)
    };
  } catch {
    return defaults;
  }
}

function applyPreferences(preferences) {
  const root = document.documentElement;
  root.dataset.textSize = preferences.textSize;
  root.dataset.highContrast = String(preferences.contrast);
  root.dataset.reduceMotion = String(preferences.reduceMotion);
}

export function AppearanceControls() {
  const [preferences, setPreferences] = useState(defaults);

  useEffect(() => {
    const stored = readPreferences();
    setPreferences(stored);
    applyPreferences(stored);
  }, []);

  function update(key, value) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      applyPreferences(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Preferences still apply for the current page if storage is unavailable.
      }
      return next;
    });
  }

  return (
    <details className="appearance-controls">
      <summary>Accessibility</summary>
      <div className="appearance-controls-panel">
        <label>
          Text size
          <select value={preferences.textSize} onChange={(event) => update("textSize", event.target.value)}>
            <option value="small">Smaller</option>
            <option value="default">Default</option>
            <option value="large">Larger</option>
          </select>
        </label>
        <label className="appearance-check">
          <input type="checkbox" checked={preferences.contrast} onChange={(event) => update("contrast", event.target.checked)} />
          Stronger contrast
        </label>
        <label className="appearance-check">
          <input type="checkbox" checked={preferences.reduceMotion} onChange={(event) => update("reduceMotion", event.target.checked)} />
          Reduce motion
        </label>
        <p>These preferences are saved in this browser.</p>
      </div>
    </details>
  );
}
