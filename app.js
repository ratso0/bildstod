// © 2025 ratso0. Alla rättigheter förbehållna.
// Bildstöd - AAC-app för barn och tonåringar
// Obehörig kopiering eller distribution är förbjuden.

const $ = id => document.getElementById(id);

// ── LAGRING (localStorage kan kasta i privata fönster) ──
const store = {
  get(key, fallback = null) { try { const v = localStorage.getItem(key); return v === null ? fallback : v; } catch { return fallback; } },
  set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } },
  del(key) { try { localStorage.removeItem(key); } catch {} }
};

// ── PROFILER ──
const PROFILES_KEY = "bildstod_profiles";
const PROFILE_KEY = "bildstod_profile";
function loadProfiles() {
  try {
    const list = JSON.parse(store.get(PROFILES_KEY));
    if (Array.isArray(list) && list.length) return list;
  } catch {}
  return [{ id: "default", name: "Barn 1" }];
}
let profiles = loadProfiles();
let profileId = store.get(PROFILE_KEY);
if (!profiles.some(p => p.id === profileId)) profileId = profiles[0].id;
const saveProfiles = () => store.set(PROFILES_KEY, JSON.stringify(profiles));
const currentProfile = () => profiles.find(p => p.id === profileId);
// Standardprofilen använder den ursprungliga databasen så befintliga kort finns kvar
const dbNameFor = id => id === "default" ? "BildstodV3" : "BildstodV3_" + id;

// ── INDEXEDDB ──
let db;
function openDB() {
  if (db) { db.close(); db = null; }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(dbNameFor(profileId), 1);
    req.onupgradeneeded = e => {
      if (!e.target.result.objectStoreNames.contains("nodes")) {
        e.target.result.createObjectStore("nodes", { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = e => { db = e.target.result; resolve(); };
    req.onerror = e => reject(e.target.error);
  });
}
const txS = mode => db.transaction("nodes", mode || "readonly").objectStore("nodes");
const dbAll = () => db ? new Promise((resolve, reject) => {
  const req = txS().getAll();
  req.onsuccess = e => resolve(e.target.result);
  req.onerror = reject;
}) : Promise.resolve([]);
const dbAdd = node => db ? new Promise((resolve, reject) => {
  const req = txS("readwrite").add(node);
  req.onsuccess = e => resolve(e.target.result);
  req.onerror = reject;
}) : Promise.resolve(Math.random());
const dbDel = id => db ? new Promise((resolve, reject) => {
  const tx = db.transaction("nodes", "readwrite");
  tx.objectStore("nodes").delete(id);
  tx.oncomplete = resolve;
  tx.onerror = reject;
}) : Promise.resolve();
const dbPut = node => db ? new Promise((resolve, reject) => {
  const req = txS("readwrite").put(node);
  req.onsuccess = e => resolve(e.target.result);
  req.onerror = reject;
}) : Promise.resolve();

// ── BEKRÄFTA ──
let confirmResolve = null;
const confirmOverlay = $("confirmOverlay");
function customConfirm(message, { title = "Ta bort?", yes = "🗑️ Ta bort" } = {}) {
  return new Promise(resolve => {
    confirmResolve = resolve;
    $("confirmTitle").textContent = title;
    $("confirmYes").textContent = yes;
    $("confirmMsg").textContent = message;
    confirmOverlay.classList.add("open");
  });
}
function closeConfirm(answer) {
  confirmOverlay.classList.remove("open");
  if (confirmResolve) { confirmResolve(answer); confirmResolve = null; }
}
$("confirmYes").addEventListener("click", () => closeConfirm(true));
$("confirmNo").addEventListener("click", () => closeConfirm(false));
confirmOverlay.addEventListener("click", e => { if (e.target === confirmOverlay) closeConfirm(false); });

// ── TOAST ──
const toastEl = $("toastEl");
let toastTimer = null;
function toast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2300);
}

// ── PIN OCH VUXENLÄGE ──
const PIN_KEY = "bildstod_pin";
const getPin = () => store.get(PIN_KEY);
const setPin = pin => store.set(PIN_KEY, pin);
let isAdult = false;
let pinBuffer = "";
// enter = ange PIN, create1/create2 = välj ny PIN, forgot = vuxenfråga, menu = vuxenmenyn
let pinMode = "enter";
let newPinDraft = "";
let forgotAnswer = "";

function setAdult(on) {
  isAdult = on;
  document.body.classList.toggle("adult", on);
  $("header").classList.toggle("adult-mode", on);
  $("adultBar").classList.toggle("show", on);
  $("lockBtn").textContent = on ? "🔓" : "🔒";
  $("lockBtn").setAttribute("aria-label", on ? "Vuxenmeny (upplåst)" : "Vuxenläge (låst)");
  $("addBtn").classList.toggle("hidden", !on);
  if (!on) applyFolderLock();
  render();
}

const pinOverlay = $("pinOverlay");
function setPinMode(mode, subtitle) {
  pinMode = mode;
  pinBuffer = "";
  const menu = mode === "menu";
  const titles = { enter: "🔒 Vuxenläge", create1: "🔑 Välj PIN-kod", create2: "🔑 Välj PIN-kod", forgot: "🤔 Vuxenfråga", menu: "🔓 Vuxenläge aktivt" };
  $("pinTitle").textContent = titles[mode];
  $("pinSubtitle").textContent = subtitle ?? (mode === "enter" ? "Ange PIN-kod" : "");
  $("pinError").textContent = "";
  $("pinDisplay").style.display = menu || mode === "forgot" ? "none" : "";
  $("pinAnswer").hidden = mode !== "forgot";
  $("pinAnswer").textContent = "";
  $("theNumpad").style.display = menu ? "none" : "";
  $("pinForgot").hidden = mode !== "enter";
  $("changePinArea").classList.toggle("show", menu);
  $("pinCancel").textContent = menu ? "Stäng" : "Avbryt";
  updateDots();
}
function openPinModal() {
  $("newPin1").value = "";
  $("newPin2").value = "";
  if (isAdult) {
    setPinMode("menu");
    refreshAdultMenu();
  } else if (!getPin()) {
    setPinMode("create1", "Första gången: välj 4 siffror som bara vuxna känner till");
  } else {
    setPinMode("enter");
  }
  pinOverlay.classList.add("open");
}
function closePinModal() {
  pinOverlay.classList.remove("open");
  pinBuffer = "";
  $("changePinArea").classList.remove("show");
}
function updateDots() {
  for (let i = 0; i < 4; i++) {
    const dot = $("d" + i);
    dot.classList.remove("filled", "error");
    if (i < pinBuffer.length) dot.classList.add("filled");
  }
}
function showPinError(message) {
  for (let i = 0; i < 4; i++) $("d" + i).classList.add("error");
  $("pinError").textContent = message;
  setTimeout(() => {
    pinBuffer = "";
    updateDots();
    $("pinError").textContent = "";
  }, 900);
}
function newForgotQuestion() {
  const a = 6 + Math.floor(Math.random() * 4);
  const b = 6 + Math.floor(Math.random() * 4);
  forgotAnswer = String(a * b);
  setPinMode("forgot", "Vad är " + a + " × " + b + "? Svara rätt för att välja en ny PIN-kod.");
}
function onPinComplete() {
  if (pinMode === "enter") {
    if (pinBuffer === getPin()) {
      closePinModal();
      setAdult(true);
      toast("Vuxenläge aktiverat 🔓");
    } else {
      showPinError("Fel PIN-kod, försök igen");
    }
  } else if (pinMode === "create1") {
    newPinDraft = pinBuffer;
    setPinMode("create2", "Skriv samma PIN-kod en gång till");
  } else if (pinMode === "create2") {
    if (pinBuffer === newPinDraft) {
      setPin(pinBuffer);
      closePinModal();
      setAdult(true);
      toast("PIN-kod sparad 🔓");
    } else {
      setPinMode("create1", "Koderna matchade inte. Välj en PIN-kod igen.");
    }
  }
}
document.querySelectorAll(".numpad-btn[data-n]").forEach(btn => {
  btn.addEventListener("click", () => {
    if (pinMode === "forgot") {
      if (pinBuffer.length >= forgotAnswer.length) return;
      pinBuffer += btn.dataset.n;
      $("pinAnswer").textContent = pinBuffer;
      if (pinBuffer.length === forgotAnswer.length) {
        setTimeout(() => {
          if (pinBuffer === forgotAnswer) setPinMode("create1", "Rätt! Välj en ny PIN-kod.");
          else { toast("Fel svar, försök igen"); newForgotQuestion(); }
        }, 200);
      }
      return;
    }
    if (pinBuffer.length >= 4) return;
    pinBuffer += btn.dataset.n;
    updateDots();
    if (pinBuffer.length === 4) setTimeout(onPinComplete, 120);
  });
});
$("pinDel").addEventListener("click", () => {
  pinBuffer = pinBuffer.slice(0, -1);
  if (pinMode === "forgot") $("pinAnswer").textContent = pinBuffer;
  updateDots();
  $("pinError").textContent = "";
});
$("pinForgot").addEventListener("click", newForgotQuestion);
$("pinCancel").addEventListener("click", closePinModal);
pinOverlay.addEventListener("click", e => { if (e.target === pinOverlay) closePinModal(); });
$("lockBtn").addEventListener("click", openPinModal);
$("lockNowBtn").addEventListener("click", () => {
  closePinModal();
  setAdult(false);
  toast("Låst 🔒");
});
$("savePinBtn").addEventListener("click", () => {
  const pin1 = String($("newPin1").value).trim();
  const pin2 = String($("newPin2").value).trim();
  if (!/^\d{4}$/.test(pin1)) { toast("PIN måste vara 4 siffror!"); return; }
  if (pin1 !== pin2) { toast("PIN-koderna matchar inte!"); return; }
  setPin(pin1);
  toast("PIN-kod ändrad! ✅");
  $("newPin1").value = "";
  $("newPin2").value = "";
});

