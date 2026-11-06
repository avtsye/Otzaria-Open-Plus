"use strict";

// This file runs in Otzaria's hidden background WebView.
async function registerPlusButton() {
  try {
    const response = await Otzaria.call("plugin.setNewTabPage", {
      enabled: true
    });

    if (response?.data !== true) {
      console.warn(
        "[Open Plus] The + button was not assigned to this plugin.",
        response
      );
    }
  } catch (error) {
    console.error("[Open Plus] Could not register the + button:", error);
  }
}

Otzaria.on("plugin.boot", () => {
  void registerPlusButton();
});
