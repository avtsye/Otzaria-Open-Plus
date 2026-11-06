"use strict";

const ENABLED_KEY = "openPlus.enabled";

// This file runs in Otzaria's hidden background WebView.
async function registerPlusButton() {
  try {
    const saved = await Otzaria.call("storage.get", { key: ENABLED_KEY });
    if (saved?.success === false) {
      throw new Error("Could not read the saved + button preference.");
    }

    // Preserve the current behavior for users upgrading from versions
    // that did not yet store this preference.
    const enabled = saved?.data === null || saved?.data === undefined
      ? true
      : saved.data === true;

    const response = await Otzaria.call("plugin.setNewTabPage", { enabled });

    if (response?.data !== true) {
      console.warn(
        "[Open Plus] The + button preference could not be applied.",
        response
      );
    }
  } catch (error) {
    console.error("[Open Plus] Could not configure the + button:", error);
  }
}

Otzaria.on("plugin.boot", () => {
  void registerPlusButton();
});