// Dragspel i vuxenmenyn
document.querySelectorAll(".acc-head").forEach(head => {
  head.setAttribute("aria-expanded", "false");
  head.addEventListener("click", () => {
    const section = head.parentElement;
    const wasOpen = section.classList.contains("open");
    document.querySelectorAll(".acc-section").forEach(s => {
      s.classList.remove("open");
      s.querySelector(".acc-head").setAttribute("aria-expanded", "false");
    });
    if (!wasOpen) {
      section.classList.add("open");
      head.setAttribute("aria-expanded", "true");
    }
  });
});

function refreshAdultMenu() {
  updateThemeBtn();
  updateColsSeg();
  updateStripToggle();
  updateVoiceUI();
  renderProfileList();
  updateLockUI();
  renderPackList();
}

// ── TEMA (auto / ljust / mörkt) ──
const THEME_KEY = "bildstod_theme";
const THEME_LABELS = { auto: "Automatiskt", light: "Ljust", dark: "Mörkt" };
let theme = store.get(THEME_KEY);
if (!theme) {
  // Flytta över den gamla av/på-inställningen
  const oldDark = store.get("bildstod_dark");
  theme = oldDark === "1" ? "dark" : oldDark === "0" ? "light" : "auto";
}
const darkQuery = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;
function applyTheme() {
  const dark = theme === "dark" || (theme === "auto" && !!darkQuery && darkQuery.matches);
  document.body.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]').setAttribute("content", dark ? "#0b4a5e" : "#118AB2");
}
function updateThemeBtn() { $("themeBtn").textContent = "🌓 Tema: " + THEME_LABELS[theme]; }
if (darkQuery) darkQuery.addEventListener("change", applyTheme);
$("themeBtn").addEventListener("click", () => {
  theme = { auto: "light", light: "dark", dark: "auto" }[theme];
  store.set(THEME_KEY, theme);
  applyTheme();
  updateThemeBtn();
});
applyTheme();

// ── KOLUMNER ──
const COLS_KEY = "bildstod_cols";
let cols = parseInt(store.get(COLS_KEY), 10);
if (![1, 2, 3, 4].includes(cols)) cols = 2;
function applyCols() {
  document.documentElement.style.setProperty("--cols", cols);
  document.body.classList.remove("cols-1", "cols-2", "cols-3", "cols-4");
  document.body.classList.add("cols-" + cols);
}
function updateColsSeg() {
  $("colsSeg").querySelectorAll("button").forEach(b => {
    const sel = +b.dataset.cols === cols;
    b.classList.toggle("sel", sel);
    b.setAttribute("aria-pressed", sel);
  });
}
$("colsSeg").querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
  cols = +b.dataset.cols;
  store.set(COLS_KEY, cols);
  applyCols();
  updateColsSeg();
}));
applyCols();

