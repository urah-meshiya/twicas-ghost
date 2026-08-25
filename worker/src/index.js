/**
 * twicas-ghost-worker
 *
 * OBSの幽霊キャラ(静的ページ)がWebSocketで接続してくると、
 * このWorker配下のDurable Objectが配信者ごとに1つ起動し、
 * ツイキャスAPIを定期ポーリングして新着コメントをpushする。
 *
 * 接続例: wss://your-worker.your-subdomain.workers.dev/ws?screen_id=配信者ID
 */

export class TwicasWatcher {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.screenId = null;
  }

  // WebSocket接続 or 内部からのfetchを受ける
  async fetch(request) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const screenId = url.searchParams.get("screen_id");
      if (!screenId) {
        return new Response("screen_id is required", { status: 400 });
      }
      this.screenId = screenId;

      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair);

      server.accept();
      this.sessions.add(server);

      server.addEventListener("close", () => this.sessions.delete(server));
      server.addEventListener("error", () => this.sessions.delete(server));

      // ポーリングループがまだ動いていなければ起動する
      const alarm = await this.state.storage.getAlarm();
      if (alarm === null) {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  // Durable ObjectのAlarm: 数秒おきに自分を起こしてAPIを叩く
  async alarm() {
    try {
      // 接続者がいなければポーリングを止めて待機（無駄なAPIコール削減）
      if (this.sessions.size === 0) {
        return; // 次にWebSocket接続が来たときに再度Alarmがセットされる
      }

      const screenId = this.screenId || (await this.state.storage.get("screen_id"));
      if (!screenId) return;
      await this.state.storage.put("screen_id", screenId);

      const authHeader =
        "Basic " + btoa(`${this.env.TWICAS_CLIENT_ID}:${this.env.TWICAS_CLIENT_SECRET}`);
      const commonHeaders = {
        Authorization: authHeader,
        "X-Api-Version": "2.0",
      };

      // 1. 配信中かどうか & movie_idを取得
      const liveRes = await fetch(
        `https://apiv2.twitcasting.tv/users/${screenId}/current_live`,
        { headers: commonHeaders }
      );

      if (liveRes.status === 404) {
        // 配信していない
        await this.state.storage.delete("movie_id");
        await this.state.storage.delete("slice_id");
      } else if (liveRes.ok) {
        const liveData = await liveRes.json();
        const movieId = liveData.movie && liveData.movie.id;
        const prevMovieId = await this.state.storage.get("movie_id");

        if (movieId && movieId !== prevMovieId) {
          // 新しい配信が始まった → コメント取得位置をリセット
          await this.state.storage.put("movie_id", movieId);
          await this.state.storage.delete("slice_id");
        }

        if (movieId) {
          await this.pollComments(movieId, commonHeaders);
        }
      }
    } catch (err) {
      this.broadcast({ type: "error", message: String(err) });
    } finally {
      // 次のポーリングを予約（5秒間隔。必要に応じて調整可）
      await this.state.storage.setAlarm(Date.now() + 5000);
    }
  }

  async pollComments(movieId, commonHeaders) {
    const sliceId = await this.state.storage.get("slice_id");
    const params = new URLSearchParams({ limit: "20" }); // 26以上はAPI側の既知不具合で止まるので注意
    if (sliceId) params.set("slice_id", sliceId);

    const res = await fetch(
      `https://apiv2.twitcasting.tv/movies/${movieId}/comments?${params.toString()}`,
      { headers: commonHeaders }
    );
    if (!res.ok) return;

    const data = await res.json();
    const comments = (data.comments || []).slice().reverse(); // 新しい順→時系列順

    for (const c of comments) {
      this.broadcast({
        type: "comment",
        id: c.id,
        from: c.from_user ? c.from_user.name || c.from_user.screen_id : "名無し",
        message: c.message,
        createdAt: c.created,
      });
    }

    if (comments.length > 0) {
      const lastId = comments[comments.length - 1].id;
      await this.state.storage.put("slice_id", lastId);
    }
  }

  broadcast(payload) {
    const msg = JSON.stringify(payload);
    for (const ws of this.sessions) {
      try {
        ws.send(msg);
      } catch (e) {
        this.sessions.delete(ws);
      }
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      const screenId = url.searchParams.get("screen_id");
      if (!screenId) {
        return new Response("screen_id query param is required", { status: 400 });
      }
      const id = env.WATCHER.idFromName(screenId);
      const stub = env.WATCHER.get(id);
      return stub.fetch(request);
    }

    return new Response(
      "twicas-ghost-worker is running. Connect via /ws?screen_id=XXXX",
      { status: 200 }
    );
  },
};
