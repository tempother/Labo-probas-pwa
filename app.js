(() => {
  "use strict";

  function showMsg(txt) {
    let box = document.getElementById("test-debug-box");
    if (!box) {
      box = document.createElement("div");
      box.id = "test-debug-box";
      box.style.cssText =
        "position:fixed;bottom:12px;left:12px;right:12px;z-index:99999;background:#1e293b;color:#f8fafc;border:2px solid #38bdf8;border-radius:10px;padding:12px;font-size:14px;";
      document.body.appendChild(box);
    }
    box.textContent = txt;
  }

  document.addEventListener("DOMContentLoaded", () => {
    showMsg("Test prêt : appuie sur un bouton de la page.");

    document.querySelectorAll("button, [data-open-module]").forEach((el) => {
      el.addEventListener("click", () => {
        const label =
          el.dataset.openModule ||
          el.dataset.markovTab ||
          el.dataset.bayesTab ||
          el.id ||
          el.textContent.trim();
        showMsg("Clic détecté sur : " + label);
      });
    });
  });
})();