// ── SKÄRMLÅS (skärmen släcks inte) ──
async function requestWakeLock() {
  try { if ("wakeLock" in navigator) await navigator.wakeLock.request("screen"); } catch {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") requestWakeLock(); });
requestWakeLock();

$("supportBtn").addEventListener("click", () => window.open("https://hihat.io/bildstd", "_blank"));

// ── TALSYNTES ──
const voiceCfg = {
  uri: store.get("bildstod_voice", ""),
  rate: parseFloat(store.get("bildstod_rate", "0.85")),
  pitch: parseFloat(store.get("bildstod_pitch", "1.1"))
};
function getVoices() {
  if (!("speechSynthesis" in window)) return [];
  return speechSynthesis.getVoices();
}
function chosenVoice() {
  return voiceCfg.uri ? getVoices().find(v => v.voiceURI === voiceCfg.uri) || null : null;
}
// Returnerar ett löfte som löses när uppläsningen är klar
function speak(text) {
  return new Promise(resolve => {
    if (!("speechSynthesis" in window) || !text) { resolve(); return; }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "sv-SE";
    const voice = chosenVoice();
    if (voice) { u.voice = voice; u.lang = voice.lang; }
    u.rate = voiceCfg.rate;
    u.pitch = voiceCfg.pitch;
    let done = false;
    const finish = () => { if (!done) { done = true; resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    // Vissa webbläsare skickar aldrig onend
    setTimeout(finish, 1500 + text.length * 180 / voiceCfg.rate);
    speechSynthesis.speak(u);
  });
}
function stopSpeech() {
  if ("speechSynthesis" in window) speechSynthesis.cancel();
}
function updateVoiceUI() {
  const sel = $("voiceSelect");
  const voices = getVoices();
  const swedish = voices.filter(v => /^sv/i.test(v.lang));
  const list = swedish.length ? swedish : voices;
  sel.innerHTML = "";
  const def = document.createElement("option");
  def.value = "";
  def.textContent = "Standard (svenska)";
  sel.appendChild(def);
  list.forEach(v => {
    const o = document.createElement("option");
    o.value = v.voiceURI;
    o.textContent = v.name + (swedish.length ? "" : " (" + v.lang + ")");
    sel.appendChild(o);
  });
  sel.value = list.some(v => v.voiceURI === voiceCfg.uri) ? voiceCfg.uri : "";
  $("rateRange").value = voiceCfg.rate;
  $("pitchRange").value = voiceCfg.pitch;
  updateVoiceLabels();
}
function updateVoiceLabels() {
  $("rateVal").textContent = voiceCfg.rate.toFixed(2).replace(".", ",");
  $("pitchVal").textContent = voiceCfg.pitch.toFixed(2).replace(".", ",");
}
if ("speechSynthesis" in window) speechSynthesis.addEventListener?.("voiceschanged", () => { if (isAdult) updateVoiceUI(); });
$("voiceSelect").addEventListener("change", e => { voiceCfg.uri = e.target.value; store.set("bildstod_voice", voiceCfg.uri); });
$("rateRange").addEventListener("input", e => { voiceCfg.rate = parseFloat(e.target.value); store.set("bildstod_rate", voiceCfg.rate); updateVoiceLabels(); });
$("pitchRange").addEventListener("input", e => { voiceCfg.pitch = parseFloat(e.target.value); store.set("bildstod_pitch", voiceCfg.pitch); updateVoiceLabels(); });
$("voiceTest").addEventListener("click", () => { stopSpeech(); speak("Hej! Jag vill leka."); });

// ── LJUDUPPSPELNING ──
let curAudio = null;
function stopAllSound() {
  if (curAudio) { curAudio.pause(); curAudio = null; }
  stopSpeech();
}
function playAudioData(src) {
  return new Promise(resolve => {
    const audio = new Audio(src);
    curAudio = audio;
    audio.onended = resolve;
    audio.onerror = resolve;
    audio.onpause = resolve;
    audio.play().catch(() => { toast("Kunde inte spela ljud"); resolve(); });
  });
}
// Spelar ett korts eget ljud eller läser upp namnet
function sayNode(node) {
  if (node.audioData) return playAudioData(node.audioData);
  if ("speechSynthesis" in window && node.name) return speak(node.name);
  toast("Inget ljud inspelat 🔇");
  return Promise.resolve();
}

// ── JA / NEJ ──
function playYesNo(key, word) {
  stopAllSound();
  const data = store.get(key);
  if (data) { playAudioData(data); return; }
  speak(word);
}
$("yesBtn").addEventListener("click", () => playYesNo("bildstod_yes_audio", "Ja"));
$("noBtn").addEventListener("click", () => playYesNo("bildstod_no_audio", "Nej"));

// ── INSPELNING (gemensam hjälpare) ──
async function startRecording(onDone) {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  const opts = window.MediaRecorder && MediaRecorder.isTypeSupported("audio/webm") ? { mimeType: "audio/webm" } : {};
  const rec = new MediaRecorder(stream, opts);
  rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
  rec.onstop = () => {
    stream.getTracks().forEach(t => t.stop());
    const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
    const reader = new FileReader();
    reader.onload = e => onDone(e.target.result);
    reader.readAsDataURL(blob);
  };
  rec.start();
  return rec;
}
const stopRecorder = rec => { if (rec && rec.state === "recording") rec.stop(); };
const readFileAsDataURL = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = e => resolve(e.target.result);
  reader.onerror = reject;
  reader.readAsDataURL(file);
});

// Egen röst för Ja/Nej
let ynRec = null;
function ynUpdateUI() {
  [["yes", "Yes"], ["no", "No"]].forEach(([key, Cap]) => {
    const data = store.get("bildstod_" + key + "_audio");
    const prev = $(key + "AudPrev");
    if (data) { prev.src = data; prev.style.display = "block"; $("del" + Cap + "Btn").style.display = ""; }
    else { prev.style.display = "none"; prev.removeAttribute("src"); $("del" + Cap + "Btn").style.display = "none"; }
  });
}
async function ynStartRec(target) {
  try {
    ynRec = await startRecording(data => {
      if (store.set(target === "yes" ? "bildstod_yes_audio" : "bildstod_no_audio", data)) {
        ynUpdateUI();
        toast("Inspelat! ✅");
      } else {
        toast("Kunde inte spara – ljudet är för långt");
      }
      $("yesNoRecActive").style.display = "none";
      $("recYesBtn").style.display = "";
      $("recNoBtn").style.display = "";
    });
    $("yesNoRecActive").style.display = "";
    $("recYesBtn").style.display = "none";
    $("recNoBtn").style.display = "none";
  } catch {
    toast("Mikrofonåtkomst nekad 🎙️");
  }
}
$("recYesBtn").addEventListener("click", () => ynStartRec("yes"));
$("recNoBtn").addEventListener("click", () => ynStartRec("no"));
$("yesNoStopBtn").addEventListener("click", () => stopRecorder(ynRec));
$("delYesBtn").addEventListener("click", () => { store.del("bildstod_yes_audio"); ynUpdateUI(); toast("Borttaget"); });
$("delNoBtn").addEventListener("click", () => { store.del("bildstod_no_audio"); ynUpdateUI(); toast("Borttaget"); });
ynUpdateUI();

// ── DATA OCH NAVIGERING ──
let all = [];
let nav = [];
const pid = () => nav.length ? nav[nav.length - 1].id : null;
const sortOrder = n => n.order ?? n.id ?? 0;
const kids = parentId => all
  .filter(n => (n.parentId ?? null) === (parentId ?? null))
  .sort((a, b) => sortOrder(a) - sortOrder(b));
const visibleKids = parentId => kids(parentId).filter(n => isAdult || !n.hidden);
const nextOrder = parentId => kids(parentId).reduce((max, n) => Math.max(max, sortOrder(n)), 0) + 1;
const COLORS = ["c0", "c1", "c2", "c3", "c4", "c5"];

// ── SKOLLÄGE (lås till kategori) ──
const lockKey = () => "bildstod_lock_" + profileId;
function getLockPath() {
  try {
    const path = JSON.parse(store.get(lockKey()));
    if (Array.isArray(path) && path.length && path.every(p => all.some(n => n.id === p.id && n.type === "folder"))) return path;
  } catch {}
  return null;
}
function applyFolderLock() {
  const path = getLockPath();
  if (path) nav = path.map(p => ({ ...p }));
}
function updateLockUI() {
  const path = getLockPath();
  const btn = $("lockFolderBtn");
  if (path) {
    const last = path[path.length - 1];
    $("lockInfo").textContent = "Appen är låst till ”" + last.name + "”. Barnet kan inte gå tillbaka förbi den kategorin.";
    btn.textContent = "🔓 Ta bort låsningen";
    btn.disabled = false;
  } else if (nav.length) {
    $("lockInfo").textContent = "Lås appen till kategorin du står i, så att barnet inte kan navigera bort. Bra i skolan eller vid en aktivitet.";
    btn.textContent = "📌 Lås till ”" + nav[nav.length - 1].name + "”";
    btn.disabled = false;
  } else {
    $("lockInfo").textContent = "Öppna den kategori du vill låsa till och kom tillbaka hit.";
    btn.textContent = "📌 Lås till denna kategori";
    btn.disabled = true;
  }
}
$("lockFolderBtn").addEventListener("click", () => {
  if (getLockPath()) {
    store.del(lockKey());
    toast("Låsning borttagen");
  } else if (nav.length) {
    store.set(lockKey(), JSON.stringify(nav));
    toast("Låst till ”" + nav[nav.length - 1].name + "” 📌");
  }
  updateLockUI();
  render();
});

// ── MENINGSREMSA ──
const STRIP_KEY = "bildstod_strip";
let stripOn = store.get(STRIP_KEY) === "1";
let strip = [];
let stripPlaying = 0;
function updateStripToggle() { $("stripToggle").textContent = "🧩 Meningsremsa: " + (stripOn ? "På" : "Av"); }
function renderStrip() {
  $("strip").hidden = !stripOn;
  const box = $("stripItems");
  box.innerHTML = "";
  if (!strip.length) {
    const empty = document.createElement("div");
    empty.className = "strip-empty";
    empty.textContent = "Tryck på kort för att bygga en mening";
    box.appendChild(empty);
  }
  strip.forEach((node, i) => {
    const item = document.createElement("div");
    item.className = "strip-item";
    item.dataset.i = i;
    const vis = document.createElement("div");
    vis.className = "si-vis";
    if (node.imageData) {
      const img = document.createElement("img");
      img.src = node.imageData;
      img.alt = "";
      vis.appendChild(img);
    } else {
      vis.textContent = node.emoji || "🖼️";
    }
    const label = document.createElement("div");
    label.className = "si-label";
    label.textContent = node.name;
    item.append(vis, label);
    box.appendChild(item);
  });
  box.scrollLeft = box.scrollWidth;
  $("stripPlay").disabled = !strip.length;
}
async function playStrip() {
  if (!strip.length) return;
  stopAllSound();
  const run = ++stripPlaying;
  for (let i = 0; i < strip.length; i++) {
    if (run !== stripPlaying) return;
    const el = $("stripItems").querySelector('[data-i="' + i + '"]');
    if (el) { el.classList.add("speaking"); el.scrollIntoView({ block: "nearest", inline: "nearest" }); }
    await sayNode(strip[i]);
    if (el) el.classList.remove("speaking");
  }
}
$("stripPlay").addEventListener("click", playStrip);
$("stripBack").addEventListener("click", () => { stripPlaying++; strip.pop(); renderStrip(); });
$("stripClear").addEventListener("click", () => { stripPlaying++; strip = []; renderStrip(); });
$("stripToggle").addEventListener("click", () => {
  stripOn = !stripOn;
  store.set(STRIP_KEY, stripOn ? "1" : "0");
  if (!stripOn) strip = [];
  updateStripToggle();
  renderStrip();
});

// ── SYMBOLER (emoji) ──
const EMOJI_DATA = [["🏠", "hemma", "hus", "hem"], ["🏫", "skola", "klassrum"], ["😊", "glad", "lycklig", "nöjd"], ["🚽", "toalett", "bajsa", "kiss", "wc", "toa"], ["🍽️", "mat", "äta", "tallrik"], ["🌳", "träd", "natur", "skog", "ute"], ["🎮", "spela", "spel", "gaming"], ["📚", "böcker", "läsa", "studera"], ["🎨", "måla", "konst", "rita"], ["🚗", "bil", "köra", "åka"], ["💊", "medicin", "tablett", "piller"], ["🛁", "bada", "badkar"], ["🐶", "hund", "valp"], ["🎵", "musik", "sjunga", "sång"], ["⚽", "fotboll", "sparka", "boll"], ["🌈", "regnbåge", "färger"], ["🧸", "nalle", "leksak", "björn", "leka"], ["🍎", "äpple", "frukt"], ["😴", "sova", "trött", "sömnig", "natt"], ["😢", "ledsen", "gråter", "trist"], ["😡", "arg", "ilsken", "sur"], ["😂", "skratta", "roligt", "kul"], ["❤️", "kärlek", "hjärta", "älska"], ["⭐", "stjärna", "bra", "guld"], ["🌙", "natt", "måne", "sova"], ["☀️", "sol", "soligt", "varmt", "dag"], ["🌧️", "regn", "regnig", "väder"], ["❄️", "snö", "vinter", "kallt", "is"], ["🔥", "eld", "varmt", "brand"], ["🎂", "tårta", "födelsedag", "kaka"], ["🍕", "pizza", "mat"], ["🍔", "hamburgare", "mat"], ["🍜", "nudlar", "soppa", "mat"], ["🥪", "smörgås", "macka", "mat"], ["🥛", "mjölk", "dricka"], ["💧", "vatten", "dricka", "droppe"], ["🥤", "dricka", "törstig", "läsk"], ["🧃", "juice", "dricka", "saft"], ["🍌", "banan", "frukt"], ["🍓", "jordgubbe", "frukt", "bär"], ["🥕", "morot", "grönsak"], ["🧁", "muffins", "kaka", "söt"], ["🍦", "glass", "söt", "kall"], ["🐱", "katt", "kisse"], ["🐰", "kanin", "hare"], ["🐸", "groda", "grön"], ["🦁", "lejon", "djur"], ["🐘", "elefant", "stor", "grå"], ["🦋", "fjäril", "insekt", "vacker"], ["🐟", "fisk", "hav", "simma"], ["🦄", "enhörning", "magisk"], ["🐔", "höna", "fågel"], ["🐺", "varg", "djur"], ["👕", "tröja", "kläder"], ["👟", "sko", "kläder", "springa"], ["🎒", "ryggsäck", "skola", "väska"], ["🛏️", "säng", "sova", "vila"], ["🪥", "tandborste", "tänder", "borsta"], ["🧴", "tvål", "tvätta", "hygien"], ["🚿", "duscha", "tvätta", "hygien"], ["🪞", "spegel", "titta"], ["🚪", "dörr", "öppna", "stäng"], ["🛋️", "soffa", "sitta", "vila"], ["📺", "tv", "titta", "film"], ["✏️", "penna", "skriva", "rita"], ["📏", "linjal", "mäta", "skola"], ["🖍️", "krita", "färg", "rita"], ["📐", "vinkelhake", "skola", "mäta"], ["🔔", "klocka", "ringa", "ljud"], ["📱", "telefon", "mobil", "platta"], ["💻", "dator", "skriva"], ["🎸", "gitarr", "musik"], ["🥁", "trummor", "musik"], ["🎹", "piano", "musik"], ["🚌", "buss", "åka", "resa"], ["🚲", "cykel", "cykla", "åka"], ["✈️", "flygplan", "resa", "flyga"], ["🚑", "ambulans", "sjukhus", "hjälp"], ["🏥", "sjukhus", "doktor", "sjuk"], ["🏪", "affär", "handla", "butik"], ["🌺", "blomma", "vacker", "växt"], ["🌻", "solros", "blomma", "gul"], ["🍀", "klöver", "grön", "tur"], ["🌵", "kaktus", "taggig", "öken"], ["🎄", "julgran", "jul", "grön"], ["🏖️", "strand", "hav", "sommar", "sol"], ["🏔️", "berg", "natur", "högt"], ["🎡", "pariserhjul", "nöjesfält", "rolig"], ["🏊", "simma", "pool", "vatten"], ["🚴", "cykla", "sport"], ["🏋️", "gym", "träning", "stark"], ["🤸", "gymnastik", "sport", "röra sig"], ["💪", "stark", "muskel", "bra"], ["👋", "hej", "vinka", "hälsa", "hejdå"], ["🙏", "snälla", "tack", "be"], ["🙋", "hjälp", "fråga", "jag"], ["✋", "sluta", "stopp", "nej"], ["⏸️", "paus", "vänta", "rast"], ["➕", "mer", "plus", "igen"], ["✅", "färdig", "klar", "ja"], ["👀", "se", "titta", "ögon"], ["💤", "sova", "trött", "vila"], ["🤒", "sjuk", "feber"], ["🤕", "ont", "skadad", "aj"], ["🩹", "plåster", "sår", "ont"], ["💉", "spruta", "vaccination", "sjuk"], ["🩺", "läkare", "doktor", "undersökning"], ["🧩", "pussel", "spel", "leka"], ["🎯", "mål", "prick"], ["🏆", "vinna", "trofé", "bäst", "mästare"], ["🥇", "guld", "vinna", "bäst"], ["🎁", "present", "gåva", "födelsedag"], ["🎉", "fest", "fira", "kul"], ["🎈", "ballong", "fest", "fira"], ["🔑", "nyckel", "öppna", "lås"], ["🪴", "krukväxt", "blomma", "inne"], ["🧺", "korg", "tvätt"], ["🧹", "sopborste", "städa", "rent"], ["🍳", "steka", "laga mat", "pannkaka"], ["☕", "kaffe", "varmt", "dricka"], ["🥱", "gäspa", "trött", "uttråkad"], ["🤗", "kram", "glad", "varm"], ["😌", "lugn", "avslappnad", "nöjd"], ["😰", "nervös", "rädd", "svettig"], ["🤔", "fundera", "tänka"], ["🤢", "illamående", "spy", "sjuk"], ["😱", "rädd", "chockad", "skrämd"], ["🥳", "fira", "fest", "glad"], ["😎", "cool", "solglasögon"], ["🤓", "nördig", "glasögon", "smart"], ["😇", "snäll", "ängel"], ["🥰", "kärlek", "söt", "glad"], ["😤", "frustrerad", "arg", "fnys"], ["🙄", "trött", "ögon", "trist"], ["😶", "tyst", "mun", "ingen"], ["🤐", "tyst", "mun", "prata inte"], ["😬", "nervös", "konstigt"], ["🤧", "nysning", "förkyld", "sjuk"], ["🤮", "spy", "illamående", "sjuk"], ["🥵", "varm", "het", "svett"], ["🥶", "kall", "frys", "frusen"], ["🫁", "lungor", "andas"], ["🧠", "hjärna", "tänka", "smart"], ["🦷", "tand", "tänder"], ["👁️", "öga", "se", "titta"], ["👃", "näsa", "lukta"], ["👅", "tunga", "smaka"], ["🤲", "händer", "hålla"], ["🫶", "hjärta", "händer", "kärlek"], ["🙌", "klappar", "bra", "hurra"], ["👏", "klappa", "bra", "applåd"], ["✌️", "fred", "seger", "två"], ["🎓", "student", "examen", "skola"], ["🏡", "hus", "hem", "trädgård"], ["🌡️", "termometer", "feber", "temperatur"], ["👨", "pappa", "man"], ["👩", "mamma", "kvinna"], ["👧", "flicka", "tjej", "syster"], ["👦", "pojke", "kille", "bror"], ["👵", "mormor", "farmor", "gammal"], ["👴", "morfar", "farfar", "gammal"], ["🧑‍🏫", "lärare", "fröken", "skola"]];

// Bygger en rad med valbara symboler. getSel/onPick håller reda på valet.
function buildEmojiRow(rowEl, query, getSel, onPick) {
  rowEl.innerHTML = "";
  const q = query.toLowerCase().trim();
  const list = q ? EMOJI_DATA.filter(e => e.slice(1).some(w => w.includes(q))) : EMOJI_DATA;
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "emoji-empty";
    empty.textContent = "Inga symboler hittades";
    rowEl.appendChild(empty);
    return;
  }
  list.forEach(entry => {
    const emoji = entry[0];
    const btn = document.createElement("button");
    btn.className = "eopt";
    btn.textContent = emoji;
    btn.setAttribute("aria-label", entry[1]);
    if (getSel() === emoji) btn.classList.add("sel");
    btn.addEventListener("click", () => {
      rowEl.querySelectorAll(".eopt").forEach(b => b.classList.remove("sel"));
      btn.classList.add("sel");
      onPick(emoji);
    });
    rowEl.appendChild(btn);
  });
}

// ── RENDERING ──
const grid = $("grid");
const emptyEl = $("empty");
const appTitle = $("appTitle");
const backBtn = $("backBtn");
let sortable = null;
let justDragged = false;

function renderTitle() {
  const current = nav.length ? nav[nav.length - 1] : null;
  appTitle.innerHTML = "";
  if (current) {
    const span = document.createElement("span");
    span.className = "title-text";
    span.textContent = (current.emoji || "📁") + " " + current.name;
    appTitle.appendChild(span);
  } else {
    appTitle.innerHTML = '<img class="title-icon" src="icon-192.png" alt=""><span class="title-text">Bildstöd</span>';
    if (profiles.length > 1) {
      const badge = document.createElement("span");
      badge.className = "title-profile";
      badge.textContent = currentProfile().name;
      appTitle.appendChild(badge);
    }
  }
}

function render() {
  grid.querySelectorAll(".card").forEach(c => c.remove());
  renderTitle();
  const lockPath = getLockPath();
  const minDepth = !isAdult && lockPath ? lockPath.length : 0;
  backBtn.classList.toggle("hidden", nav.length <= minDepth);

  const items = visibleKids(pid());
  if (!items.length) {
    emptyEl.style.display = "";
    emptyEl.querySelector("h2").textContent = nav.length ? "Tomt här inne" : "Välkommen!";
    emptyEl.querySelector("p").innerHTML = !isAdult && !all.length
      ? "Lås upp vuxenläget (🔒)<br>för att lägga till kort."
      : isAdult ? "Tryck <strong>+</strong> för att lägga till." : "";
  } else {
    emptyEl.style.display = "none";
  }

  items.forEach(node => {
    const isFolder = node.type === "folder";
    const card = document.createElement("div");
    card.className = "card " + COLORS[(node.id || 0) % 6] + (isFolder ? " folder" : "") + (node.hidden ? " is-hidden" : "");
    card.dataset.id = node.id;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.setAttribute("aria-label", node.name + (isFolder ? ", kategori" : "") + (node.hidden ? ", dold" : ""));

    const visual = document.createElement("div");
    visual.className = "card-visual";
    if (node.imageData) {
      const img = document.createElement("img");
      img.src = node.imageData;
      img.alt = "";
      img.draggable = false;
      visual.appendChild(img);
    } else {
      const em = document.createElement("div");
      em.className = "big-emoji";
      em.setAttribute("aria-hidden", "true");
      em.textContent = node.emoji || (isFolder ? "📁" : "🖼️");
      visual.appendChild(em);
    }
    card.appendChild(visual);

    const label = document.createElement("div");
    label.className = "card-label";
    label.textContent = node.name || "…";
    label.setAttribute("aria-hidden", "true");
    card.appendChild(label);

    if (isFolder) {
      const arrow = document.createElement("div");
      arrow.className = "folder-arrow";
      arrow.setAttribute("aria-hidden", "true");
      arrow.textContent = "▶";
      card.appendChild(arrow);
    } else if (node.audioData) {
      const badge = document.createElement("div");
      badge.className = "audio-badge";
      badge.setAttribute("aria-hidden", "true");
      badge.textContent = "🔊";
      card.appendChild(badge);
    }
    if (node.hidden) {
      const hb = document.createElement("div");
      hb.className = "hidden-badge";
      hb.textContent = "🙈 Dold";
      card.appendChild(hb);
    }

    const del = document.createElement("button");
    del.className = "card-del";
    del.textContent = "✕";
    del.setAttribute("aria-label", "Ta bort " + node.name);
    del.tabIndex = isAdult ? 0 : -1;
    del.addEventListener("click", async e => {
      e.stopPropagation();
      e.preventDefault();
      if (!isAdult) return;
      const count = isFolder ? all.filter(n => n.parentId === node.id).length : 0;
      const msg = isFolder && count > 0
        ? "Ta bort \"" + node.name + "\" och allt inuti (" + count + " objekt)?"
        : "Ta bort \"" + node.name + "\"?";
      if (await customConfirm(msg)) {
        await delRecursive(node.id);
        strip = strip.filter(n => all.includes(n));
        renderStrip();
        render();
        toast("Borttaget 🗑️");
      }
    });
    card.appendChild(del);

    const edit = document.createElement("button");
    edit.className = "card-edit";
    edit.textContent = "✏️";
    edit.setAttribute("aria-label", "Redigera " + node.name);
    edit.tabIndex = isAdult ? 0 : -1;
    edit.addEventListener("click", e => {
      e.stopPropagation();
      e.preventDefault();
      if (!isAdult) return;
      openEditModal(node);
    });
    card.appendChild(edit);

    const activate = () => {
      if (justDragged) return;
      if (isFolder) {
        nav.push({ id: node.id, name: node.name, emoji: node.emoji });
        render();
        grid.scrollTop = 0;
      } else {
        playCard(node, card);
      }
    };
    card.addEventListener("click", activate);
    card.addEventListener("keydown", e => {
      if (e.target !== card) return;
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); activate(); }
    });
    grid.appendChild(card);
  });

  setupSortable();
}

