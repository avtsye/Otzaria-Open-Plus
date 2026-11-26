"use strict";
const ENABLED_KEY="openPlus.enabled",DESTINATION_KEY="openPlus.destination";
let handlingNewTabButton=false,plusEnabled=true,destination="library",settingsReady=false,toggleBusy=false,revealTimer=null;
const toggle=document.getElementById("plus-toggle"),destinationSelect=document.getElementById("destination-select"),status=document.getElementById("status");
const feedbackButton=document.getElementById("feedback-button"),feedbackDialog=document.getElementById("feedback-dialog"),feedbackType=document.getElementById("feedback-type"),feedbackDetails=document.getElementById("feedback-details"),feedbackSubmit=document.getElementById("feedback-submit"),feedbackCancel=document.getElementById("feedback-cancel");
function setStatus(message){if(status)status.textContent=message}
function revealSettingsPage(){if(!document.body.classList.contains("handoff-active"))document.body.classList.remove("startup-pending")}
function applyTheme(theme){
 const colors=theme?.colorScheme;if(!colors)return;const root=document.documentElement;
 const vars={"--color-primary":colors.primary,"--color-on-primary":colors.onPrimary,"--color-secondary":colors.secondary,"--color-on-secondary":colors.onSecondary,"--color-secondary-container":colors.secondaryContainer,"--color-on-secondary-container":colors.onSecondaryContainer,"--color-surface":colors.surface,"--color-on-surface":colors.onSurface,"--color-on-surface-variant":colors.onSurfaceVariant,"--color-surface-container-high":colors.surfaceContainerHigh,"--color-surface-container-highest":colors.surfaceContainerHighest,"--color-error":colors.error,"--color-on-error":colors.onError,"--color-outline":colors.outline,"--color-outline-variant":colors.outlineVariant||colors.outline};
 for(const [name,value] of Object.entries(vars))if(typeof value==="string"&&value)root.style.setProperty(name,value);
 const typography=theme.typography||{};
 if(typeof typography.uiFontFamily==="string"&&typography.uiFontFamily.trim())root.style.setProperty("--font-ui","'"+typography.uiFontFamily.replace(/'/g,"")+"',system-ui,sans-serif");
 if(typeof typography.fontFamily==="string"&&typography.fontFamily.trim())root.style.setProperty("--font-main","'"+typography.fontFamily.replace(/'/g,"")+"',serif");
 if(Number.isFinite(typography.fontSize))root.style.setProperty("--font-size-base",typography.fontSize+"px");
 if(Number.isFinite(typography.lineHeight))root.style.setProperty("--line-height",String(typography.lineHeight));
 if(theme.mode==="dark"||theme.mode==="light")root.style.colorScheme=theme.mode;
}
function reflectControls(){if(toggle){toggle.checked=plusEnabled;toggle.disabled=!settingsReady||toggleBusy}if(destinationSelect){destinationSelect.value=destination;destinationSelect.disabled=!settingsReady||toggleBusy}}
async function loadSettings(){
 const [enabledResponse,destinationResponse]=await Promise.all([Otzaria.call("storage.get",{key:ENABLED_KEY}),Otzaria.call("storage.get",{key:DESTINATION_KEY})]);
 if(enabledResponse?.success===false||destinationResponse?.success===false)throw new Error("לא ניתן לקרוא את ההגדרות השמורות.");
 plusEnabled=enabledResponse?.data==null?true:enabledResponse.data===true;destination=destinationResponse?.data==="detection"?"detection":"library";settingsReady=true;reflectControls();
}
async function saveSetting(key,value){const response=await Otzaria.call("storage.set",{key,value});if(response?.success===false)throw new Error("שמירת ההגדרה נכשלה.")}
async function changePlusState(nextEnabled){
 if(!settingsReady||toggleBusy||nextEnabled===plusEnabled)return;const previous=plusEnabled;toggleBusy=true;reflectControls();setStatus("שומר את ההגדרה…");
 try{const registration=await Otzaria.call("plugin.setNewTabPage",{enabled:nextEnabled});if(registration?.data!==true)throw new Error(nextEnabled?"כפתור + לא הוקצה לתוסף. ייתכן שתוסף אחר כבר משתמש בו.":"לא ניתן לשחרר כרגע את כפתור +.");await saveSetting(ENABLED_KEY,nextEnabled);plusEnabled=nextEnabled;setStatus(nextEnabled?"כפתור + הופעל.":"כפתור + כובה.")}
 catch(error){plusEnabled=previous;setStatus(error?.message||"לא ניתן לעדכן את ההגדרה.")}
 finally{toggleBusy=false;reflectControls()}
}
async function changeDestination(nextDestination){
 if(!settingsReady||!["library","detection"].includes(nextDestination))return;const previous=destination;destination=nextDestination;reflectControls();
 try{await saveSetting(DESTINATION_KEY,destination);setStatus(destination==="library"?"לחיצה על + תפתח ישירות את הספרייה.":"פתיחה אוטומטית של האיתור דורשת תמיכה נוספת בליבת אוצריא.")}
 catch(error){destination=previous;reflectControls();setStatus(error?.message||"לא ניתן לשמור את יעד הפתיחה.")}
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
  if(destination==="detection"){console.warn("[Open Plus] Automatic detection opening requires a core SDK API.");return}
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
destinationSelect?.addEventListener("change",()=>{void changeDestination(destinationSelect.value)});
feedbackButton?.addEventListener("click",openFeedbackDialog);
feedbackCancel?.addEventListener("click",closeFeedbackDialog);
feedbackSubmit?.addEventListener("click",()=>{void submitFeedback()});
feedbackDialog?.addEventListener("click",event=>{if(event.target===feedbackDialog)closeFeedbackDialog()});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeFeedbackDialog()});
