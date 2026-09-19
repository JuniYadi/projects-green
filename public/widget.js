(function () {
  "use strict";

  // Prevent double loading
  if (window.__PFNAPP_WIDGET_LOADED__) return;
  window.__PFNAPP_WIDGET_LOADED__ = true;

  // 1. Locate current script and read dataset attributes
  var currentScript =
    document.currentScript ||
    (function () {
      var scripts = document.getElementsByTagName("script");
      return scripts[scripts.length - 1];
    })();

  var agentId =
    (currentScript && currentScript.getAttribute("data-agent-id")) || "";
  var primaryColor =
    (currentScript && currentScript.getAttribute("data-color")) || "#10B981";
  var position =
    (currentScript && currentScript.getAttribute("data-position")) ||
    "bottom-right";
  var apiUrl =
    (currentScript && currentScript.getAttribute("data-api-url")) ||
    "/api/ai/widget/stream";
  var welcomeMsg =
    (currentScript && currentScript.getAttribute("data-welcome-message")) ||
    "Halo! Ada yang bisa kami bantu?";
  var agentName =
    (currentScript && currentScript.getAttribute("data-agent-name")) ||
    "Asisten AI";

  if (!agentId) {
    console.warn("[pfnapp-widget] data-agent-id is required on widget script tag.");
    return;
  }

  // 2. LocalStorage for visitorId
  var visitorStorageKey = "pfnapp_widget_visitor_id_" + agentId;
  var visitorId = "";
  try {
    visitorId = localStorage.getItem(visitorStorageKey) || "";
    if (!visitorId) {
      visitorId =
        "vis_" +
        Math.random().toString(36).substring(2, 12) +
        "_" +
        Date.now().toString(36);
      localStorage.setItem(visitorStorageKey, visitorId);
    }
  } catch (e) {
    visitorId = "vis_" + Math.random().toString(36).substring(2, 12);
  }

  // 3. Create host container & attach Shadow Root
  var rootEl = document.createElement("div");
  rootEl.id = "pfnapp-chat-widget-root";
  document.body.appendChild(rootEl);

  var shadow = rootEl.attachShadow({ mode: "open" });

  var isLeft = position === "bottom-left";
  var posStyle = isLeft ? "left: 20px;" : "right: 20px;";

  var styles =
    "* { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }" +
    "#pfnapp-widget-container { position: fixed; bottom: 20px; " +
    posStyle +
    " z-index: 2147483647; font-size: 14px; }" +
    ".pfnapp-launcher-btn { width: 56px; height: 56px; border-radius: 50%; background-color: " +
    primaryColor +
    "; color: #ffffff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 14px rgba(0,0,0,0.18); transition: transform 0.2s ease, box-shadow 0.2s ease; outline: none; }" +
    ".pfnapp-launcher-btn:hover { transform: scale(1.05); box-shadow: 0 6px 20px rgba(0,0,0,0.24); }" +
    ".pfnapp-launcher-btn svg { width: 26px; height: 26px; fill: currentColor; }" +
    ".pfnapp-chat-window { position: absolute; bottom: 70px; " +
    (isLeft ? "left: 0;" : "right: 0;") +
    " width: 360px; max-width: calc(100vw - 32px); height: 520px; max-height: calc(100vh - 100px); background: #ffffff; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.15); display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(0,0,0,0.08); transform-origin: " +
    (isLeft ? "bottom left" : "bottom right") +
    "; transition: opacity 0.2s ease, transform 0.2s ease; }" +
    ".pfnapp-chat-window.hidden { opacity: 0; pointer-events: none; transform: scale(0.92); display: none; }" +
    ".pfnapp-header { background: " +
    primaryColor +
    "; color: #ffffff; padding: 14px 16px; display: flex; align-items: center; justify-content: space-between; font-weight: 600; }" +
    ".pfnapp-header-title { display: flex; align-items: center; gap: 8px; font-size: 15px; }" +
    ".pfnapp-status-dot { width: 8px; height: 8px; border-radius: 50%; background: #34D399; display: inline-block; }" +
    ".pfnapp-close-btn { background: transparent; border: none; color: #ffffff; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; border-radius: 4px; opacity: 0.85; transition: opacity 0.15s; }" +
    ".pfnapp-close-btn:hover { opacity: 1; }" +
    ".pfnapp-messages { flex: 1; overflow-y: auto; padding: 16px; display: flex; flex-direction: column; gap: 12px; background: #f9fafb; }" +
    ".pfnapp-msg { max-width: 82%; padding: 10px 14px; border-radius: 14px; font-size: 13.5px; line-height: 1.45; word-break: break-word; white-space: pre-wrap; }" +
    ".pfnapp-msg-user { align-self: flex-end; background: " +
    primaryColor +
    "; color: #ffffff; border-bottom-right-radius: 4px; }" +
    ".pfnapp-msg-assistant { align-self: flex-start; background: #ffffff; color: #1f2937; border-bottom-left-radius: 4px; border: 1px solid #e5e7eb; box-shadow: 0 1px 2px rgba(0,0,0,0.03); }" +
    ".pfnapp-msg-assistant code { background: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-size: 12px; font-family: monospace; }" +
    ".pfnapp-input-form { display: flex; align-items: center; padding: 10px 12px; background: #ffffff; border-top: 1px solid #f3f4f6; gap: 8px; }" +
    ".pfnapp-input { flex: 1; border: 1px solid #e5e7eb; border-radius: 20px; padding: 8px 14px; font-size: 13.5px; outline: none; transition: border-color 0.2s; }" +
    ".pfnapp-input:focus { border-color: " +
    primaryColor +
    "; }" +
    ".pfnapp-send-btn { width: 36px; height: 36px; border-radius: 50%; background: " +
    primaryColor +
    "; color: #ffffff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: opacity 0.2s; outline: none; }" +
    ".pfnapp-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }" +
    ".pfnapp-send-btn svg { width: 16px; height: 16px; fill: currentColor; }";

  var styleEl = document.createElement("style");
  styleEl.textContent = styles;
  shadow.appendChild(styleEl);

  var wrapper = document.createElement("div");
  wrapper.id = "pfnapp-widget-container";
  wrapper.innerHTML =
    '<div class="pfnapp-chat-window hidden" id="chat-win">' +
    '  <div class="pfnapp-header">' +
    '    <div class="pfnapp-header-title">' +
    '      <span class="pfnapp-status-dot"></span>' +
    '      <span>' +
    escapeHtml(agentName) +
    "</span>" +
    "    </div>" +
    '    <button class="pfnapp-close-btn" id="close-btn" aria-label="Tutup chat">' +
    '      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>' +
    "    </button>" +
    "  </div>" +
    '  <div class="pfnapp-messages" id="msgs-box"></div>' +
    '  <form class="pfnapp-input-form" id="chat-form">' +
    '    <input type="text" class="pfnapp-input" id="chat-input" placeholder="Tulis pesan..." autocomplete="off" />' +
    '    <button type="submit" class="pfnapp-send-btn" id="send-btn" aria-label="Kirim">' +
    '      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>' +
    "    </button>" +
    "  </form>" +
    "</div>" +
    '<button class="pfnapp-launcher-btn" id="launcher-btn" aria-label="Buka Chat">' +
    '  <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/></svg>' +
    "</button>";

  shadow.appendChild(wrapper);

  var launcherBtn = shadow.getElementById("launcher-btn");
  var chatWin = shadow.getElementById("chat-win");
  var closeBtn = shadow.getElementById("close-btn");
  var msgsBox = shadow.getElementById("msgs-box");
  var chatForm = shadow.getElementById("chat-form");
  var chatInput = shadow.getElementById("chat-input");
  var sendBtn = shadow.getElementById("send-btn");

  var isOpen = false;
  var isSending = false;

  function toggleChat() {
    isOpen = !isOpen;
    if (isOpen) {
      chatWin.classList.remove("hidden");
      chatInput.focus();
    } else {
      chatWin.classList.add("hidden");
    }
  }

  launcherBtn.addEventListener("click", toggleChat);
  closeBtn.addEventListener("click", toggleChat);

  // Render initial welcome message
  if (welcomeMsg) {
    appendMessage("assistant", welcomeMsg);
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function appendMessage(role, text) {
    var msgEl = document.createElement("div");
    msgEl.className = "pfnapp-msg pfnapp-msg-" + role;
    msgEl.textContent = text;
    msgsBox.appendChild(msgEl);
    msgsBox.scrollTop = msgsBox.scrollHeight;
    return msgEl;
  }

  chatForm.addEventListener("submit", async function (e) {
    e.preventDefault();
    var text = (chatInput.value || "").trim();
    if (!text || isSending) return;

    chatInput.value = "";
    appendMessage("user", text);

    isSending = true;
    sendBtn.disabled = true;

    var assistantMsgEl = appendMessage("assistant", "...");
    var accumulatedText = "";

    try {
      var response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-origin": window.location.origin,
        },
        body: JSON.stringify({
          agentId: agentId,
          message: text,
          visitorId: visitorId,
        }),
      });

      if (!response.ok) {
        var errBody;
        try {
          errBody = await response.json();
        } catch (ignored) {}
        assistantMsgEl.textContent =
          (errBody && errBody.message) ||
          "Maaf, terjadi kesalahan saat menghubungi asisten AI.";
        return;
      }

      if (!response.body) {
        assistantMsgEl.textContent = "Tidak ada respon dari server.";
        return;
      }

      var reader = response.body.getReader();
      var decoder = new TextDecoder();
      var buffer = "";

      while (true) {
        var result = await reader.read();
        if (result.done) break;

        buffer += decoder.decode(result.value, { stream: true });
        var lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (line.indexOf("data: ") === 0) {
            var dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") {
              break;
            }
            try {
              var parsed = JSON.parse(dataStr);
              if (parsed.chunk) {
                accumulatedText += parsed.chunk;
                assistantMsgEl.textContent = accumulatedText;
                msgsBox.scrollTop = msgsBox.scrollHeight;
              } else if (parsed.error) {
                assistantMsgEl.textContent =
                  "Error: " + parsed.error;
              }
            } catch (jsonErr) {
              // Ignore partial JSON
            }
          }
        }
      }
    } catch (networkErr) {
      assistantMsgEl.textContent =
        "Koneksi terputus. Silakan coba beberapa saat lagi.";
    } finally {
      isSending = false;
      sendBtn.disabled = false;
      chatInput.focus();
    }
  });
})();