// Dra och släpp för att sortera (bara i vuxenläge)
function setupSortable() {
  if (!window.Sortable) return;
  if (isAdult && !sortable) {
    sortable = Sortable.create(grid, {
      draggable: ".card",
      filter: ".card-del, .card-edit",
      preventOnFilter: false,
      delay: 250,
      delayOnTouchOnly: true,
      animation: 150,
      onStart: () => { justDragged = true; },
      onEnd: async evt => {
        // Klicket som följer direkt efter släppet ska inte öppna kortet
        setTimeout(() => { justDragged = false; }, 80);
        if (evt.oldIndex === evt.newIndex) return;
        const ids = [...grid.querySelectorAll(".card")].map(c => +c.dataset.id);
        for (let i = 0; i < ids.length; i++) {
          const node = all.find(n => n.id === ids[i]);
          if (node && node.order !== i + 1) {
            node.order = i + 1;
            await dbPut(node);
          }
        }
      }
    });
  } else if (!isAdult && sortable) {
    sortable.destroy();
    sortable = null;
  }
}

function playCard(node, cardEl) {
  stripPlaying++;
  stopAllSound();
  cardEl.classList.add("playing");
  setTimeout(() => cardEl.classList.remove("playing"), 420);
  if (stripOn) {
    strip.push(node);
    if (strip.length > 15) strip.shift();
    renderStrip();
  }
  sayNode(node);
}

