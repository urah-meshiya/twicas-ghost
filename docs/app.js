(() => {
  const cfg = window.TWICAS_GHOST_CONFIG;
  const rules = window.TWICAS_GHOST_RULES || [];
  const defaultRule = window.TWICAS_GHOST_DEFAULT || { mood: "idle", replies: [""] };
  const firstTimeRule = window.TWICAS_GHOST_FIRST_TIME || defaultRule;
  const idleRule = window.TWICAS_GHOST_IDLE_LINES || defaultRule;

  const ghostEl = document.getElementById("ghost");
  const bubbleEl = document.getElementById("bubble");

  let hideTimer = null;
  let idleTimer = null;
  let lastLine = "";

  // 初見判定
  function react(comment) {
    resetIdleTimer();

    if (comment.isFirstTime && cfg.enableFirstTimeGreeting !== false) {
      show(firstTimeRule);
      return;
    }
    show(pickReaction(comment.message));
  }

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
    // 直前と同じセリフを避ける
    const candidates = arr.length > 1 ? arr.filter((line) => line !== lastLine) : arr;
    const line = candidates[Math.floor(Math.random() * candidates.length)];
    lastLine = line;
    return line;
  }

  function show(rule) {
    const line = pickRandom(rule.replies);

    ghostEl.src = `ghosts/${rule.mood}.svg`;
    ghostEl.classList.add("reacting");

    bubbleEl.textContent = line;
    bubbleEl.classList.remove("hidden");
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

  function resetIdleTimer() {
    clearTimeout(idleTimer);
    const threshold = cfg.idleThresholdMs || 90000;
    idleTimer = setTimeout(() => {
      show(idleRule);
      resetIdleTimer(); // 次のアイドル発言も予約
    }, threshold);
  }

  function react(comment) {
    resetIdleTimer();

    const isFirstTime = comment.from && !seenUsers.has(comment.from);
    if (isFirstTime && cfg.enableFirstTimeGreeting !== false) {
      seenUsers.add(comment.from);
      saveSeenUsers();
      show(firstTimeRule);
      return;
    }
    if (comment.from) seenUsers.add(comment.from);

    show(pickReaction(comment.message));
  }

  function connect() {
    const url = `${cfg.workerUrl}?screen_id=${encodeURIComponent(cfg.screenId)}`;
    const ws = new WebSocket(url);

    ws.addEventListener("open", () => {
      console.log("[twicas-ghost] connected");
      resetIdleTimer();
    });

    ws.addEventListener("message", (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "comment") {
          react(data);
        } else if (data.type === "status") {
          const statusEl = document.getElementById("status");
          if (data.live) {
            statusEl.classList.add("hidden");
            resetIdleTimer();
          } else {
            statusEl.classList.remove("hidden");
            clearTimeout(idleTimer); // 配信外は独り言もしない
          }
        } else if (data.type === "error") {
          console.warn("[twicas-ghost] server error:", data.message);
        }
      } catch (e) {
        console.error("[twicas-ghost] failed to parse message", e);
      }
    });

    ws.addEventListener("close", () => {
      console.log("[twicas-ghost] disconnected, retrying in 5s");
      clearTimeout(idleTimer);
      setTimeout(connect, 5000);
    });

    ws.addEventListener("error", () => ws.close());
  }

  connect();
})();