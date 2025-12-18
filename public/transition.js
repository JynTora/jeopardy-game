// public/transition.js
(() => {
  const ENTER_KEY = "__jt_page_enter__";

  // 1) Enter-Animation beim Laden der Seite
  const shouldEnter = sessionStorage.getItem(ENTER_KEY) === "1";
  if (shouldEnter) {
    sessionStorage.removeItem(ENTER_KEY);
    document.documentElement.classList.add("page-enter");
    // im nächsten Frame aktivieren, damit Transition sicher triggert
    requestAnimationFrame(() => {
      document.documentElement.classList.add("page-enter-active");
      // Cleanup nach Transition
      setTimeout(() => {
        document.documentElement.classList.remove(
          "page-enter",
          "page-enter-active",
        );
      }, 450);
    });
  }

  // 2) Overlay anlegen (Exit-Animation)
  const overlay = document.createElement("div");
  overlay.className = "page-transition-overlay";
  document.body.appendChild(overlay);

  // Debug-Hinweis, damit du sofort siehst, ob das Script überhaupt läuft
  // (kannst du später entfernen)
  console.log("[transition.js] loaded");

  // 3) Klicks auf Links mit data-transition-link abfangen
  document.addEventListener("click", (e) => {
    const a = e.target.closest("a[data-transition-link]");
    if (!a) return;

    const href = a.getAttribute("href");
    if (!href) return;

    // neue Tabs / Modifier nicht anfassen
    if (a.target === "_blank") return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    // nur normale Navigation
    e.preventDefault();

    // Enter-Animation für die nächste Seite aktivieren
    sessionStorage.setItem(ENTER_KEY, "1");

    // Exit-Overlay animieren
    overlay.classList.add("is-active");

    // Kleine Verzögerung, damit man es sicher wahrnimmt
    setTimeout(() => {
      window.location.href = href;
    }, 220);
  });
})();