async function delRecursive(id) {
  for (const child of all.filter(n => n.parentId === id)) await delRecursive(child.id);
  await dbDel(id);
  all = all.filter(n => n.id !== id);
}
backBtn.addEventListener("click", () => {
  nav.pop();
  render();
});

// ── BILDVAL OCH BESKÄRNING ──
const IS_IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
let srcInput = null;
function pickImage(input) {
  if (IS_IOS) {
    input.removeAttribute("capture");
    input.click();
    return;
  }
  srcInput = input;
  $("srcOverlay").classList.add("open");
}
$("srcCamera").addEventListener("click", () => {
  $("srcOverlay").classList.remove("open");
  if (srcInput) { srcInput.setAttribute("capture", "environment"); srcInput.click(); }
});
$("srcGallery").addEventListener("click", () => {
  $("srcOverlay").classList.remove("open");
  if (srcInput) { srcInput.removeAttribute("capture"); srcInput.click(); }
});
$("srcCancel").addEventListener("click", () => {
  $("srcOverlay").classList.remove("open");
  srcInput = null;
});

const cropOverlay = $("cropOverlay");
const cropImgEl = $("cropImg");
const cropViewEl = $("cropView");
const cropZoomEl = $("cropZoom");
let cropCb = null;
const CS = { nw: 0, nh: 0, s: 1, minS: 1, maxS: 1, tx: 0, ty: 0, V: 300 };
function openCropper(src, cb) {
  cropCb = cb;
  const probe = new Image();
  probe.onload = () => {
    CS.nw = probe.naturalWidth;
    CS.nh = probe.naturalHeight;
    CS.tx = 0;
    CS.ty = 0;
    cropImgEl.src = src;
    cropZoomEl.value = 0;
    cropOverlay.classList.add("open");
    requestAnimationFrame(() => {
      CS.V = cropViewEl.clientWidth || 300;
      CS.minS = Math.max(CS.V / CS.nw, CS.V / CS.nh);
      CS.maxS = CS.minS * 5;
      CS.s = CS.minS;
      applyCrop();
    });
  };
  probe.src = src;
}
function clampCrop() {
  CS.s = Math.min(Math.max(CS.s, CS.minS), CS.maxS);
  const maxX = Math.max(0, (CS.nw * CS.s - CS.V) / 2);
  const maxY = Math.max(0, (CS.nh * CS.s - CS.V) / 2);
  CS.tx = Math.min(Math.max(CS.tx, -maxX), maxX);
  CS.ty = Math.min(Math.max(CS.ty, -maxY), maxY);
}
function applyCrop() {
  clampCrop();
  cropImgEl.style.transform = "translate(calc(-50% + " + CS.tx + "px), calc(-50% + " + CS.ty + "px)) scale(" + CS.s + ")";
  cropImgEl.style.width = CS.nw + "px";
  const pct = (CS.s - CS.minS) / (CS.maxS - CS.minS) * 100;
  cropZoomEl.value = isFinite(pct) ? pct : 0;
}
// Zoomar runt punkten (cx, cy) relativt mitten av rutan
function zoomTo(newScale, cx = 0, cy = 0) {
  newScale = Math.min(Math.max(newScale, CS.minS), CS.maxS);
  CS.tx = cx - (cx - CS.tx) * (newScale / CS.s);
  CS.ty = cy - (cy - CS.ty) * (newScale / CS.s);
  CS.s = newScale;
  applyCrop();
}
cropZoomEl.addEventListener("input", function () {
  zoomTo(CS.minS + this.value / 100 * (CS.maxS - CS.minS));
});
const cropPts = new Map();
let lastDist = 0;
cropViewEl.addEventListener("pointerdown", e => {
  cropViewEl.setPointerCapture(e.pointerId);
  cropPts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (cropPts.size === 2) {
    const [a, b] = [...cropPts.values()];
    lastDist = Math.hypot(a.x - b.x, a.y - b.y);
  }
});
cropViewEl.addEventListener("pointermove", e => {
  if (!cropPts.has(e.pointerId)) return;
  const prev = cropPts.get(e.pointerId);
  const pt = { x: e.clientX, y: e.clientY };
  if (cropPts.size === 1) {
    CS.tx += pt.x - prev.x;
    CS.ty += pt.y - prev.y;
    cropPts.set(e.pointerId, pt);
    applyCrop();
  } else if (cropPts.size === 2) {
    cropPts.set(e.pointerId, pt);
    const [a, b] = [...cropPts.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y);
    if (lastDist > 0) {
      const r = cropViewEl.getBoundingClientRect();
      zoomTo(CS.s * (dist / lastDist), (a.x + b.x) / 2 - r.left - r.width / 2, (a.y + b.y) / 2 - r.top - r.height / 2);
    }
    lastDist = dist;
  }
});
function cropPointerEnd(e) {
  cropPts.delete(e.pointerId);
  if (cropPts.size < 2) lastDist = 0;
}
cropViewEl.addEventListener("pointerup", cropPointerEnd);
cropViewEl.addEventListener("pointercancel", cropPointerEnd);
cropViewEl.addEventListener("wheel", e => {
  e.preventDefault();
  const r = cropViewEl.getBoundingClientRect();
  zoomTo(CS.s * (e.deltaY < 0 ? 1.08 : 0.92), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
}, { passive: false });
$("cropDone").addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 600;
  canvas.height = 600;
  const side = CS.V / CS.s;
  const cx = CS.nw / 2 - CS.tx / CS.s;
  const cy = CS.nh / 2 - CS.ty / CS.s;
  canvas.getContext("2d").drawImage(cropImgEl, cx - side / 2, cy - side / 2, side, side, 0, 0, 600, 600);
  const data = canvas.toDataURL("image/jpeg", 0.8);
  cropOverlay.classList.remove("open");
  if (cropCb) cropCb(data);
  cropCb = null;
});
$("cropCancel").addEventListener("click", () => {
  cropOverlay.classList.remove("open");
  cropCb = null;
});
// Läser en vald bildfil och skickar den vidare via beskäraren
function handleImageInput(input, cb) {
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file) return;
    const data = await readFileAsDataURL(file);
    input.value = "";
    openCropper(data, cb);
  });
}

