(() => {
  const cfg = window.TWICAS_GHOST_CONFIG;
  const rules = window.TWICAS_GHOST_RULES || [];
  const defaultRule = window.TWICAS_GHOST_DEFAULT || { mood: "idle", replies: [""] };

  const ghostEl = document.getElementById("ghost");
  const bubbleEl = document.getElementById("bubble");

  let hideTimer = null;

  function pickReaction(message) {
    const lower = message || "";
    for (const rule of rules) {
      if (rule.keywords.some((kw) => lower.includes(kw))) {
        return rule;
      }
    }
    return defaultRule;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function react(comment) {
    const rule = pickReaction(comment.message);
    const line = pickRandom(rule.replies);

    ghostEl.src = `ghosts/${rule.mood}.svg`;
    ghostEl.classList.add("reacting");

    bubbleEl.textContent = line;
    bubbleEl.classList.remove("hidden");
    // reflow を挟んでからvisibleを付けるとフェードが効く
    requestAnimationFrame(() => bubbleEl.classList.add("visible"));

    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      bubbleEl.classList.remove("visible");
      ghostEl.classList.remove("reacting");
      setTimeout(() => {
        bubbleEl.classList.add("hidden");
        ghostEl.src = "ghosts/idle.svg";
      }, 250);
    }, cfg.bubbleDurationMs);
  }

  function connect() {
    const url = `${cfg.workerUrl}?screen_id=${encodeURIComponent(cfg.screenId)}`;
    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      console.log("[twicas-ghost] connected");
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "comment") {
          react(data);
        } else if (data.type === "error") {
          console.warn("[twicas-ghost] server error:", data.message);
        }
      } catch (e) {
        console.error("[twicas-ghost] failed to parse message", e);
      }
    });

    ws.addEventListener("close", () => {
      console.log("[twicas-ghost] disconnected, retrying in 5s");
      setTimeout(connect, 5000);
    });

    ws.addEventListener("error", () => ws.close());
  }

  connect();
})();
