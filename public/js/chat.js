const chatWidget = {
  isOpen: false,
  webhookUrl: "https://n8n.zackdev.io/webhook/chat ",
  sessionId:
    localStorage.getItem("chat_session_id") ||
    "session-" + Math.random().toString(36).substr(2, 9),

  init: () => {
    if (!localStorage.getItem("chat_session_id")) {
      localStorage.setItem("chat_session_id", chatWidget.sessionId);
    }

    // Check login status for initial render
    const isLoggedIn = !!localStorage.getItem("token");

    // Render Chat UI
    // Added 'auth-only' class to integration with app.js auth system
    // Added style="display: ${isLoggedIn ? 'block' : 'none'}" to handle initial state race condition
    const chatHTML = `
            <div id="chat-widget" class="chat-widget auth-only ${
              isLoggedIn ? "" : "hidden"
            }">
                <button id="chat-toggle-btn" class="chat-toggle-btn" onclick="chatWidget.toggleChat()">
                    <i class="fa-solid fa-robot"></i>
                </button>
                <div id="chat-window" class="chat-window hidden">
                    <div class="chat-header">
                        <div class="chat-title">
                            <i class="fa-solid fa-robot"></i> AI Assistant
                        </div>
                        <button class="chat-close-btn" onclick="chatWidget.toggleChat()">
                            <i class="fa-solid fa-times"></i>
                        </button>
                    </div>
                    <div id="chat-body" class="chat-body">
                        <div class="message bot">
                            <div class="message-content">Hello! How can I help you today?</div>
                        </div>
                    </div>
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Type a message..." onkeypress="chatWidget.handleEnter(event)">
                        <button id="chat-send-btn" onclick="chatWidget.sendMessage()">
                            <i class="fa-solid fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    document.body.insertAdjacentHTML("beforeend", chatHTML);
  },

  toggleChat: () => {
    chatWidget.isOpen = !chatWidget.isOpen;
    const window = document.getElementById("chat-window");
    const btn = document.getElementById("chat-toggle-btn");

    if (chatWidget.isOpen) {
      window.classList.remove("hidden");
      btn.classList.add("active");
      // Focus input
      setTimeout(() => document.getElementById("chat-input").focus(), 100);
    } else {
      window.classList.add("hidden");
      btn.classList.remove("active");
    }
  },

  handleEnter: (e) => {
    if (e.key === "Enter") {
      chatWidget.sendMessage();
    }
  },

  appendMessage: (text, sender) => {
    const body = document.getElementById("chat-body");
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${sender}`;
    msgDiv.innerHTML = `<div class="message-content">${text}</div>`;
    body.appendChild(msgDiv);
    body.scrollTop = body.scrollHeight;
  },

  sendMessage: async () => {
    // Verify login first
    if (!localStorage.getItem("token")) {
      // Just in case the button is visible but token is gone
      alert("Please login to send a message.");
      return;
    }

    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    // User Message
    chatWidget.appendMessage(text, "user");
    input.value = "";

    // Check if Webhook URL is set
    if (!chatWidget.webhookUrl || chatWidget.webhookUrl === "") {
      chatWidget.appendMessage(
        "Please configure the n8n Webhook URL in public/js/chat.js",
        "bot"
      );
      return;
    }

    // Show typing indicator (optional, simple text for now)
    const loadingId = "chat-loading-" + Date.now();
    const body = document.getElementById("chat-body");
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "message bot typing";
    loadingDiv.id = loadingId;
    loadingDiv.innerHTML = `<div class="message-content"><i class="fa-solid fa-ellipsis fa-fade"></i></div>`;
    body.appendChild(loadingDiv);
    body.scrollTop = body.scrollHeight;

    try {
      const response = await fetch(chatWidget.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          sessionId: chatWidget.sessionId,
        }),
      });

      // Handle plain text response instead of JSON
      const responseText = await response.text();

      // Remove loading
      document.getElementById(loadingId).remove();

      // Bot Response - use the plain text response directly
      chatWidget.appendMessage(responseText, "bot");
    } catch (error) {
      document.getElementById(loadingId).remove();
      chatWidget.appendMessage(
        "Sorry, I couldn't connect to the server.",
        "bot"
      );
      console.error("Chat Error:", error);
      chatWidget.appendMessage(
        `Error: ${error.message || "Connection failed"}`,
        "bot"
      );
    }
  },
};

// Initialize after DOM load
document.addEventListener("DOMContentLoaded", chatWidget.init);
