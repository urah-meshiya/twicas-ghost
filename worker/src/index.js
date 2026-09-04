export class TwicasWatcher {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.sessions = new Set();
    this.screenId = null;
  }

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

      const storedLive = await this.state.storage.get("live");
      if (typeof storedLive === "boolean") {
        server.send(JSON.stringify({ type: "status", live: storedLive }));
      }

      server.addEventListener("close", () => this.sessions.delete(server));
      server.addEventListener("error", () => this.sessions.delete(server));

      const alarm = await this.state.storage.getAlarm();
      if (alarm === null) {
        await this.state.storage.setAlarm(Date.now() + 1000);
      }

      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response("not found", { status: 404 });
  }

  async alarm() {
    if (this.sessions.size === 0) {
      // 誰も見ていない → ポーリングを停止(alarmを再セットしない)
      return;
    }

    try {
      const screenId = this.screenId || (await this.state.storage.get("screen_id"));
      if (!screenId) return;
      await this.state.storage.put("screen_id", screenId);

      const authHeader =
        "Basic " + btoa(`${this.env.TWICAS_CLIENT_ID}:${this.env.TWICAS_CLIENT_SECRET}`);
      const commonHeaders = {
        Authorization: authHeader,
        "X-Api-Version": "2.0",
      };

      const liveRes = await fetch(
        `https://apiv2.twitcasting.tv/users/${screenId}/current_live`,
        { headers: commonHeaders }
      );

      const prevLive = await this.state.storage.get("live");

      if (liveRes.status === 404) {
        if (prevLive !== false) {
          await this.state.storage.put("live", false);
          this.broadcast({ type: "status", live: false });
        }
        await this.state.storage.delete("movie_id");
        await this.state.storage.delete("slice_id");
      } else if (liveRes.ok) {
        if (prevLive !== true) {
          await this.state.storage.put("live", true);
          this.broadcast({ type: "status", live: true });
        }

        const liveData = await liveRes.json();
        const movieId = liveData.movie && liveData.movie.id;
        const prevMovieId = await this.state.storage.get("movie_id");

        if (movieId && movieId !== prevMovieId) {
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
      // sessionsが残っている場合のみ次のalarmをセット
      if (this.sessions.size > 0) {
        await this.state.storage.setAlarm(Date.now() + 5000);
      }
    }
  }
  
  async getSeenUsers() {
    const arr = await this.state.storage.get("seenUsers");
    return new Set(arr || []);
  }

  async saveSeenUsers(set) {
    await this.state.storage.put("seenUsers", [...set]);
  }

  async pollComments(movieId, commonHeaders) {
    const sliceId = await this.state.storage.get("slice_id");
    const params = new URLSearchParams({ limit: "20" });
    if (sliceId) params.set("slice_id", sliceId);

    const res = await fetch(
      `https://apiv2.twitcasting.tv/movies/${movieId}/comments?${params.toString()}`,
      { headers: commonHeaders }
    );
    if (!res.ok) return;

    const data = await res.json();
    const comments = (data.comments || []).slice().reverse();
    if (comments.length === 0) return;

    const seenUsers = await this.getSeenUsers();
    let changed = false;

    for (const c of comments) {
      // 表示名(name)は変更されうるので、識別にはscreen_idを優先
      const userKey = c.from_user ? (c.from_user.screen_id || c.from_user.name) : null;
      const isFirstTime = !!userKey && !seenUsers.has(userKey);

      if (isFirstTime) {
        seenUsers.add(userKey);
        changed = true;
      }

      this.broadcast({
        type: "comment",
        id: c.id,
        from: c.from_user ? c.from_user.name || c.from_user.screen_id : "名無し",
        message: c.message,
        createdAt: c.created,
        isFirstTime,
      });
    }

    if (changed) await this.saveSeenUsers(seenUsers);

    const lastId = comments[comments.length - 1].id;
    await this.state.storage.put("slice_id", lastId);
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