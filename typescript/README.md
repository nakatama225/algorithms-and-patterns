# TypeScript 実装

**現在の状態（2026年10月）**：`src/patterns/` に設計の型が6つ、`src/lib/` に共通部品が10個
（二分探索と決定的な擬似乱数と状態の要約と固定刻みの時間と、`grid.ts` の格子と幅優先の最短経路と、
`cascade.ts` の連鎖の一括処理と最も早い時刻と、`strict-read.ts` と `decimal-text.ts` の外から来た値の読み取りと、
`sampling.ts` の毎回読む値の判定と、`ring.ts` の輪の上の位置）あります。固定刻みの時間の待つ部品
（締め切りまで眠る関数とフレームの輪）は、Python 版だけに置いています。`src/problems/` はまだありません。

```text
typescript/
  package.json
  tsconfig.json      型検査の設定。実行環境を選ばない部品だけなので、DOM と Node.js の型を入れていない
  eslint.config.js   静的検査の設定。src/lib/ では、src/patterns/ と src/problems/ を読み込むことと、
                     乱数と時刻を引数で受け取らずに使うこと（Math.random・Date）と for...in も止める。
                     src と tests の全部で、switch の種類の書き忘れも止める
  vitest.config.ts   テストの設定
  src/
    lib/             共通部品
    patterns/        設計の型（抽象定義）。lib/ を使ってよい
  tests/             src と同じ構造
    lint-rules.test.ts  静的検査の設定が意図した所で働いていることの確認。src には対応しない
    lib/
      rng.test.ts              src/lib/rng.ts の乱数の本体（Rng）のテスト
      rng-derive-seed.test.ts  src/lib/rng.ts の種を導く関数（deriveSeed）のテスト
      state-hash.test.ts       src/lib/state-hash.ts の状態の要約（StateHasher）のテスト
      ring.test.ts             src/lib/ring.ts の輪の上の位置（wrap・signedDelta）のテスト
                               この4つのファイルの固定値の表は Python のテストも読む。書き換えたら
                               Python のテストも走らせる
      fixed-step.test.ts       src/lib/fixed-step.ts の経過時間を刻みの数に換える部品（StepAccumulator）のテスト
      fixed-step-rate.test.ts  src/lib/fixed-step.ts の倍率の部品（RateScaler）のテスト
      grid.test.ts             src/lib/grid.ts の格子の入れ物（Grid）のテスト
      grid-path.test.ts        src/lib/grid.ts の幅優先の最短経路（findPath）の探し方のテスト
      grid-path-invalid.test.ts  src/lib/grid.ts の幅優先の最短経路（findPath）が止める値のテスト
      cascade.test.ts          src/lib/cascade.ts の一括処理（cascade）のたどり方のテスト
      cascade-earliest-times.test.ts  src/lib/cascade.ts の最も早い時刻（earliestTimes）のテスト
      cascade-invalid.test.ts  src/lib/cascade.ts の2つの関数が止める値のテスト
      fake-reaches.ts          上のテストが使う偽の届く関係。テストの補助で、src には対応しない
      strict-read.test.ts      src/lib/strict-read.ts の項目を1つ取り出す関数（readInt・readArray など）のテスト
      strict-read-json.test.ts  src/lib/strict-read.ts の JSON の文字列を読み込む関数（parseJsonObject）のテスト
      strict-read-choice.test.ts  src/lib/strict-read.ts の決めた文字列への読み替え（readChoice）のテスト
      error-head.ts            上のテストと decimal-text.test.ts が使う、止めた文の頭の比べ方。
                               テストの補助で、src には対応しない
      sampling.test.ts         src/lib/sampling.ts の2つのしきい値（Hysteresis）と大きいほうの軸（dominantAxis）のテスト
      sampling-press.test.ts   src/lib/sampling.ts の押し始め（EdgeDetector）と短い押し（PressLatch）のテスト。
                               sampling.test.ts から分けた
    patterns/
      command-arrival.test.ts  src/patterns/command.ts の届いた範囲を持つ記録（ArrivalLog）のテスト。
                               command.test.ts から分けた
      command-sources.test.ts  src/patterns/command-sources.ts の出どころを合わせる部品（CombinedSource）のテスト
      command-handover.test.ts  src/patterns/command-sources.ts の途中で替わる出どころ
                                （Handover・HandoverSource）のテスト。command-sources.test.ts から分けた
      command-handover-replay.test.ts  src/patterns/command-sources.ts の途中で替わる出どころを、届いた命令で
                                       進める側と保存したものを再生する側で比べるテスト。command-handover.test.ts から分けた
      state-traits.test.ts     State で、種類ごとの性質を1つの表にまとめる見本（Record と satisfies）。
                               state.test.ts から分けた
      phased-update-invalid.test.ts  src/patterns/phased-update.ts の二段の更新（advanceInPhases）が止める鍵と、
                                     呼ぶ側の関数の例外の伝え方と、後の処理の型が受け付けるもののテスト。
                                     phased-update.test.ts から分けた
```

置いてある型の一覧と、Python 版との違いは[リポジトリ全体の README](../README.md) にあります。

## 検査

```sh
npm ci
npm run verify   # 型検査 → 静的検査 → テスト
```
