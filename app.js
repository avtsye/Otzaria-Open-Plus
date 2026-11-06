"use strict";

const ENABLED_KEY = "openPlus.enabled";
let handlingNewTabButton = false;
let plusEnabled = true;
let settingsReady = false;
let toggleBusy = false;

const toggle = document.getElementById("plus-toggle");
const status = document.getElementById("status");

function setStatus(message) {
  if (status) status.textContent = message;
}

function applyTheme(theme) {
  const colors = theme?.colorScheme;
  if (!colors) return;

  const root = document.documentElement;
  const variables = {
    "--color-primary": colors.primary,
    "--color-on-primary": colors.onPrimary,
    "--color-secondary": colors.secondary,
    "--color-on-secondary": colors.onSecondary,
    "--color-secondary-container": colors.secondaryContainer,
    "--color-on-secondary-container": colors.onSecondaryContainer,
    "--color-surface": colors.surface,
    "--color-on-surface": colors.onSurface,
    "--color-on-surface-variant": colors.onSurfaceVariant,
    "--color-surface-container-high": colors.surfaceContainerHigh,
    "--color-surface-container-highest": colors.surfaceContainerHighest,
    "--color-error": colors.error,
    "--color-on-error": colors.onError,
    "--color-outline": colors.outline,
    "--color-outline-variant": colors.outlineVariant || colors.outline
  };

  for (const [name, value] of Object.entries(variables)) {
    if (typeof value === "string" && value) root.style.setProperty(name, value);
  }

  const uiFont = theme.typography?.uiFontFamily;
  if (typeof uiFont === "string" && uiFont.trim()) {
    const family = `'${uiFont.replace(/'/g, "")}', system-ui, sans-serif`;
    root.style.setProperty("--font-main", family);
    root.style.setProperty("--font-ui", family);
  }

  if (theme.mode === "dark" || theme.mode === "light") {
    root.style.colorScheme = theme.mode;
  }
}

function reflectToggle() {
  if (!toggle) return;
  toggle.checked = plusEnabled;
  toggle.disabled = !settingsReady || toggleBusy;
}

async function loadSettings() {
  const response = await Otzaria.call("storage.get", { key: ENABLED_KEY });
  if (response?.success === false) {
    throw new Error("לא ניתן לקרוא את ההגדרה השמורה.");
  }

  plusEnabled = response?.data === null || response?.data === undefined
    ? true
    : response.data === true;
  settingsReady = true;
  reflectToggle();
}

async function changePlusState(nextEnabled) {
  if (!settingsReady || toggleBusy || nextEnabled === plusEnabled) return;

  const previous = plusEnabled;
  toggleBusy = true;
  reflectToggle();
  setStatus("שומר את ההגדרה…");

  try {
    const registration = await Otzaria.call("plugin.setNewTabPage", {
      enabled: nextEnabled
    });

    if (registration?.data !== true) {
      throw new Error(nextEnabled
        ? "כפתור + לא הוקצה לתוסף. ייתכן שתוסף אחר כבר משתמש בו."
        : "לא ניתן לשחרר כרגע את כפתור +.");
    }

    const saved = await Otzaria.call("storage.set", {
      key: ENABLED_KEY,
      value: nextEnabled
    });

    if (saved?.success === false) {
      await Otzaria.call("plugin.setNewTabPage", { enabled: previous });
      throw new Error("ההגדרה לא נשמרה. המצב הקודם שוחזר.");
    }

    plusEnabled = nextEnabled;
    setStatus(nextEnabled ? "כפתור + הופעל." : "כפתור + כובה.");
  } catch (error) {
    plusEnabled = previous;
    setStatus(error?.message || "לא ניתן לעדכן את ההגדרה.");
  } finally {
    toggleBusy = false;
    reflectToggle();
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
  if (event?.source !== "newTabButton" || handlingNewTabButton || !plusEnabled) return;

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
  void loadSettings().catch((error) => {
    settingsReady = false;
    reflectToggle();
    setStatus(error?.message || "לא ניתן לטעון את ההגדרות.");
    console.error("[Open Plus] Could not load settings:", error);
  });
});

Otzaria.on("theme.changed", applyTheme);
Otzaria.on("plugin.page_opened", (event) => {
  void handlePageOpened(event);
});

toggle?.addEventListener("change", () => {
  void changePlusState(toggle.checked);
});
