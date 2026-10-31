# AI コーディングエージェント向けの指示

このファイルは、このリポジトリで作業する AI コーディングエージェント
（Claude Code / Codex など）に向けたものです。人間の読者は README.md を参照してください。

## 最初に読むもの

リポジトリ共通の運用要領は `nakatama225/portfolio-meta` の `playbook.md` にあります。
作業前にそちらに従ってください。コードの書き方・コメントの分量・文章の書き方は
すべてそこに書いてあるので、このファイルでは繰り返しません。

## 検査

変更したら、変更した言語の検査を通してからコミットする。両方を変えたら両方。

```sh
# TypeScript（typescript/ で）
npm run verify

# Python（python/ で）
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
# 対応する最も古い版（3.11）でも通す。3.12 以降の構文が紛れ込むと、ここで止まる
uv run --isolated --python 3.11 pytest
```

TypeScript のテストで `// 言語をまたぐ固定値` の注釈に囲まれた表を書き換えたら、TypeScript だけを
変えたときも、Python の `uv run pytest` を通す。Python のテスト（`tests/lib/test_cross_language.py`）が
その表を読み、Python のテストの表と比べている。表を足したら、そのテストの `TABLES` にも足す。

## このリポジトリ固有の約束

- **層の向きは `problems/` → `patterns/` → `lib/` の一方だけ。逆は依存しない。**
  `lib/` は `patterns/` と `problems/` を読み込まない。`patterns/` は `lib/` を使ってよい
  （例：TypeScript の Command は `lib/` の二分探索を使う）。`problems/` はどちらも使ってよい。
  共通部品が特定の型や問題を知っている状態にしない。
  `lib/` の向きは機械で検査している。Python は `tests/test_layers.py` が構文木を読む。
  TypeScript は `eslint.config.js` が `src/lib/` に `no-restricted-imports` を当て、
  `tests/lint-lib-rules.test.ts` がその規則が違反を止めることを確認する。
  `patterns/` が `problems/` を読み込まないことは、`problems/` がまだ無いので検査していない。
  `problems/` を作るときに、この向きの検査も一緒に足す
- **`lib/` の部品は、同じ入力から、起動のたびに同じ結果を出す。乱数と時刻は引数で受け取る。**
  固定値の表を持つ部品（乱数・状態の要約・輪の上の位置）は、さらに環境と言語をまたいで同じ値を出す。
  起動のたびに同じ結果を出す約束を崩す書き方は、機械で止めている。Python は `tests/lib/test_determinism_guard.py` が
  `lib/` の下の構文木を読み、`random`・`secrets`・`uuid`・`time`・`datetime` の import と、
  組み込みの `hash`・`id` を止める。禁じる名前は、そのテストの一覧が正。名前を足すときは、
  その名前を使う違反の行も同じテストの表に足す（足さないと、一覧と表を照らすテストが止まる）。
  TypeScript は `eslint.config.js` が `src/lib/` に `Math.random`・`Date.now`・`Date`・`for...in` を
  止める規則を当て、`tests/lint-lib-rules.test.ts` がそれを確認する。`round` と三角関数などを
  禁じていない理由と、固定値の表を持つ部品で使わない計算は、README
  「決定性を崩す書き方の検査」にある
- **`lib/` にファイルを足したら、検査が読んだはずのファイルの一覧にも足す。**
  `tests/test_layers.py` と `tests/lib/test_determinism_guard.py` の既知のファイル、
  `tests/lint-lib-rules.test.ts` の実在するファイル（2つの一覧）。探す場所を誤ったまま何も読まずに
  通ることを、この一覧で防いでいる。`tests/lint-lib-rules.test.ts` は、この一覧が伸びるので、
  リポジトリ全体の規則を見る `tests/lint-rules.test.ts` から分けてある
- **`tests/lint-rules.test.ts` と `tests/patterns/state.test.ts` の規則を外す注釈（`eslint-disable-next-line`）は消さない。**
  静的検査の規則が働いていることを、わざと置いた違反で確認している。注釈が何も外さなくなると
  静的検査が失敗する設定（`reportUnusedDisableDirectives`）なので、そこで失敗したら、
  注釈ではなく規則の設定のほうを疑う。注釈で分かるのは規則が外れたことだけなので、
  規則の強さ（エラー）と当たる範囲（`method-signature-style` は `src/`、`switch-exhaustiveness-check` は
  `src/` と `tests/`）は、`tests/lint-rules.test.ts` で確認している。
  Python のテストに置いた `type: ignore[...]` も同じ働きで、mypy の設定（`exhaustive-match` など）が
  外れると、使われていない注釈として mypy が失敗する。これは strict に含まれる `warn_unused_ignores` に
  よる。strict を外すと、注釈が使われなくなっても mypy は止めず、それを見る検査は置いていない
- **同じ処理を2つ目の `problems/` で書いたら、`lib/` へ引き上げる。**
  3回待たない。2回目が共通化の合図
- **`patterns/` には抽象の定義だけを置く。** 具体的な問題の事情を入れない。
  入れたくなったら、それは `problems/` 側に属する
- **1つの型や共通部品を追加したら、両方の言語に置く。** 片方だけにしない。
  片方で不自然になる場合は、**不自然になったこと自体を README に書く**
  （それがこのリポジトリで示したいことなので、無理に揃えない）
- **Python に State・単位を型で分ける型・二分探索の部品が無いのは意図どおり。** 標準ライブラリで
  足りるので、言語を揃えるためだけに、`typing.assert_never`・`typing.NewType`・`bisect` を読み込んで
  出し直すだけのモジュールを作らない（README「置いてある共通部品」「言語で形が変わったところ」）
- **TypeScript に固定刻みの時間の待つ部品（`sleep_until`・`frames`）が無いのも意図どおり。**
  ブラウザでは描く時刻をブラウザが決め、型の設定（ES2022 だけ）には時計も待つ関数も無いので、
  言語を揃えるためだけに置かない（README「固定刻みの時間」）
- **部品を追加したら `tests/` に対応するテストを置く。** 空・1件・重複・境界値・
  異常値のうち、その部品に当てはまるものを通す

## 実際に使った例を書き足す

`patterns/` に置いた型を他のリポジトリで実際に使ったら、README の
「実際に使った例へのリンク」の表に行を足してください。抽象のまま置いてあるだけでは、
使える型なのかが読む人に伝わりません。