function setPhotoArea(id, src) {
  const area = $(id);
  area.innerHTML = "";
  const img = document.createElement("img");
  img.src = src;
  img.alt = "";
  area.appendChild(img);
}
function setPhotoHint(id, text) {
  $(id).innerHTML = '<div class="pt-hint"><span>📷</span><small>' + text + "</small></div>";
}

// ── LÄGG TILL ──
const addOverlay = $("addOverlay");
const fileInp = $("fileInput");
const audioFileInp = $("audioFileInput");
let pImg = null;
let pAudio = null;
let pEmoji = null;
let fileTgt = null;
let addRec = null;
const stepIds = ["s0", "sF", "sC1", "sC2"];
function showStep(id, title) {
  stepIds.forEach(s => $(s).classList.remove("active"));
  $(id).classList.add("active");
  if (title) $("mTitle").textContent = title;
}
function openAddModal() {
  if (!isAdult) return;
  resetAdd();
  addOverlay.classList.add("open");
}
function closeAddModal() {
  addOverlay.classList.remove("open");
  stopRecorder(addRec);
}
function buildAddEmojis() {
  buildEmojiRow($("emojiRow"), $("emojiSearch").value, () => pEmoji, e => { pEmoji = e; });
  buildEmojiRow($("cEmojiRow"), $("cEmojiSearch").value, () => pEmoji, e => {
    // Symbol i stället för foto på bildkort
    pEmoji = e;
    pImg = null;
    $("cPhotoArea").innerHTML = '<span class="pt-emoji">' + e + "</span>";
  });
}
function resetAdd() {
  pImg = null;
  pAudio = null;
  pEmoji = null;
  fileTgt = null;
  $("fName").value = "";
  $("cName").value = "";
  setPhotoHint("fPhotoArea", "Bild (valfritt)");
  setPhotoHint("cPhotoArea", "Tryck för att ta bild");
  $("aMini").innerHTML = "";
  $("audPrev").style.display = "none";
  $("audPrev").removeAttribute("src");
  $("recIdle").style.display = "flex";
  $("recActive").style.display = "none";
  $("recordBtn").textContent = "🎙️ Spela in direkt";
  fileInp.value = "";
  audioFileInp.value = "";
  $("emojiSearch").value = "";
  $("cEmojiSearch").value = "";
  buildAddEmojis();
  showStep("s0", "Lägg till");
}
$("addBtn").addEventListener("click", openAddModal);
addOverlay.addEventListener("click", e => { if (e.target === addOverlay) closeAddModal(); });
$("s0Cancel").addEventListener("click", closeAddModal);
$("chooseFolder").addEventListener("click", () => showStep("sF", "Ny kategori"));
$("chooseCard").addEventListener("click", () => showStep("sC1", "Nytt bildkort"));
$("fBack").addEventListener("click", () => showStep("s0", "Lägg till"));
$("c1Back").addEventListener("click", () => showStep("s0", "Lägg till"));
$("c2Back").addEventListener("click", () => {
  pAudio = null;
  $("audPrev").style.display = "none";
  $("recIdle").style.display = "flex";
  showStep("sC1", "Nytt bildkort");
});
$("emojiSearch").addEventListener("input", buildAddEmojis);
$("cEmojiSearch").addEventListener("input", buildAddEmojis);
$("fPhotoArea").addEventListener("click", () => { fileTgt = "folder"; pickImage(fileInp); });
$("cPhotoArea").addEventListener("click", () => { fileTgt = "card"; pickImage(fileInp); });
handleImageInput(fileInp, data => {
  pImg = data;
  if (fileTgt === "folder") {
    setPhotoArea("fPhotoArea", pImg);
  } else {
    pEmoji = null;
    setPhotoArea("cPhotoArea", pImg);
    buildAddEmojis();
  }
});
function updateAMini() {
  const mini = $("aMini");
  mini.innerHTML = "";
  if (pImg) {
    const img = document.createElement("img");
    img.src = pImg;
    img.alt = "";
    mini.appendChild(img);
  } else if (pEmoji) {
    mini.textContent = pEmoji;
  }
}
function showAddAudio(data) {
  pAudio = data;
  $("audPrev").src = pAudio;
  $("audPrev").style.display = "block";
}
$("uploadAudioBtn").addEventListener("click", () => audioFileInp.click());
audioFileInp.addEventListener("change", async () => {
  const file = audioFileInp.files[0];
  if (!file) return;
  showAddAudio(await readFileAsDataURL(file));
  audioFileInp.value = "";
  toast("Ljudfil inläst! ✅");
});
$("saveFolder").addEventListener("click", async () => {
  try {
    const name = $("fName").value.trim();
    if (!name) { toast("Skriv ett namn! ✏️"); return; }
    const parentId = pid();
    const node = {
      parentId, type: "folder", name,
      emoji: pEmoji || null, imageData: pImg || null, audioData: null,
      order: nextOrder(parentId), createdAt: Date.now()
    };
    node.id = await dbAdd(node);
    all.push(node);
    render();
    closeAddModal();
    toast("Kategori sparad! 📁");
  } catch (err) {
    toast("Fel: " + err.message);
  }
});
$("goAudio").addEventListener("click", () => {
  if (!pImg && !pEmoji) { toast("Ta en bild eller välj en symbol! 📷"); return; }
  if (!$("cName").value.trim()) { toast("Skriv ett namn! ✏️"); return; }
  updateAMini();
  showStep("sC2", "Spela in ljud");
});
$("recordBtn").addEventListener("click", async () => {
  try {
    addRec = await startRecording(data => {
      showAddAudio(data);
      $("recActive").style.display = "none";
      $("recIdle").style.display = "flex";
      $("recordBtn").textContent = "🎙️ Spela in igen";
    });
    $("recIdle").style.display = "none";
    $("recActive").style.display = "";
  } catch {
    toast("Mikrofonåtkomst nekad 🎙️");
  }
});
$("stopBtn").addEventListener("click", () => stopRecorder(addRec));
async function saveCard(skipAudio) {
  try {
    stopRecorder(addRec);
    const name = $("cName").value.trim();
    if ((!pImg && !pEmoji) || !name) { toast("Bild och namn krävs!"); return; }
    const parentId = pid();
    const node = {
      parentId, type: "card", name,
      emoji: pImg ? null : pEmoji, imageData: pImg || null,
      audioData: skipAudio ? null : pAudio || null,
      order: nextOrder(parentId), createdAt: Date.now()
    };
    node.id = await dbAdd(node);
    all.push(node);
    render();
    closeAddModal();
    toast("Bildkort sparat! 🎉");
  } catch (err) {
    toast("Fel: " + err.message);
  }
}
$("saveCard").addEventListener("click", () => saveCard(false));
$("skipAudio").addEventListener("click", () => saveCard(true));

