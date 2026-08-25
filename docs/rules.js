// コメントに含まれるキーワードごとの反応ルール。
// 上から順に判定され、最初にマッチしたものが採用されます。
// mood は ghosts/ フォルダ内のファイル名(拡張子なし)に対応します。
window.TWICAS_GHOST_RULES = [
  {
    keywords: ["こんにちは", "こんばんは", "はじめまして", "きたよ", "来たよ"],
    mood: "happy",
    replies: ["いらっしゃーい！", "きたきた〜！", "よく来たね〜"],
  },
  {
    keywords: ["www", "笑", "草", "ワロタ"],
    mood: "happy",
    replies: ["ウケる〜！", "ふふっ、それな"],
  },
  {
    keywords: ["かわいい", "可愛い", "すき", "好き"],
    mood: "happy",
    replies: ["えへへ、照れるなあ"],
  },
  {
    keywords: ["おわり", "終わり", "また今度", "乙", "おつ"],
    mood: "surprised",
    replies: ["え、もう!? また来てね〜"],
  },
  {
    keywords: ["こわい", "怖い", "え？", "びっくり"],
    mood: "surprised",
    replies: ["うわっ、びっくりした〜"],
  },
  {
    keywords: ["ばか", "うざい", "きえろ", "死ね", "しね"],
    mood: "angry",
    replies: ["ちょっとぉ、それはひどいよ…"],
  },
];

// どのルールにもマッチしなかったときのデフォルト反応
window.TWICAS_GHOST_DEFAULT = {
  mood: "idle",
  replies: ["ふむふむ", "なるほどね〜", "ん？"],
};
