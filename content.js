console.log("LeetCode AI Mentor content script loaded");

// Inject the script regarding Monaco access
const script = document.createElement('script');
script.src = chrome.runtime.getURL('injected.js');
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// Listen for code updates from injected script
window.addEventListener("message", (event) => {
  if (event.source !== window) return;
  if (event.data.type && event.data.type === "LEETCODE_AI_CODE_UPDATE") {
    latestUserCode = event.data.code;
  }
});


let isSidebarOpen = false;
let latestUserCode = "";

/**
 * Waits for a React-loaded element to appear in the DOM.
 * Polls using querySelector with timeout. Safe for React re-renders.
 * @param {string} selector - CSS selector to poll
 * @param {Object} options - { timeoutMs: number, pollIntervalMs: number }
 * @returns {Promise<Element|null>} - The element when found, or null on timeout
 */
function waitForElement(selector, options = {}) {
  const { timeoutMs = 5000, pollIntervalMs = 200 } = options;

  return new Promise((resolve) => {
    const el = document.querySelector(selector);
    if (el) {
      resolve(el);
      return;
    }

    const start = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - start >= timeoutMs) {
        clearInterval(interval);
        resolve(null);
        return;
      }
      const found = document.querySelector(selector);
      if (found) {
        clearInterval(interval);
        resolve(found);
      }
    }, pollIntervalMs);
  });
}

/**
 * Reads the problem statement from the DOM.
 * Uses stable selectors; extracts plain text only (description + examples).
 * @returns {string} - Plain text problem statement, or empty string if not found
 */
function readProblemStatement() {
  const selectors = [
    '[data-track-load="description_content"]',
    '[data-track-load=\'description_content\']',
    '[data-track-key="lc:description"]',
  ];

  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el) {
      const text = (el.textContent || el.innerText || "").trim();
      return text || "";
    }
  }
  return "";
}

/**
 * Reads the user's code from the Monaco editor via DOM.
 * Accesses Monaco's internal API for full code (bypasses virtualization).
 * @returns {string} - Code as single string, or empty string if not found
 */
function readCodeEditor() {
  // Method 1: Use Monaco API (most reliable for full code)
  try {
    if (window.monaco && window.monaco.editor) {
      const editors = window.monaco.editor.getEditors();
      if (editors && editors.length > 0) {
        const code = editors[0].getValue();
        if (code) {
          console.log("🎯 Read from Monaco API:", code.length, "chars (FULL CODE)");
          return code;
        }
      }
    }
  } catch (e) {
    console.log("⚠️ Monaco API failed:", e.message);
  }

  // Method 1b: Use data from injected script if available
  if (latestUserCode && latestUserCode.length > 0) {
    // console.log("🎯 Using code from injected script:", latestUserCode.length, "chars");
    return latestUserCode;
  }


  // Method 2: Try editor-container as fallback
  const editorContainer = document.querySelector(".editor-container");
  if (editorContainer) {
    const allText = (editorContainer.innerText || editorContainer.textContent || "").trim();
    if (allText) {
      console.log("📝 Read from editor-container:", allText.length, "chars");
      return allText;
    }
  }

  // Method 3: Read only visible lines (virtualization limitation)
  const viewLines = document.querySelector(".view-lines");
  if (!viewLines) return "";

  const lineEls = viewLines.querySelectorAll(".view-line");
  if (!lineEls || lineEls.length === 0) {
    const fallback = (viewLines.innerText || viewLines.textContent || "").trim();
    console.log("⚠️ Using fallback text extraction:", fallback.length, "chars");
    return fallback || "";
  }

  console.log("⚠️ Read from individual lines:", lineEls.length, "visible lines (INCOMPLETE)");
  const lines = Array.from(lineEls).map((line) => {
    return (line.innerText || line.textContent || "").replace(/\u00a0/g, " ");
  });
  return lines.join("\n");
}

/**
 * Combines problem and code into a single context object.
 * @returns {{ problem: string, code: string }}
 */
function getContext() {
  return {
    problem: readProblemStatement(),
    code: readCodeEditor(),
  };
}

/**
 * Manual trigger: gathers context and logs to console.
 * Called when floating bot is clicked. No auto-polling, no background execution.
 */
function onBotClick() { }



const MENTOR_SYSTEM_INSTRUCTION = `You are a coding mentor for LeetCode. Give HINTS only—never full solutions.

RULES:
- NEVER write complete code solutions
- Give incremental hints: start small, add more if the user asks for another hint
- When pointing out errors or issues: use LINE NUMBERS and quote the specific code. Format: "Line X: \`code\` — [what's wrong / hint]"
- Help the user see exactly what to fix in their editor
- Use Socratic method: ask leading questions, suggest one step at a time
- Keep each hint brief (2–4 sentences)`;

let chatHistory = [];

async function fetchGeminiChat(apiKey, problem, code) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${apiKey}`;

  const contextBlock = `LeetCode Problem:
${problem}

---
User's Current Code (with line numbers—use these when pointing out issues):
${(code || "(empty)")
      .split("\n")
      .map((line, i) => `${i + 1}| ${line}`)
      .join("\n")}
