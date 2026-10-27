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

## このリポジトリ固有の約束

- **層の向きは `problems/` → `patterns/` → `lib/` の一方だけ。逆は依存しない。**
  `lib/` は `patterns/` と `problems/` を読み込まない。`patterns/` は `lib/` を使ってよい
  （例：TypeScript の Command は `lib/` の二分探索を使う）。`problems/` はどちらも使ってよい。
  共通部品が特定の型や問題を知っている状態にしない。
  `lib/` の向きは機械で検査している。Python は `tests/test_layers.py` が構文木を読む。
  TypeScript は `eslint.config.js` が `src/lib/` に `no-restricted-imports` を当て、
  `tests/lint-rules.test.ts` がその規則が違反を止めることを確認する。
  `patterns/` が `problems/` を読み込まないことは、`problems/` がまだ無いので検査していない。
  `problems/` を作るときに、この向きの検査も一緒に足す
- **`tests/lint-rules.test.ts` の規則を外す注釈（`eslint-disable-next-line`）は消さない。**
  静的検査の規則が働いていることを、わざと置いた違反で確認している。注釈が何も外さなくなると
  静的検査が失敗する設定（`reportUnusedDisableDirectives`）なので、そこで失敗したら、
  注釈ではなく規則の設定のほうを疑う。注釈で分かるのは規則が外れたことだけなので、
  規則の強さ（エラー）と当たる範囲（`src/`）は、同じファイルのテストで確認している
- **同じ処理を2つ目の `problems/` で書いたら、`lib/` へ引き上げる。**
  3回待たない。2回目が共通化の合図
- **`patterns/` には抽象の定義だけを置く。** 具体的な問題の事情を入れない。
  入れたくなったら、それは `problems/` 側に属する
- **1つの型や共通部品を追加したら、両方の言語に置く。** 片方だけにしない。
  片方で不自然になる場合は、**不自然になったこと自体を README に書く**
  （それがこのリポジトリで示したいことなので、無理に揃えない）
- **Python に State と二分探索の部品が無いのは意図どおり。** 標準ライブラリで足りるので、
  言語を揃えるためだけに、`typing.assert_never` や `bisect` を読み込んで出し直すだけの
  モジュールを作らない（README「置いてある共通部品」「言語で形が変わったところ」）
- **部品を追加したら `tests/` に対応するテストを置く。** 空・1件・重複・境界値・
  異常値のうち、その部品に当てはまるものを通す

## 実際に使った例を書き足す

`patterns/` に置いた型を他のリポジトリで実際に使ったら、README の
「実際に使った例へのリンク」の表に行を足してください。抽象のまま置いてあるだけでは、
使える型なのかが読む人に伝わりません。
