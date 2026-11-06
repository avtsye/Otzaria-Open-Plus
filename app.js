"use strict";

let handlingNewTabButton = false;

function applyTheme(theme) {
  const colors = theme?.colorScheme;
  if (!colors) return;

  const root = document.documentElement;
  const variables = {
    "--color-primary": colors.primary,
    "--color-on-primary": colors.onPrimary,
    "--color-surface": colors.surface,
    "--color-on-surface": colors.onSurface,
    "--color-on-surface-variant": colors.onSurfaceVariant,
    "--color-outline": colors.outlineVariant
  };

  for (const [name, value] of Object.entries(variables)) {
    if (typeof value === "string" && value) {
      root.style.setProperty(name, value);
    }
  }

  if (theme.mode === "dark" || theme.mode === "light") {
    root.style.colorScheme = theme.mode;
  }
}

async function closeOwnPluginTab() {
  const stateResponse = await Otzaria.call("reader.getCurrentState");
  const tabs = stateResponse?.data?.openTabs;

  if (!Array.isArray(tabs)) {
    console.warn("[Open Plus] Could not read the open tabs list.");
    return false;
  }

  const ownTabIndex = tabs.findIndex((tab) => tab?.isSelf === true);
  if (ownTabIndex < 0) {
    console.warn("[Open Plus] The plugin tab was not found; leaving tabs untouched.");
    return false;
  }

  const closeResponse = await Otzaria.call("reader.closeTab", {
    index: ownTabIndex
  });

  return closeResponse?.data === true;
}

async function handlePageOpened(event) {
  // Manual opening has no source marker, so the information page stays visible.
  if (event?.source !== "newTabButton" || handlingNewTabButton) return;

  handlingNewTabButton = true;
  try {
    const navigation = await Otzaria.call("navigation.goTo", {
      target: "library"
    });

    if (navigation?.data !== true) {
      console.warn("[Open Plus] Navigation to the native library did not complete.");
      return;
    }

    const closed = await closeOwnPluginTab();
    if (!closed) {
      console.warn("[Open Plus] The library opened, but the plugin tab could not be closed.");
    }
  } catch (error) {
    console.error("[Open Plus] Failed to handle the + button:", error);
  } finally {
    handlingNewTabButton = false;
  }
}

Otzaria.on("plugin.boot", (payload) => {
  applyTheme(payload?.theme);
});

Otzaria.on("theme.changed", applyTheme);
Otzaria.on("plugin.page_opened", (event) => {
  void handlePageOpened(event);
});

(async () => {
  try {
    const response = await Otzaria.call("app.getTheme");
    applyTheme(response?.data);
  } catch (error) {
    console.warn("[Open Plus] Could not load the current theme:", error);
  }
})();