// ── REDIGERA ──
const editOverlay = $("editOverlay");
const eFileInput = $("eFileInput");
const eAudioFileInput = $("eAudioFileInput");
let editNode = null;
let eImg = null;
let eAudio = null;
let eEmoji = null;
let eHidden = false;
let eRec = null;
function buildEEmojis() {
  buildEmojiRow($("eEmojiRow"), $("eEmojiSearch").value, () => eEmoji, e => {
    eEmoji = e;
    // På bildkort ersätter symbolen fotot
    if (editNode && editNode.type === "card") {
      eImg = null;
      $("ePhotoArea").innerHTML = '<span class="pt-emoji">' + e + "</span>";
    }
  });
}
function updateHideBtn() {
  $("eHideBtn").textContent = eHidden ? "🙈 Dold för barnet" : "👁️ Synlig för barnet";
  $("eHideBtn").setAttribute("aria-pressed", eHidden);
}
function showEditAudio(data) {
  eAudio = data;
  if (data) {
    $("eAudPrev").src = data;
    $("eAudPrev").style.display = "block";
    $("eRemoveAudioBtn").style.display = "";
  } else {
    $("eAudPrev").style.display = "none";
    $("eAudPrev").removeAttribute("src");
    $("eRemoveAudioBtn").style.display = "none";
  }
}
function openEditModal(node) {
  editNode = node;
  eImg = node.imageData || null;
  eEmoji = node.emoji || null;
  eHidden = !!node.hidden;
  const isFolder = node.type === "folder";
  $("editTitle").textContent = isFolder ? "Redigera kategori" : "Redigera bildkort";
  $("eName").value = node.name || "";
  if (eImg) setPhotoArea("ePhotoArea", eImg);
  else if (eEmoji) $("ePhotoArea").innerHTML = '<span class="pt-emoji">' + eEmoji + "</span>";
  else setPhotoHint("ePhotoArea", "Tryck för att byta bild");
  $("eEmojiSearch").value = "";
  buildEEmojis();
  showEditAudio(node.audioData || null);
  $("eAudioSection").style.display = isFolder ? "none" : "flex";
  $("eRecActive").style.display = "none";
  $("eRecordBtn").style.display = "";
  $("eRecordBtn").textContent = "🎙️ Spela in nytt ljud";
  updateHideBtn();
  editOverlay.classList.add("open");
}
function closeEditModal() {
  editOverlay.classList.remove("open");
  stopRecorder(eRec);
  editNode = null;
}
editOverlay.addEventListener("click", e => { if (e.target === editOverlay) closeEditModal(); });
$("eCancel").addEventListener("click", closeEditModal);
$("eEmojiSearch").addEventListener("input", buildEEmojis);
$("ePhotoArea").addEventListener("click", () => pickImage(eFileInput));
handleImageInput(eFileInput, data => {
  eImg = data;
  setPhotoArea("ePhotoArea", eImg);
  if (editNode && editNode.type === "card") { eEmoji = null; buildEEmojis(); }
});
$("eHideBtn").addEventListener("click", () => { eHidden = !eHidden; updateHideBtn(); });
$("eRecordBtn").addEventListener("click", async () => {
  try {
    eRec = await startRecording(data => {
      showEditAudio(data);
      $("eRecActive").style.display = "none";
      $("eRecordBtn").style.display = "";
      $("eRecordBtn").textContent = "🎙️ Spela in igen";
    });
    $("eRecActive").style.display = "";
    $("eRecordBtn").style.display = "none";
  } catch {
    toast("Mikrofonåtkomst nekad 🎙️");
  }
});
$("eStopBtn").addEventListener("click", () => stopRecorder(eRec));
$("eUploadAudioBtn").addEventListener("click", () => eAudioFileInput.click());
eAudioFileInput.addEventListener("change", async () => {
  const file = eAudioFileInput.files[0];
  if (!file) return;
  showEditAudio(await readFileAsDataURL(file));
  eAudioFileInput.value = "";
  toast("Ljudfil inläst! ✅");
});
$("eRemoveAudioBtn").addEventListener("click", () => { showEditAudio(null); toast("Ljud borttaget"); });
$("eSave").addEventListener("click", async () => {
  try {
    stopRecorder(eRec);
    const name = $("eName").value.trim();
    if (!name) { toast("Skriv ett namn! ✏️"); return; }
    editNode.name = name;
    editNode.imageData = eImg || null;
    editNode.audioData = editNode.type === "folder" ? null : eAudio || null;
    editNode.emoji = eEmoji || null;
    editNode.hidden = eHidden;
    await dbPut(editNode);
    // Håll namn/emoji i navigeringen i synk
    nav.forEach(n => { if (n.id === editNode.id) { n.name = editNode.name; n.emoji = editNode.emoji; } });
    render();
    closeEditModal();
    toast("Ändringar sparade! ✅");
  } catch (err) {
    toast("Fel: " + err.message);
  }
});

// ── STARTPAKET ──
const PACKS = [
  { name: "Mat & dryck", emoji: "🍽️", cards: [["Äta", "🍽️"], ["Dricka", "🥛"], ["Vatten", "💧"], ["Smörgås", "🥪"], ["Frukt", "🍎"], ["Banan", "🍌"], ["Pizza", "🍕"], ["Glass", "🍦"], ["Mer", "➕"], ["Färdig", "✅"]] },
  { name: "Känslor", emoji: "😊", cards: [["Glad", "😊"], ["Ledsen", "😢"], ["Arg", "😡"], ["Rädd", "😱"], ["Trött", "😴"], ["Lugn", "😌"], ["Ont", "🤕"], ["Uttråkad", "🥱"]] },
  { name: "Behov", emoji: "🙋", cards: [["Toalett", "🚽"], ["Hjälp", "🙋"], ["Paus", "⏸️"], ["Sluta", "✋"], ["Törstig", "🥤"], ["Hungrig", "🍽️"], ["Kall", "🥶"], ["Varm", "🥵"], ["Vila", "🛋️"]] },
  { name: "Aktiviteter", emoji: "🎨", cards: [["Leka", "🧸"], ["Måla", "🎨"], ["Läsa", "📚"], ["Musik", "🎵"], ["Gå ut", "🌳"], ["Spela", "🎮"], ["Titta på TV", "📺"], ["Bada", "🛁"], ["Cykla", "🚲"]] },
  { name: "Personer", emoji: "👨‍👩‍👧", cards: [["Mamma", "👩"], ["Pappa", "👨"], ["Syster", "👧"], ["Bror", "👦"], ["Mormor", "👵"], ["Morfar", "👴"], ["Lärare", "🧑‍🏫"], ["Kompis", "🤗"]] },
  { name: "Småord", emoji: "💬", cards: [["Jag vill", "🙋"], ["Mer", "➕"], ["Sluta", "✋"], ["Hjälp", "🙏"], ["Klar", "✅"], ["Hej", "👋"], ["Tack", "🙏"], ["Titta", "👀"]] }
];
function renderPackList() {
  const box = $("packList");
  box.innerHTML = "";
  const where = nav.length ? "”" + nav[nav.length - 1].name + "”" : "startsidan";
  PACKS.forEach(pack => {
    const btn = document.createElement("button");
    btn.className = "mbtn mb-lavender";
    btn.textContent = pack.emoji + " " + pack.name + " (" + pack.cards.length + " kort)";
    btn.addEventListener("click", async () => {
      if (!await customConfirm("Lägga till ”" + pack.name + "” med " + pack.cards.length + " kort på " + where + "?", { title: "Startpaket", yes: "➕ Lägg till" })) return;
      await addPack(pack);
      closePinModal();
      toast(pack.name + " tillagd! 📦");
    });
    box.appendChild(btn);
  });
}
async function addPack(pack) {
  const parentId = pid();
  const folder = {
    parentId, type: "folder", name: pack.name, emoji: pack.emoji,
    imageData: null, audioData: null, order: nextOrder(parentId), createdAt: Date.now()
  };
  folder.id = await dbAdd(folder);
  all.push(folder);
  for (let i = 0; i < pack.cards.length; i++) {
    const [name, emoji] = pack.cards[i];
    const card = { parentId: folder.id, type: "card", name, emoji, imageData: null, audioData: null, order: i + 1, createdAt: Date.now() };
    card.id = await dbAdd(card);
    all.push(card);
  }
  render();
}

