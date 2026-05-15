import { initChat } from "./chat.js";

function initTheme() {
  const button = document.getElementById("theme-toggle");
  const stored = localStorage.getItem("quantbot-theme");
  if (stored === "dark") document.body.classList.add("dark");
  button.addEventListener("click", () => {
    document.body.classList.toggle("dark");
    localStorage.setItem("quantbot-theme", document.body.classList.contains("dark") ? "dark" : "light");
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

initTheme();
initResize();
initChat();
