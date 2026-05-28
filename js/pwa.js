/* AI Invoice PWA installer + service worker registration */
(() => {
  "use strict";

  const isSecure = window.isSecureContext || location.hostname === "localhost";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;

  if ("serviceWorker" in navigator && isSecure) {
    window.addEventListener("load", async () => {
      try {
        const registration = await navigator.serviceWorker.register("./service-worker.js", {
          scope: "./"
        });

        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          if (!worker) return;
          worker.addEventListener("statechange", () => {
            if (worker.state === "installed" && navigator.serviceWorker.controller) {
              showPwaNotice("AI Invoice update ready. Refresh to use the latest version.");
            }
          });
        });
      } catch (error) {
        console.warn("PWA service worker registration failed:", error);
      }
    });
  }

  let deferredPrompt = null;
  let installCard = null;

  window.addEventListener("beforeinstallprompt", (event) => {
    if (isStandalone) return;

    event.preventDefault();
    deferredPrompt = event;
    showInstallAsAppCard();
  });

  window.addEventListener("appinstalled", () => {
    hideInstallAsAppCard();
    deferredPrompt = null;
  });

  function showInstallAsAppCard() {
    if (installCard || isStandalone) return;

    installCard = document.createElement("div");
    installCard.id = "pwaInstallCard";
    installCard.setAttribute("role", "dialog");
    installCard.setAttribute("aria-label", "Install AI Invoice as app");
    installCard.innerHTML = `
      <button type="button" id="pwaInstallClose" class="pwa-install-close" aria-label="Close install notification">×</button>
      <div class="pwa-install-icon" aria-hidden="true"><span>AI</span></div>
      <div class="pwa-install-copy">
        <div class="pwa-install-title">Install AI app</div>
        <div class="pwa-install-text">Open AI Invoice faster with offline access on mobile, iPad, and laptop.</div>
      </div>
      <button type="button" id="pwaInstallAction" class="pwa-install-action">Install</button>
    `;

    installCard.style.cssText = `
      position: fixed;
      right: max(16px, env(safe-area-inset-right));
      bottom: max(16px, env(safe-area-inset-bottom));
      z-index: 9998;
      width: min(390px, calc(100vw - 32px));
      display: grid;
      grid-template-columns: 44px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 14px;
      padding-right: 42px;
      border: 1px solid rgba(125, 211, 252, .22);
      border-radius: 22px;
      background: linear-gradient(135deg, rgba(15, 23, 42, .96), rgba(30, 27, 75, .94));
      color: #fff;
      box-shadow: 0 24px 80px rgba(0,0,0,.46), 0 0 46px rgba(99,102,241,.20);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    `;

    const style = document.createElement("style");
    style.id = "pwaInstallCardStyle";
    style.textContent = `
      #pwaInstallCard::before {
        content: "";
        position: absolute;
        inset: 0;
        background:
          radial-gradient(circle at 18% 15%, rgba(34,211,238,.26), transparent 32%),
          radial-gradient(circle at 82% 0%, rgba(168,85,247,.30), transparent 36%);
        pointer-events: none;
      }
      #pwaInstallCard > * { position: relative; z-index: 1; }
      #pwaInstallCard .pwa-install-close {
        position: absolute;
        top: 8px;
        right: 10px;
        width: 24px;
        height: 24px;
        border: 0;
        border-radius: 999px;
        background: rgba(255,255,255,.08);
        color: rgba(255,255,255,.78);
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
      }
      #pwaInstallCard .pwa-install-icon {
        width: 44px;
        height: 44px;
        border-radius: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #06b6d4, var(--accent, #6366f1), #8b5cf6);
        color: #fff;
        font-size: 13px;
        font-weight: 900;
        letter-spacing: .04em;
        box-shadow: 0 10px 28px var(--accent-glow, rgba(99, 102, 241, .28)), 0 0 0 1px rgba(255,255,255,.18) inset;
        overflow: hidden;
      }
      #pwaInstallCard .pwa-install-icon::after {
        content: "";
        position: absolute;
        width: 54px;
        height: 54px;
        border: 1px solid rgba(255,255,255,.22);
        border-radius: 999px;
      }
      #pwaInstallCard .pwa-install-icon span {
        position: relative;
        z-index: 1;
      }
      #pwaInstallCard .pwa-install-title {
        font-size: 14px;
        font-weight: 800;
        line-height: 1.1;
        margin-bottom: 3px;
      }
      #pwaInstallCard .pwa-install-text {
        color: rgba(255,255,255,.72);
        font-size: 12px;
        line-height: 1.35;
      }
      #pwaInstallCard .pwa-install-action {
        border: 0;
        border-radius: 999px;
        padding: 10px 15px;
        background: linear-gradient(135deg, #ffffff, #cffafe);
        color: #111827;
        font-size: 12px;
        font-weight: 800;
        cursor: pointer;
        white-space: nowrap;
      }
      #pwaInstallCard .pwa-install-action:active,
      #pwaInstallCard .pwa-install-close:active {
        transform: scale(.96);
      }
      @media (max-width: 430px) {
        #pwaInstallCard {
          grid-template-columns: 40px 1fr;
        }
        #pwaInstallCard .pwa-install-action {
          grid-column: 1 / -1;
          width: 100%;
        }
      }
    `;

    if (!document.getElementById("pwaInstallCardStyle")) {
      document.head.appendChild(style);
    }

    document.body.appendChild(installCard);

    installCard.querySelector("#pwaInstallClose").addEventListener("click", hideInstallAsAppCard);
    installCard.querySelector("#pwaInstallAction").addEventListener("click", installPwa);
  }

  async function installPwa() {
    if (!deferredPrompt) return;

    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    hideInstallAsAppCard();

    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } catch (error) {
      console.warn("PWA install prompt failed:", error);
    }
  }

  function hideInstallAsAppCard() {
    if (!installCard) return;
    installCard.remove();
    installCard = null;
  }

  function showPwaNotice(message) {
    const notice = document.createElement("button");
    notice.type = "button";
    notice.textContent = message;
    notice.style.cssText = `
      position: fixed;
      right: max(16px, env(safe-area-inset-right));
      bottom: max(16px, env(safe-area-inset-bottom));
      z-index: 9998;
      max-width: min(360px, calc(100vw - 32px));
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 16px;
      padding: 12px 14px;
      background: rgba(15,23,42,.94);
      color: #fff;
      font: 600 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      box-shadow: 0 18px 60px rgba(0,0,0,.32);
      cursor: pointer;
    `;
    notice.addEventListener("click", () => location.reload());
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 9000);
  }
})();
