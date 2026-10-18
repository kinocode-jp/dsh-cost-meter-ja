# dsh-cost-meter 日本語フォーク

このリポジトリは [Han-1413141/dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter)
（MIT）のフォークです。日本語UIを追加した以外は上流と同じです。

## 変更点

- `MESSAGES.ja` を追加（547キー）
- 統計・表示設定などの分割チャンク（452文字列）にも日本語表記を追加
  - 英語原文をキーにした対応表 `CHUNK_JA` を本体バンドルに持ち、チャンクの `text(zh, en)` が
    `document.documentElement.lang` を見て日本語を返す
- 言語選択に「日本語」を追加（自動・日本語・簡体中文・English）
- `lib/client.js` のサイズ上限を 393216 バイトへ変更（日本語表記の追加で 262144 を超えるため。
  DSHランタイム自体に上限はない。DSH STORE へ出す場合は分割が必要）

## 変えていないもの

- ピーク時間帯: UTC 01–04 / 06–10（北京 09–12 / 14–18）のまま
- 週末・祝日: 上流どおり北京時間・中国の祝日基準（DeepSeekの実際の課金と一致させるため）
- 料金計算・価格表・Coding Plan のロジック

## ビルド

```bash
pnpm install
node scripts/build.mjs
```

`test/verify.mjs` のホスト側バックフィル検査（`pro 独立拆分`）は上流由来で失敗する。
クライアントのバイト上限・辞書検査は通過する。

## ライセンス

上流と同じ MIT。`LICENSE` と `THIRD_PARTY_NOTICES.md` を保持している。
