"use strict";
const ENABLED_KEY="openPlus.enabled";
let handlingNewTabButton=false,plusEnabled=true,settingsReady=false,toggleBusy=false,revealTimer=null;
const toggle=document.getElementById("plus-toggle"),status=document.getElementById("status");
const feedbackButton=document.getElementById("feedback-button"),feedbackDialog=document.getElementById("feedback-dialog"),feedbackType=document.getElementById("feedback-type"),feedbackDetails=document.getElementById("feedback-details"),feedbackSubmit=document.getElementById("feedback-submit"),feedbackCancel=document.getElementById("feedback-cancel");
function setStatus(message){if(status)status.textContent=message}
function revealSettingsPage(){if(!document.body.classList.contains("handoff-active"))document.body.classList.remove("startup-pending")}
function applyTheme(theme){
 if(!theme?.colorScheme)return;
 const cs=theme.colorScheme,root=document.documentElement;
 const colorVars={
  "--color-primary":cs.primary,"--color-on-primary":cs.onPrimary,
  "--color-secondary":cs.secondary,"--color-on-secondary":cs.onSecondary,
  "--color-secondary-container":cs.secondaryContainer,"--color-on-secondary-container":cs.onSecondaryContainer,
  "--color-surface":cs.surface,"--color-on-surface":cs.onSurface,"--color-on-surface-variant":cs.onSurfaceVariant,
  "--color-surface-container-high":cs.surfaceContainerHigh,"--color-surface-container-highest":cs.surfaceContainerHighest,
  "--color-error":cs.error,"--color-on-error":cs.onError,"--color-outline":cs.outline,
  "--color-outline-variant":cs.outlineVariant,"--color-scrim":cs.scrim
 };
 for(const [name,value] of Object.entries(colorVars))if(typeof value==="string"&&value.trim())root.style.setProperty(name,value);
 root.style.setProperty("--color-primary-subtle","color-mix(in srgb,var(--color-primary) 12%,transparent)");
 root.style.setProperty("--color-secondary-subtle","color-mix(in srgb,var(--color-secondary) 12%,transparent)");
 const typography=theme.typography||{};
 if(typeof typography.uiFont==="string"&&typography.uiFont.trim())root.style.setProperty("--font-ui",typography.uiFont);
 else if(typeof typography.uiFontFamily==="string"&&typography.uiFontFamily.trim())root.style.setProperty("--font-ui", "'"+typography.uiFontFamily.replace(/['"]/g,"")+"',system-ui,sans-serif");
 if(Number.isFinite(typography.fontSize))root.style.setProperty("--font-size-base",typography.fontSize+"px");
 if(Number.isFinite(typography.lineHeight))root.style.setProperty("--line-height",String(typography.lineHeight));
 const surfaces=theme.surfaces||{};
 root.style.setProperty("--surface-panel",surfaces.panel||cs.surface);
 root.style.setProperty("--surface-card",surfaces.card||cs.surface);
 root.style.setProperty("--surface-top-bar",surfaces.topBar||cs.surfaceContainerHigh);
 if(Number.isFinite(theme.radius)&&theme.radius>0)root.style.setProperty("--radius",theme.radius+"px");
 if(theme.spacing)for(const key of ["sm","smd","md","lg"])if(Number.isFinite(theme.spacing[key]))root.style.setProperty("--space-"+key,theme.spacing[key]+"px");
 if(Number.isFinite(theme.density?.topBarHeight)&&theme.density.topBarHeight>0)root.style.setProperty("--top-bar-height",theme.density.topBarHeight+"px");
 document.body.classList.toggle("dark-mode",theme.mode==="dark");
 root.style.colorScheme=theme.mode==="dark"?"dark":"light";
}
function reflectControls(){if(toggle){toggle.checked=plusEnabled;toggle.disabled=!settingsReady||toggleBusy}}
async function loadSettings(){
 const response=await Otzaria.call("storage.get",{key:ENABLED_KEY});
 if(response?.success===false)throw new Error("לא ניתן לקרוא את ההגדרות השמורות.");
 plusEnabled=response?.data==null?true:response.data===true;settingsReady=true;reflectControls();
}
async function saveSetting(value){const response=await Otzaria.call("storage.set",{key:ENABLED_KEY,value});if(response?.success===false)throw new Error("שמירת ההגדרה נכשלה.")}
async function changePlusState(nextEnabled){
 if(!settingsReady||toggleBusy||nextEnabled===plusEnabled)return;const previous=plusEnabled;toggleBusy=true;reflectControls();setStatus("שומר את ההגדרה…");
 try{const registration=await Otzaria.call("plugin.setNewTabPage",{enabled:nextEnabled});if(registration?.data!==true)throw new Error(nextEnabled?"כפתור + לא הוקצה לתוסף. ייתכן שתוסף אחר כבר משתמש בו.":"לא ניתן לשחרר כרגע את כפתור +.");await saveSetting(nextEnabled);plusEnabled=nextEnabled;setStatus(nextEnabled?"כפתור + הופעל.":"כפתור + כובה.")}
 catch(error){plusEnabled=previous;setStatus(error?.message||"לא ניתן לעדכן את ההגדרה.")}
 finally{toggleBusy=false;reflectControls()}
}
function openFeedbackDialog(){feedbackDialog?.classList.add("open");feedbackDetails?.focus()}
function closeFeedbackDialog(){feedbackDialog?.classList.remove("open")}
async function submitFeedback(){
 const details=feedbackDetails?.value.trim()||"";if(!details){setStatus("יש לכתוב את תוכן הדיווח לפני השליחה.");feedbackDetails?.focus();return}
 feedbackSubmit.disabled=true;feedbackCancel.disabled=true;
 try{const result=await Otzaria.call("feedback.report",{details,reportType:feedbackType?.value||"other"});const outcome=result?.data;closeFeedbackDialog();feedbackDetails.value="";setStatus(outcome==="sent"?"הדיווח נשלח. תודה!":outcome==="queued"?"הדיווח נשמר לשליחה כשהחיבור יתחדש.":outcome==="cancelled"?"שליחת הדיווח בוטלה.":"חלון הדיווח נסגר.")}
 catch(error){setStatus(error?.message||"לא ניתן לשלוח את הדיווח.")}
 finally{feedbackSubmit.disabled=false;feedbackCancel.disabled=false}
}
async function closeOwnPluginTab(){
 const stateResponse=await Otzaria.call("reader.getCurrentState"),tabs=stateResponse?.data?.openTabs;if(!Array.isArray(tabs))return false;
 const ownTabIndex=tabs.findIndex(tab=>tab?.isSelf===true);if(ownTabIndex<0)return false;const closeResponse=await Otzaria.call("reader.closeTab",{index:ownTabIndex});return closeResponse?.data===true;
}
async function handlePageOpened(event){
 if(event?.source!=="newTabButton"||handlingNewTabButton||!plusEnabled)return;handlingNewTabButton=true;
 if(revealTimer!==null){window.clearTimeout(revealTimer);revealTimer=null}document.body.classList.add("handoff-active");
 try{
  const navigation=await Otzaria.call("navigation.goTo",{target:"library"});
  if(navigation?.data!==true){document.body.classList.remove("handoff-active");setStatus("לא ניתן לפתוח את הספרייה.");revealSettingsPage();return}
  await closeOwnPluginTab();
 }catch(error){document.body.classList.remove("handoff-active");setStatus(error?.message||"המעבר נכשל.");revealSettingsPage();console.error("[Open Plus] Failed to handle the + button:",error)}
 finally{handlingNewTabButton=false}
}
Otzaria.on("plugin.boot",payload=>{
 applyTheme(payload?.theme);
 void loadSettings().then(()=>{revealTimer=window.setTimeout(revealSettingsPage,650)}).catch(error=>{settingsReady=false;reflectControls();setStatus(error?.message||"לא ניתן לטעון את ההגדרות.");console.error("[Open Plus] Could not load settings:",error);revealSettingsPage()});
});
Otzaria.on("theme.changed",applyTheme);
Otzaria.on("plugin.page_opened",event=>{void handlePageOpened(event)});
toggle?.addEventListener("change",()=>{void changePlusState(toggle.checked)});
feedbackButton?.addEventListener("click",openFeedbackDialog);
feedbackCancel?.addEventListener("click",closeFeedbackDialog);
feedbackSubmit?.addEventListener("click",()=>{void submitFeedback()});
feedbackDialog?.addEventListener("click",event=>{if(event.target===feedbackDialog)closeFeedbackDialog()});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeFeedbackDialog()});