---
`;

  const conversation =
    chatHistory
      .map((m) => (m.role === "user" ? `User: ${m.text}` : `Mentor: ${m.text}`))
      .join("\n\n") + "\n\nMentor (hint only, use line numbers when pointing out issues):";

  const prompt = `${MENTOR_SYSTEM_INSTRUCTION}\n\n${contextBlock}\n${conversation}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    }),
  });

  if (!res.ok) {
    // Handle specific HTTP errors
    if (res.status === 429) {
      // Quota exceeded
      addChatMessage("model", "⚠️ API request limit reached. Please try later.", { skipHistory: true });
    } else {
      // Other errors
      const errText = await res.text();
      console.error("Gemini API error details:", errText);
      addChatMessage("model", `⚠️ API error ${res.status}. Please try again.`, { skipHistory: true });
    }
    return null;
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No text in Gemini response");
  return text.trim();
}

function addChatMessage(role, text, opts = {}) {
  if (!opts.skipHistory) chatHistory.push({ role, text });
  const container = document.getElementById("ai-chat-messages");
  if (!container) return;

  const msg = document.createElement("div");
  msg.className = `ai-msg ai-msg-${role}`;
  msg.style.cssText =
    role === "user"
      ? "align-self:flex-end; max-width:85%; padding:8px 12px; background:#1e3a5f; border-radius:12px 12px 4px 12px; font-size:13px; margin-bottom:8px;"
      : "align-self:flex-start; max-width:90%; padding:10px 12px; background:#1e293b; border-radius:12px 12px 12px 4px; font-size:13px; line-height:1.5; margin-bottom:8px; white-space:pre-wrap; word-break:break-word;";
  msg.textContent = text;
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

function clearChatUI() {
  chatHistory = [];
  const container = document.getElementById("ai-chat-messages");
  if (!container) return;
  container.innerHTML = "";
  const welcome = document.createElement("div");
  welcome.className = "ai-msg ai-msg-model";
  welcome.style.cssText =
    "align-self:flex-start; padding:10px 12px; background:#1e293b; border-radius:12px 12px 12px 4px; font-size:13px; color:#94a3b8;";
  welcome.textContent = "👋 New problem! Ask a question or click Hint.";
  container.appendChild(welcome);
}

async function sendChatMessage(userText) {
  const input = document.getElementById("ai-chat-input");
  const sendBtn = document.getElementById("ai-send-btn");
  const hintBtn = document.getElementById("ai-hint-btn");
  if (!input || !sendBtn) return;

  const text = (userText || input.value?.trim()).trim();
  if (!text) return;

  const context = getContext();
  if (!context.problem?.trim()) {
    addChatMessage("model", "Could not read the problem. Are you on a problem page?", { skipHistory: true });
    return;
  }

  addChatMessage("user", text);
  input.value = "";
  sendBtn.disabled = true;
  if (hintBtn) hintBtn.disabled = true;

  try {
    const result = await chrome.storage.sync.get(["geminiKey"]);
    const apiKey = result?.geminiKey?.trim();
    if (!apiKey) {
      addChatMessage("model", "No API key. Add your Gemini key in the extension popup.", { skipHistory: true });
      return;
    }

    const code = readCodeEditor() || context.code || "(empty)";
    const reply = await fetchGeminiChat(apiKey, context.problem, code);
    addChatMessage("model", reply);
  } catch (err) {
    addChatMessage("model", `Error: ${err.message}`, { skipHistory: true });
  } finally {
    sendBtn.disabled = false;
    if (hintBtn) hintBtn.disabled = false;
  }
}

function onGetHintClick() {
  sendChatMessage("Give me a hint about what to do next.");
}

// ---------------------------------------------------------------------------
// Existing Extension Logic
// ---------------------------------------------------------------------------

chrome.storage.sync.get(["geminiKey"], (result) => {
  if (!result.geminiKey) {
    console.log("No Gemini API key found. Bot not activated.");
    return;
  }

  console.log("Gemini API key found. Activating bot...");
  activateBot();
});

function activateBot() {
  if (document.getElementById("leetcode-ai-bot")) return;

  const bot = document.createElement("div");
  bot.id = "leetcode-ai-bot";
  bot.innerText = "🤖";

  Object.assign(bot.style, {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    width: "52px",
    height: "52px",
    borderRadius: "50%",
    background: "#111",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "26px",
    cursor: "pointer",
    zIndex: "99999",
    boxShadow: "0 4px 10px rgba(0,0,0,0.3)",
  });

  bot.addEventListener("click", () => {
    onBotClick();
    toggleSidebar();
  });

  document.body.appendChild(bot);
  createSidebar();
}

function createSidebar() {
  if (document.getElementById("leetcode-ai-sidebar")) return;

  const sidebar = document.createElement("div");
  sidebar.id = "leetcode-ai-sidebar";

  Object.assign(sidebar.style, {
    position: "fixed",
    top: "0",
    right: "0",
    width: "360px",
    height: "100vh",
    background: "#0f172a",
    color: "#e5e7eb",
    transform: "translateX(100%)",
    transition: "transform 0.3s ease",
    zIndex: "99998",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, sans-serif",
  });

  const header = document.createElement("div");
  header.innerHTML = `
    <span>LeetCode AI Mentor</span>
    <button id="ai-close-btn">✕</button>
  `;

  Object.assign(header.style, {
    padding: "12px 16px",
    background: "#020617",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontWeight: "600",
    borderBottom: "1px solid #1e293b",
  });

  header.querySelector("#ai-close-btn").onclick = toggleSidebar;
  header.querySelector("#ai-close-btn").style.background = "transparent";
  header.querySelector("#ai-close-btn").style.color = "#e5e7eb";
  header.querySelector("#ai-close-btn").style.border = "none";
  header.querySelector("#ai-close-btn").style.cursor = "pointer";

  const body = document.createElement("div");
  body.id = "ai-sidebar-body";
  body.style.cssText =
    "flex:1; display:flex; flex-direction:column; min-height:0; padding:0;";

  const messagesContainer = document.createElement("div");
  messagesContainer.id = "ai-chat-messages";
  messagesContainer.style.cssText =
    "flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:4px;";

  const welcome = document.createElement("div");
  welcome.className = "ai-msg ai-msg-model";
  welcome.style.cssText =
    "align-self:flex-start; padding:10px 12px; background:#1e293b; border-radius:12px 12px 12px 4px; font-size:13px; color:#94a3b8;";
  welcome.textContent = "👋 Hi! I'll help with hints. Ask a question or click Get Hint.";
  messagesContainer.appendChild(welcome);

  const inputRow = document.createElement("div");
  inputRow.style.cssText =
    "padding:12px 16px; border-top:1px solid #1e293b; display:flex; gap:8px; align-items:center; flex-shrink:0;";

  const input = document.createElement("input");
  input.id = "ai-chat-input";
  input.placeholder = "Ask your question here...";
  input.type = "text";
  input.style.cssText =
    "flex:1; padding:10px 12px; background:#1e293b; border:1px solid #334155; border-radius:8px; color:#e5e7eb; font-size:14px; outline:none;";
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
  });

  const sendBtn = document.createElement("button");
  sendBtn.id = "ai-send-btn";
  sendBtn.textContent = "Send";
  sendBtn.style.cssText =
    "padding:10px 16px; background:#3b82f6; color:#fff; border:none; border-radius:8px; cursor:pointer; font-weight:600; font-size:14px;";

  const hintBtn = document.createElement("button");
  hintBtn.id = "ai-hint-btn";
  hintBtn.textContent = "Hint";
  hintBtn.style.cssText =
    "padding:10px 14px; background:#475569; color:#fff; border:none; border-radius:8px; cursor:pointer; font-size:14px;";

  inputRow.appendChild(input);
  inputRow.appendChild(sendBtn);
  inputRow.appendChild(hintBtn);
  body.appendChild(messagesContainer);
  body.appendChild(inputRow);
  sidebar.appendChild(header);
  sidebar.appendChild(body);
  document.body.appendChild(sidebar);

  sendBtn.addEventListener("click", () => sendChatMessage());
  hintBtn.addEventListener("click", onGetHintClick);
}

