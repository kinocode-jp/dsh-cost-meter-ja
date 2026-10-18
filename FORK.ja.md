# dsh-cost-meter 日本語フォーク

このリポジトリは [Han-1413141/dsh-cost-meter](https://github.com/Han-1413141/dsh-cost-meter)
（MIT）のフォークです。日本語UIを追加した以外は上流と同じです。

## 変更点

- `MESSAGES.ja` を追加（547キー、上流 v1.9.3 の英語辞書を日本語化）
- 言語解決を `ja` に対応
  - DSHの表示言語が `ja` のとき、プラグインUIも日本語になる（設定は「DSHに追従（自動）」のまま）
  - ブラウザ言語が `ja*` のときも日本語
  - 明示設定は従来どおり「中文 / English」を選べる
- `lib/client.js` のサイズ上限を 393216 バイトへ変更（日本語列の追加で 262144 を超えるため。
  DSHランタイム自体に上限はない。DSH STORE へ出す場合は分割が必要）

## ビルド

```bash
pnpm install
node scripts/build.mjs
```

`test/verify.mjs` のホスト側バックフィル検査（`pro 独立拆分`）は上流由来で失敗する。
クライアントのバイト上限・辞書検査は通過する。

## ライセンス

上流と同じ MIT。`LICENSE` と `THIRD_PARTY_NOTICES.md` を保持している。
