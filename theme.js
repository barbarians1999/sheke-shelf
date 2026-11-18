(() => {
  const key = "sheke-theme:v1";
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const normalize = value => ["light", "dark"].includes(value) ? value : "system";
  let preference = "system";
  try { preference = normalize(localStorage.getItem(key)); } catch { /* Storage is optional. */ }

  function apply() {
    const dark = preference === "dark" || (preference === "system" && media.matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    document.documentElement.style.colorScheme = dark ? "dark" : "light";
    const toggle = document.querySelector("#theme-toggle");
    if (toggle) {
      toggle.textContent = dark ? "\u65e5\u95f4\u6a21\u5f0f" : "\u591c\u95f4\u6a21\u5f0f";
      toggle.setAttribute("aria-label", dark ? "\u5207\u6362\u65e5\u95f4\u6a21\u5f0f" : "\u5207\u6362\u591c\u95f4\u6a21\u5f0f");
      toggle.setAttribute("aria-pressed", String(dark));
    }
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.themeChoice === preference));
    });
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#191b1a" : "#eef0ec");
    window.dispatchEvent(new Event("sheke-theme-change"));
  }

  function select(value) {
    preference = normalize(value);
    try {
      if (preference === "system") localStorage.removeItem(key);
      else localStorage.setItem(key, preference);
    } catch { /* Keep the selection for this visit when storage is unavailable. */ }
    apply();
  }

  apply(); // Runs before CSS so a saved night preference never paints a light page first.
  document.addEventListener("DOMContentLoaded", () => {
    document.querySelector("#theme-toggle")?.addEventListener("click", () => {
      select(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });
    document.querySelectorAll("[data-theme-choice]").forEach(button => {
      button.addEventListener("click", () => select(button.dataset.themeChoice));
    });
    apply();
  });
  const onSystemChange = () => { if (preference === "system") apply(); };
  if (media.addEventListener) media.addEventListener("change", onSystemChange);
  else media.addListener(onSystemChange);
  window.addEventListener("storage", event => {
    if (event.key !== key && event.key !== null) return;
    try { if (event.storageArea !== localStorage) return; } catch { return; }
    preference = normalize(event.newValue);
    apply();
  });
})();