function toggleSidebar() {
  const sidebar = document.getElementById("leetcode-ai-sidebar");
  if (!sidebar) return;

  isSidebarOpen = !isSidebarOpen;
  sidebar.style.transform = isSidebarOpen
    ? "translateX(0)"
    : "translateX(100%)";
  // increase the height from bottom by 2 cm so that icon not overlap with sidebar
  sidebar.style.height = "calc(100vh - 2cm)";
}


function getProblemSlug(url) {
  const match = url.match(/\/problems\/([^/]+)/);
  return match ? match[1] : null;
}

let lastProblemSlug = getProblemSlug(location.href);

const pageObserver = new MutationObserver(() => {
  const currentSlug = getProblemSlug(location.href);

  // Only trigger if we are on a problem page and the slug has changed
  if (currentSlug && currentSlug !== lastProblemSlug) {
    lastProblemSlug = currentSlug;

    setTimeout(() => {
      onProblemChange();
    }, 800);
  }
});

pageObserver.observe(document.body, {
  childList: true,
  subtree: true,
});

function onProblemChange() {
  const context = getContext();
  latestUserCode = context.code;
  clearChatUI();
  observeEditorChanges();
}

// Detect editor changes (Monaco only)

let editorObserverInstance = null;
let editorDebounceTimer = null;

function observeEditorChanges() {
  const editor = document.querySelector(".view-lines");
  if (!editor) return;

  if (editorObserverInstance) {
    editorObserverInstance.disconnect();
  }

  editorObserverInstance = new MutationObserver(() => {
    // Debounce: wait 500ms after last change before logging
    if (editorDebounceTimer) clearTimeout(editorDebounceTimer);

    editorDebounceTimer = setTimeout(() => {
      const newCode = readCodeEditor();

      console.log("📊 Code length:", newCode.length, "chars");
      if (newCode && newCode !== latestUserCode) {
        latestUserCode = newCode;
      }
    }, 500);
  });

  editorObserverInstance.observe(editor, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

setTimeout(observeEditorChanges, 1500);