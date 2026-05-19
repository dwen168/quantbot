import { initChat } from "./chat.js";
import { refreshTheme } from "./dashboard.js";

function initTheme() {
  const button = document.getElementById("theme-toggle");
  const stored = localStorage.getItem("quantbot-theme");
  
  if (stored === "light") {
    document.body.classList.add("light");
  } else {
    document.body.classList.remove("light");
  }

  button.addEventListener("click", () => {
    document.body.classList.toggle("light");
    const isLight = document.body.classList.contains("light");
    localStorage.setItem("quantbot-theme", isLight ? "light" : "dark");
    refreshTheme();
  });
}

function initResize() {
  const layout = document.getElementById("split-layout");
  const handle = document.getElementById("drag-handle");
  let dragging = false;
  handle.addEventListener("pointerdown", (event) => {
    dragging = true;
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointerup", () => {
    dragging = false;
  });
  handle.addEventListener("pointermove", (event) => {
    if (!dragging || window.innerWidth <= 900) return;
    const rect = layout.getBoundingClientRect();
    const pct = Math.min(58, Math.max(30, ((event.clientX - rect.left) / rect.width) * 100));
    layout.style.gridTemplateColumns = `minmax(320px, ${pct}%) 8px minmax(460px, 1fr)`;
  });
}

function initModal() {
  const openBtn = document.getElementById("how-it-works-btn");
  const closeBtn = document.getElementById("modal-close");
  const overlay = document.getElementById("modal-overlay");

  if (!openBtn || !closeBtn || !overlay) return;

  const toggle = (active) => {
    overlay.classList.toggle("active", active);
    document.body.style.overflow = active ? "hidden" : "";
  };

  openBtn.addEventListener("click", () => toggle(true));
  closeBtn.addEventListener("click", () => toggle(false));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) toggle(false);
  });
  
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && overlay.classList.contains("active")) toggle(false);
  });
}

initTheme();
initResize();
initModal();
initChat();
