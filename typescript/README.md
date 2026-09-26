# TypeScript 実装

**現在の状態（2026年9月）**：`src/patterns/` に設計の型が3つあります。
`src/lib/` と `src/problems/` はまだありません。

```text
typescript/
  package.json
  tsconfig.json      型検査の設定。実行環境を選ばない部品だけなので、DOM と Node.js の型を入れていない
  eslint.config.js   静的検査の設定
  vitest.config.ts   テストの設定
  src/
    patterns/        設計の型（抽象定義）
  tests/             src と同じ構造
```

置いてある型の一覧と、Python 版との違いは[リポジトリ全体の README](../README.md) にあります。

## 検査

```sh
npm ci
npm run verify   # 型検査 → 静的検査 → テスト
```
