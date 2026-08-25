// ここを自分の環境に合わせて書き換えてください。
window.TWICAS_GHOST_CONFIG = {
  // Cloudflare Workerをデプロイした後のURL（wss://から始まる）
  workerUrl: "wss://twicas-ghost-worker.YOUR-SUBDOMAIN.workers.dev/ws",

  // 監視したいツイキャス配信者のscreen_id（URLの twitcasting.tv/xxxxx の xxxxx 部分）
  screenId: "your_screen_id",

  // 吹き出しを表示しておく時間(ミリ秒)
  bubbleDurationMs: 4500,
};
