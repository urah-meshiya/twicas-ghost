# twicas-ghost

OBS配信に幽霊キャラを常駐させ、ツイキャスのコメントにキーワード反応して
吹き出しで喋らせるためのプロジェクトです。JSのみ、GitHub + Cloudflareで完結します。

```
twicas-ghost/
  worker/   … Cloudflare Worker（ツイキャスAPIをポーリングしてWebSocketで配信）
  site/     … OBSブラウザソースに読み込む静的ページ（幽霊キャラ本体）
```

## 1. ツイキャス開発者登録

1. https://ssl.twitcasting.tv/developer.php でアプリを登録
2. `ClientID` と `ClientSecret` を控える（コメント閲覧だけならユーザーOAuth連携は不要）

## 2. Cloudflare Workerのデプロイ

```bash
cd worker
npm install
npx wrangler login

# シークレットを登録（値を聞かれるので貼り付け）
npx wrangler secret put TWICAS_CLIENT_ID
npx wrangler secret put TWICAS_CLIENT_SECRET

npx wrangler deploy
```

デプロイ後に表示される `https://twicas-ghost-worker.xxxx.workers.dev` を控えておきます。

## 3. 静的ページ側の設定

`site/config.js` を編集します。

```js
window.TWICAS_GHOST_CONFIG = {
  workerUrl: "wss://twicas-ghost-worker.xxxx.workers.dev/ws", // ← 手順2のURL（https→wssに変える）
  screenId: "自分のツイキャスID",
  bubbleDurationMs: 4500,
};
```

反応ワードやセリフは `site/rules.js` で自由に編集できます。
キャラの絵は `site/ghosts/*.svg` を差し替えれば好きな見た目にできます
（idle / happy / surprised / angry の4状態）。

## 4. GitHub Pagesで公開

1. このリポジトリをGitHubにpush
2. リポジトリ設定 → Pages → ソースを `site/` フォルダに設定
3. 公開されたURL（例: `https://ユーザー名.github.io/twicas-ghost/site/`）をコピー

## 5. OBSに追加

1. OBSで「ブラウザ」ソースを追加
2. URLに手順4のGitHub PagesのURLを指定
3. 幅240 / 高さ260程度、「シーンの表示時にソースをシャットダウンしない」にチェック推奨
4. 背景を透過にするため「カスタムCSS」は空のままでOK（style.cssで既に透過設定済み）

配信を開始し、コメントすると数秒以内に幽霊が反応して吹き出しが出るはずです。

## 今後の拡張案

- `rules.js` にAI（LLM API）呼び出しを追加し、ルールに一致しないコメントだけ動的返信させる
- 吹き出しの代わりに音声合成(VOICEVOX等)を鳴らす場合は、Worker側で音声URLを生成して
  静的ページ側でAudio再生する形に拡張
- 見た目をLive2Dに差し替える場合は `ghosts/*.svg` の切り替え部分をLive2D SDKの
  パラメータ制御に置き換える
