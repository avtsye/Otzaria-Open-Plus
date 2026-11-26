"use strict";

const ENABLED_KEY = "openPlus.enabled";

// Keep the lightweight background instance alive so the + registration
// remains available after the settings page is closed.
async function registerPlusButton() {
  try {
    const saved = await Otzaria.call("storage.get", { key: ENABLED_KEY });
    if (saved?.success === false) throw new Error("Could not read the saved + button preference.");
    const enabled = saved?.data == null ? true : saved.data === true;
    const response = await Otzaria.call("plugin.setNewTabPage", { enabled });
    if (response?.data !== true) {
      console.warn("[Open Plus] The + button preference could not be applied.", response);
    }
  } catch (error) {
    console.error("[Open Plus] Could not configure the + button:", error);
  }
}

Otzaria.on("plugin.boot", () => { void registerPlusButton(); });
