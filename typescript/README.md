# TypeScript 実装

**現在の状態（2026年10月）**：`src/patterns/` に設計の型が4つ、`src/lib/` に共通部品が2つ
（二分探索と決定的な擬似乱数）あります。`src/problems/` はまだありません。

```text
typescript/
  package.json
  tsconfig.json      型検査の設定。実行環境を選ばない部品だけなので、DOM と Node.js の型を入れていない
  eslint.config.js   静的検査の設定。src/lib/ が src/patterns/ と src/problems/ を読み込むことも止める
  vitest.config.ts   テストの設定
  src/
    lib/             共通部品
    patterns/        設計の型（抽象定義）。lib/ を使ってよい
  tests/             src と同じ構造
    lint-rules.test.ts  静的検査の設定が意図した所で働いていることの確認。src には対応しない
    lib/
      rng.test.ts              src/lib/rng.ts の乱数の本体（Rng）のテスト
      rng-derive-seed.test.ts  src/lib/rng.ts の種を導く関数（deriveSeed）のテスト
                               この2つの固定値の表は Python のテストも読む。書き換えたら
                               Python のテストも走らせる
```

置いてある型の一覧と、Python 版との違いは[リポジトリ全体の README](../README.md) にあります。

## 検査

```sh
npm ci
npm run verify   # 型検査 → 静的検査 → テスト
```
