// Opens the hosted app when it is reachable; otherwise explains and offers a retry. The window has no native access
// (see src-tauri/capabilities), so the hosted site is treated like any other website.
const SITE = "https://kkingg-ai.vercel.app";
const status = document.getElementById("status");
const retry = document.getElementById("retry");

async function connect() {
  retry.hidden = true;
  status.textContent = "Connecting…";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(SITE, { mode: "no-cors", cache: "no-store", signal: ctrl.signal });
    clearTimeout(timer);
    window.location.replace(SITE);
  } catch {
    status.textContent = "Cannot reach KKINGG AI. Check your internet connection.";
    retry.hidden = false;
  }
}

retry.addEventListener("click", connect);
connect();
