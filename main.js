/* Otzaria Open Plus — headless, JS only. */
"use strict";
let registered = false;
async function registerPlus() {
  try {
    const response = await Otzaria.call("plugin.setNewTabPage", { enabled: true });
    registered = response?.data === true;
    if (!registered) console.warn("[Open Plus] Plus button registration was not granted.", response);
  } catch (error) {
    console.error("[Open Plus] Unable to register + button:", error);
  }
}
async function openLibrary() {
  try {
    await Otzaria.call("navigation.goTo", { target: "library" });
  } catch (error) {
    console.error("[Open Plus] Unable to open native library:", error);
  }
}
Otzaria.on("plugin.boot", () => { void registerPlus(); });
Otzaria.on("plugin.page_opened", event => {
  if (event?.source === "newTabButton") void openLibrary();
});
