(function () {
  "use strict";

  // Find the script tag that loaded this file
  var script =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      for (var i = scripts.length - 1; i >= 0; i--) {
        if (scripts[i].src && scripts[i].src.indexOf("widget.js") !== -1) {
          return scripts[i];
        }
      }
      return null;
    })();

  if (!script) return;

  var slug = script.getAttribute("data-slug");
  if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
    console.error("[Aivia widget] missing or invalid data-slug attribute");
    return;
  }

  var origin = script.getAttribute("data-origin") || "https://aiviaapp.co.uk";
  var color = script.getAttribute("data-color") || "#0F172A";
  var label = script.getAttribute("data-label") || "Book Now";
  var embedUrl = origin.replace(/\/+$/, "") + "/embed/" + encodeURIComponent(slug);

  if (window.__aiviaWidgetLoaded) return;
  window.__aiviaWidgetLoaded = true;

  // Inject styles
  var style = document.createElement("style");
  style.textContent =
    "#aivia-widget-btn{position:fixed;bottom:20px;right:20px;z-index:2147483646;background:" +
    color +
    ";color:#fff;border:none;border-radius:9999px;padding:14px 22px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:15px;font-weight:600;cursor:pointer;box-shadow:0 10px 30px rgba(0,0,0,.25);transition:transform .15s ease,box-shadow .15s ease;display:inline-flex;align-items:center;gap:8px}" +
    "#aivia-widget-btn:hover{transform:translateY(-2px);box-shadow:0 14px 40px rgba(0,0,0,.3)}" +
    "#aivia-widget-overlay{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:0;backdrop-filter:blur(2px)}" +
    "#aivia-widget-overlay.open{display:flex}" +
    "#aivia-widget-frame-wrap{position:relative;width:100%;height:100%;max-width:560px;max-height:100%;background:#fff;border-radius:0;overflow:hidden;display:flex;flex-direction:column}" +
    "@media (min-width:640px){#aivia-widget-overlay{padding:24px}#aivia-widget-frame-wrap{max-height:92vh;border-radius:16px}}" +
    "#aivia-widget-close{position:absolute;top:10px;right:10px;z-index:2;width:36px;height:36px;border-radius:9999px;border:none;background:rgba(255,255,255,.95);color:#111;font-size:20px;line-height:1;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.15);display:flex;align-items:center;justify-content:center}" +
    "#aivia-widget-iframe{flex:1;width:100%;height:100%;border:0;background:#fff}";
  document.head.appendChild(style);

  // Button
  var btn = document.createElement("button");
  btn.id = "aivia-widget-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", label);
  btn.innerHTML =
    '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg><span>' +
    label +
    "</span>";

  // Overlay
  var overlay = document.createElement("div");
  overlay.id = "aivia-widget-overlay";
  overlay.innerHTML =
    '<div id="aivia-widget-frame-wrap">' +
    '<button id="aivia-widget-close" type="button" aria-label="Close">&times;</button>' +
    '<iframe id="aivia-widget-iframe" title="Booking" allow="payment *; clipboard-write"></iframe>' +
    "</div>";

  var iframe = overlay.querySelector("#aivia-widget-iframe");
  var closeBtn = overlay.querySelector("#aivia-widget-close");

  function open() {
    if (!iframe.src) iframe.src = embedUrl;
    overlay.classList.add("open");
    document.body.style.overflow = "hidden";
  }
  function close() {
    overlay.classList.remove("open");
    document.body.style.overflow = "";
  }

  btn.addEventListener("click", open);
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") close();
  });

  // Allow the embed page to request close via postMessage
  window.addEventListener("message", function (e) {
    if (!e.data || typeof e.data !== "object") return;
    if (e.data.type === "aivia:close") close();
  });

  function mount() {
    document.body.appendChild(btn);
    document.body.appendChild(overlay);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);
})();
