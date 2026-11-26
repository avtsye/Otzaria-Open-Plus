"use strict";

const ENABLED_KEY = "openPlus.enabled";
const DESTINATION_KEY = "openPlus.destination";
let handlingNewTabButton = false;
let plusEnabled = true;
let destination = "library";
let settingsReady = false;
let toggleBusy = false;

const toggle = document.getElementById("plus-toggle");
const destinationSelect = document.getElementById("destination-select");
const status = document.getElementById("status");
const handoff = document.getElementById("handoff");
const handoffLink = document.getElementById("handoff-link");
const feedbackButton = document.getElementById("feedback-button");

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
  if (theme.mode === "dark" || theme.mode === "light") root.style.colorScheme = theme.mode;
}

function reflectControls() {
  if (toggle) {
    toggle.checked = plusEnabled;
    toggle.disabled = !settingsReady || toggleBusy;
  }
  if (destinationSelect) {
    destinationSelect.value = destination;
    destinationSelect.disabled = !settingsReady || toggleBusy;
  }
}

async function loadSettings() {
  const [enabledResponse, destinationResponse] = await Promise.all([
    Otzaria.call("storage.get", { key: ENABLED_KEY }),
    Otzaria.call("storage.get", { key: DESTINATION_KEY })
  ]);
  if (enabledResponse?.success === false || destinationResponse?.success === false) {
    throw new Error("לא ניתן לקרוא את ההגדרות השמורות.");
  }
  plusEnabled = enabledResponse?.data == null ? true : enabledResponse.data === true;
  destination = destinationResponse?.data === "detection" ? "detection" : "library";
  settingsReady = true;
  reflectControls();
}

async function saveSetting(key, value) {
  const response = await Otzaria.call("storage.set", { key, value });
  if (response?.success === false) throw new Error("שמירת ההגדרה נכשלה.");
}

async function changePlusState(nextEnabled) {
  if (!settingsReady || toggleBusy || nextEnabled === plusEnabled) return;
  const previous = plusEnabled;
  toggleBusy = true;
  reflectControls();
  setStatus("שומר את ההגדרה…");
  try {
    const registration = await Otzaria.call("plugin.setNewTabPage", { enabled: nextEnabled });
    if (registration?.data !== true) {
      throw new Error(nextEnabled
        ? "כפתור + לא הוקצה לתוסף. ייתכן שתוסף אחר כבר משתמש בו."
        : "לא ניתן לשחרר כרגע את כפתור +.");
    }
    await saveSetting(ENABLED_KEY, nextEnabled);
    plusEnabled = nextEnabled;
    setStatus(nextEnabled ? "כפתור + הופעל." : "כפתור + כובה.");
  } catch (error) {
    plusEnabled = previous;
    setStatus(error?.message || "לא ניתן לעדכן את ההגדרה.");
  } finally {
    toggleBusy = false;
    reflectControls();
  }
}

async function changeDestination(nextDestination) {
  if (!settingsReady || !["library", "detection"].includes(nextDestination)) return;
  const previous = destination;
  destination = nextDestination;
  reflectControls();
  try {
    await saveSetting(DESTINATION_KEY, destination);
    setStatus(destination === "library"
      ? "לחיצה על + תפתח את הספרייה."
      : "לחיצה על + תציג קישור לפתיחת מסך האיתור.");
  } catch (error) {
    destination = previous;
    reflectControls();
    setStatus(error?.message || "לא ניתן לשמור את יעד הפתיחה.");
  }
}

async function submitFeedback() {
  if (!feedbackButton) return;
  feedbackButton.disabled = true;
  setStatus("פותח טופס משוב…");
  try {
    const result = await Otzaria.call("feedback.report", {
      details: "משוב על התוסף מוסיף+",
      reportType: "other"
    });
    const outcome = result?.data;
    setStatus(outcome === "sent" ? "המשוב נשלח. תודה!"
      : outcome === "queued" ? "המשוב נשמר לשליחה כשהחיבור יתחדש."
      : outcome === "cancelled" ? "שליחת המשוב בוטלה."
      : "טופס המשוב נסגר.");
  } catch (error) {
    setStatus(error?.message || "לא ניתן לפתוח את טופס המשוב.");
  } finally {
    feedbackButton.disabled = false;
  }
}

async function closeOwnPluginTab() {
  const stateResponse = await Otzaria.call("reader.getCurrentState");
  const tabs = stateResponse?.data?.openTabs;
  if (!Array.isArray(tabs)) return false;
  const ownTabIndex = tabs.findIndex((tab) => tab?.isSelf === true);
  if (ownTabIndex < 0) return false;
  const closeResponse = await Otzaria.call("reader.closeTab", { index: ownTabIndex });
  return closeResponse?.data === true;
}

async function handlePageOpened(event) {
  if (event?.source !== "newTabButton" || handlingNewTabButton || !plusEnabled) return;
  handlingNewTabButton = true;
  document.body.classList.add("handoff-active");
  try {
    if (destination === "detection") {
      if (handoffLink) handoffLink.hidden = false;
      const closed = await closeOwnPluginTab();
      if (!closed) console.warn("[Open Plus] Could not close the handoff tab.");
      return;
    }
    const navigation = await Otzaria.call("navigation.goTo", { target: "library" });
    if (navigation?.data !== true) {
      document.body.classList.remove("handoff-active");
      setStatus("לא ניתן לפתוח את הספרייה.");
      return;
    }
    await closeOwnPluginTab();
  } catch (error) {
    document.body.classList.remove("handoff-active");
    setStatus(error?.message || "המעבר נכשל.");
    console.error("[Open Plus] Failed to handle the + button:", error);
  } finally {
    handlingNewTabButton = false;
  }
}

Otzaria.on("plugin.boot", (payload) => {
  applyTheme(payload?.theme);
  void loadSettings().catch((error) => {
    settingsReady = false;
    reflectControls();
    setStatus(error?.message || "לא ניתן לטעון את ההגדרות.");
    console.error("[Open Plus] Could not load settings:", error);
  });
});
Otzaria.on("theme.changed", applyTheme);
Otzaria.on("plugin.page_opened", (event) => { void handlePageOpened(event); });
toggle?.addEventListener("change", () => { void changePlusState(toggle.checked); });
destinationSelect?.addEventListener("change", () => { void changeDestination(destinationSelect.value); });
feedbackButton?.addEventListener("click", () => { void submitFeedback(); });
