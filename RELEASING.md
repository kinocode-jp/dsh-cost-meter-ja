# 公開手順（kinocode-jp フォーク）

`@kinocode/dsh-cost-meter-ja` を npm に公開するときの決まりと手順。`AGENTS.md` の npm の節は上流（smallsun 氏の `dsh-cost-meter`）の手順で、このフォークでは使わない。

## 公開の名義（決まり）

- `@kinocode/dsh-cost-meter-ja` は、GitHub の組織 **kinocode-jp** の公開リポジトリ `kinocode-jp/dsh-cost-meter-ja` から、GitHub Actions の「Publish to npm」（`.github/workflows/publish.yml`）で公開する。npm の Trusted Publishing（OIDC）を使う。
- **個人の npm アカウントから `npm publish` しない。** 手元から公開すると、npm に公開者としてその個人アカウントの名前とメールアドレスが記録され、公開データに載る。Trusted Publishing なら、公開者は「GitHub Actions」と記録され、どのリポジトリのどのコミットから作ったか（provenance）が付く。npm のトークンも保存しない。
- npm の組織 `kinocode` は、ログインも公開もできない（公開するのは、組織に入っているユーザーか、登録したワークフロー）。
- コミットの作者は `kinocode <noreply@kinocode.jp>` にする。PR は GitHub の画面でマージしない（画面でマージすると、操作した人の個人の名前とメールが作者になる）。手元で fast-forward してから push する。

## 公開の手順

1. `package.json` の `version`を上げ、CHANGELOG があれば追記してコミットする（作者は kinocode）。
2. PR を作り、CI が通ったら手元で `main` に fast-forward して push する。
3. `node scripts/build.mjs` で `lib/` を作り直してコミットし、`npm pack --dry-run` で同梱物を確かめる（ワークフローはコミット済みの `lib/` をそのまま公開する）。
4. 版のタグを付けて push する。

   ```bash
   git tag v<version>
   git push origin v<version>
   ```

5. 「Publish to npm」が、タグと `package.json` の `version` が同じかを確かめてから公開する。違えば止まる。
6. 確かめる。

   ```bash
   npm view @kinocode/dsh-cost-meter-ja version
   npm view @kinocode/dsh-cost-meter-ja@<version> _npmUser   # GitHub Actions になっていること
   ```

## 最初に一度だけ: npm 側の設定（組織のオーナーがブラウザで行う）

1. npmjs.com でパッケージ `@kinocode/dsh-cost-meter-ja` の **Settings** を開き、**Trusted Publisher** で **GitHub Actions** を選んで、次を登録する。
   - Organization or user: `kinocode-jp`
   - Repository: `dsh-cost-meter-ja`
   - Workflow filename: `publish.yml`
2. 同じ画面の **Publishing access** で「Require two-factor authentication and disallow tokens」を選ぶ。トークンでの公開が止まり、ワークフローからの公開と、2 段階認証付きの手作業だけになる。
3. 個人アカウントを組織 `kinocode` から外すときは、組織のオーナーが少なくとも 1 人残るようにする。すでに公開した版の公開者の記録は、あとから変えられない。