// ── PROFILHANTERING ──
function renderProfileList() {
  const box = $("profileList");
  box.innerHTML = "";
  profiles.forEach(p => {
    const row = document.createElement("div");
    row.className = "profile-row";
    const name = document.createElement("span");
    name.className = "pr-name";
    name.textContent = p.name;
    row.appendChild(name);
    const use = document.createElement("button");
    if (p.id === profileId) {
      use.textContent = "✓ Aktiv";
      use.className = "cur";
      use.disabled = true;
    } else {
      use.textContent = "Byt";
      use.addEventListener("click", () => switchProfile(p.id));
    }
    row.appendChild(use);
    if (p.id !== "default" && p.id !== profileId) {
      const del = document.createElement("button");
      del.className = "del";
      del.textContent = "🗑️";
      del.setAttribute("aria-label", "Ta bort profilen " + p.name);
      del.addEventListener("click", async () => {
        if (!await customConfirm("Ta bort profilen ”" + p.name + "” och alla dess kort? Det går inte att ångra.")) return;
        profiles = profiles.filter(x => x.id !== p.id);
        saveProfiles();
        store.del("bildstod_lock_" + p.id);
        try { indexedDB.deleteDatabase(dbNameFor(p.id)); } catch {}
        renderProfileList();
        toast("Profil borttagen");
      });
      row.appendChild(del);
    }
    box.appendChild(row);
  });
}
async function switchProfile(id) {
  profileId = id;
  store.set(PROFILE_KEY, id);
  nav = [];
  strip = [];
  try {
    await openDB();
    all = await dbAll();
    await seed();
  } catch (err) {
    all = [];
    console.warn("Kunde inte öppna profilens databas:", err);
  }
  renderStrip();
  render();
  refreshAdultMenu();
  toast("Profil: " + currentProfile().name);
}
$("addProfileBtn").addEventListener("click", async () => {
  const name = $("newProfileName").value.trim();
  if (!name) { toast("Skriv ett namn! ✏️"); return; }
  const id = "p" + Date.now().toString(36);
  profiles.push({ id, name });
  saveProfiles();
  $("newProfileName").value = "";
  await switchProfile(id);
});

// ── SÄKERHETSKOPIA ──
$("exportBtn").addEventListener("click", () => {
  try {
    const json = JSON.stringify({ version: 2, profile: currentProfile().name, exportedAt: new Date().toISOString(), nodes: all });
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    const d = new Date();
    const date = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const slug = profiles.length > 1 ? "-" + currentProfile().name.toLowerCase().replace(/[^a-z0-9åäö]+/g, "-") : "";
    a.href = url;
    a.download = "bildstod-backup" + slug + "-" + date + ".json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("Säkerhetskopia sparad! 📤");
  } catch (err) {
    toast("Fel: " + err.message);
  }
});
$("importBtn").addEventListener("click", () => $("importFileInput").click());
$("importFileInput").addEventListener("change", function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async e => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.nodes || !Array.isArray(data.nodes)) { toast("Ogiltig fil ❌"); return; }
      const ok = await customConfirm("Återställ " + data.nodes.length + " kort till profilen ”" + currentProfile().name + "”? Detta ersätter alla nuvarande kort.", { title: "Återställ?", yes: "📥 Återställ" });
      if (!ok) return;
      for (const node of [...all]) await dbDel(node.id);
      all = [];
      const idMap = {};
      const sorted = [...data.nodes].sort((a, b) => (a.id || 0) - (b.id || 0));
      for (const src of sorted) {
        const node = {
          parentId: src.parentId, type: src.type, name: src.name,
          emoji: src.emoji || null, imageData: src.imageData || null, audioData: src.audioData || null,
          order: src.order ?? src.id ?? null, hidden: !!src.hidden,
          createdAt: src.createdAt || Date.now()
        };
        node.id = await dbAdd(node);
        idMap[src.id] = node.id;
        all.push(node);
      }
      for (const node of all) {
        if (node.parentId != null && idMap[node.parentId] != null) {
          node.parentId = idMap[node.parentId];
          await dbPut(node);
        }
      }
      store.del(lockKey());
      nav = [];
      strip = [];
      renderStrip();
      render();
      closePinModal();
      toast("Återställt! ✅");
    } catch (err) {
      toast("Fel vid återställning: " + err.message);
    }
  };
  reader.readAsText(file);
  this.value = "";
});

// ── STARTKATEGORIER ──
const DEFAULTS = [
  { name: "Hemma", emoji: "🏠" }, { name: "Skola", emoji: "🏫" }, { name: "Humör", emoji: "😊" },
  { name: "Toalett", emoji: "🚽" }, { name: "Mat", emoji: "🍽️" }
];
async function seed() {
  if (all.some(n => (n.parentId ?? null) === null)) return;
  for (let i = 0; i < DEFAULTS.length; i++) {
    const node = {
      parentId: null, type: "folder", name: DEFAULTS[i].name, emoji: DEFAULTS[i].emoji,
      imageData: null, audioData: null, order: i + 1, createdAt: Date.now()
    };
    node.id = await dbAdd(node);
    all.push(node);
  }
}

// ── VAD ÄR NYTT ──
const APP_VERSION = "0.10";
const WHATS_NEW = [
  "🧩 Meningsremsa — bygg meningar av flera kort",
  "🔢 Välj 1–4 kort per rad",
  "↕️ Sortera korten genom att hålla in och dra",
  "👧 Flera profiler på samma enhet",
  "🗣️ Välj röst, hastighet och tonhöjd",
  "🙈 Dölj kort tillfälligt",
  "📦 Färdiga startpaket och symboler på bildkort",
  "📌 Skolläge — lås till en kategori",
  "🌓 Mörkt läge följer telefonens inställning"
];
function showWhatsNew() {
  if (store.get("bildstod_seen_version") === APP_VERSION) return;
  // Nya användare behöver ingen nyhetslista
  if (!store.get("bildstod_seen_version") && !store.get(PIN_KEY) && all.every(n => n.type === "folder" && !n.imageData)) {
    store.set("bildstod_seen_version", APP_VERSION);
    return;
  }
  $("wnVersion").textContent = "Version " + APP_VERSION;
  const list = $("wnList");
  list.innerHTML = "";
  WHATS_NEW.forEach(line => {
    const row = document.createElement("div");
    row.textContent = line;
    list.appendChild(row);
  });
  $("whatsNewOverlay").classList.add("open");
}
$("wnClose").addEventListener("click", () => {
  $("whatsNewOverlay").classList.remove("open");
  store.set("bildstod_seen_version", APP_VERSION);
});

// ── SERVICE WORKER OCH UPPDATERINGAR ──
function setupServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Visa bara bannern när en äldre version redan styrde sidan
    if (hadController) $("updateBar").hidden = false;
  });
  navigator.serviceWorker.register("sw.js").then(reg => {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") reg.update().catch(() => {});
    });
  }).catch(() => {});
  $("updateBtn").addEventListener("click", () => location.reload());
}

// ── START ──
async function init() {
  setupServiceWorker();
  try {
    await openDB();
    all = await dbAll();
    await seed();
  } catch (err) {
    all = [];
    console.warn("IndexedDB ej tillgänglig, kör utan lagring:", err);
  }
  applyFolderLock();
  renderStrip();
  render();
  showWhatsNew();
}
init();
