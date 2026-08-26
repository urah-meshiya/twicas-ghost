window.TWICAS_GHOST_CONFIG = {
  workerUrl: "wss://twicas-ghost-worker.ponzu946.workers.dev/ws", // Cloudflare Workerをデプロイした後のURL（wss://から始まる）
  screenId: "urah_meshiya", // 監視したいツイキャス配信者のscreen_id（URLの twitcasting.tv/xxxxx の xxxxx 部分）
  bubbleDurationMs: 4500, // 吹き出しを表示しておく時間(ミリ秒)
  idleThresholdMs: 120000, // 120秒コメントが無いと独り言を言う
  enableFirstTimeGreeting: true, // 初見さん検知をON/OFF
};
