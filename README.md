# algorithms-and-patterns

[![Project Status: WIP – Initial development is in progress, but there has not yet been a stable, usable release suitable for the public.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

アルゴリズムと設計パターンを、再利用できる部品として実装したものです。

**現在の状態（2026年9月）**：設計の型（`patterns/`）を1つ、TypeScript と Python の両方で
テストつきで置いています。共通部品（`lib/`）と具体的な解答（`problems/`）はまだありません。
次に置くのは、残りの設計の型（Strategy・Chain of Responsibility・State）です。

---

## Why — 問題ごとにファイルを分けない理由

競技プログラミングや面接対策の解答は、問題ごとに1ファイル置いて終わりにしがちです。
100 問解くと 100 個の独立したファイルが残りますが、そこから読み取れるのは
「100 問解いた」ことだけで、**何を学んだのかが残りません**。同じ二分木を
何度も書き直していても、それが分かる形になっていません。

このリポジトリは、問題を解く過程で書いた部品を共通化し、
繰り返し現れる解き方を「型」として取り出して置く場所です。

## Design Choice — 採用する構成と、その理由

### 1. 3層に分ける

```text
lib/       共通部品 — データ構造、計測や整形のユーティリティ
patterns/  設計の型 — 問題の種類ごとの解き方を抽象化した定義
problems/  具体的な解答 — lib と patterns を使って個々の問題を解く
```

`problems/` の中は解いた場所（LeetCode / AtCoder など）で分けますが、
**場所ごとにリポジトリを分けることはしません**。同じ二分木も同じ探索の型も、
場所をまたいで共有するものだからです。分けた瞬間に共通化ができなくなります。

### 2. 同じ型を2つの言語で実装する

```text
python/      pyproject.toml, src/algorithms_and_patterns/{lib,patterns,problems}, tests/
typescript/  package.json, src/{lib,patterns,problems}, tests/
```

言語をディレクトリの最上位に置くのは、ビルドと検査を言語ごとに完結させるためです。
`pyproject.toml` と `package.json` が根っこで混ざると、どちらの検査も通しにくくなります。

Python だけ `algorithms_and_patterns` という1つのパッケージの下に置いています。
`lib` や `patterns` のような一般的な名前を最上位に置くと、ほかにインストールした
パッケージと import の名前がぶつかるためです。

同じ設計の型を2つの言語で書くと、**その言語で自然な形が違う**ことが見えます。
片方で素直に書ける形が、もう片方では不自然になります。その差そのものが、
「設計の考え方」と「その言語での書き方」が別物であることの記録になります。
差は下の「言語で形が変わったところ」にまとめています。

### 3. すべての部品にテストを置く

`tests/` は `src/` と同じ構造にします。テストは、部品が正しく動くことの確認であると同時に、
**その部品が何を保証しているのかの記述**でもあります。エッジケース
（空、1件、重複、境界値、異常値）を通しておくと、読む人は仕様を読み取れます。

## 置いてある設計の型

| 型 | 何を解くか | TypeScript | Python |
|---|---|---|---|
| Command（命令を値として渡す） | 1歩ずつ進む処理と、「その歩で何をするか」を決める側を切り離す。記録と再生が、部品を1つ挟むだけで作れる | [command.ts](typescript/src/patterns/command.ts) | [command.py](python/src/algorithms_and_patterns/patterns/command.py) |

### 言語で形が変わったところ

#### Command

- 命令の出どころの型引数：Python の `Protocol` は、型引数が「受け取るだけ」か
  「返すだけ」かを宣言しないと、型検査（mypy）が定義そのものを受け付けません。
  TypeScript は使われ方から推し量るので宣言は要りませんが、**メソッドの形で書いた引数は
  向きを検査しません**。そのままだと、より多くを知っている状態を前提にした出どころを
  渡しても型エラーにならず、実行して初めて落ちます。TypeScript 版は関数を持つ項目の形で
  書き、検査させています（両方の言語に、渡せないことを確かめるテストがあります）
- 命令が同じかの判定：TypeScript は比べ方を引数で受けます（既定は `Object.is`。
  オブジェクトどうしなら「同じものか」を比べる）。Python は比べ方を命令のクラスの側
  （`__eq__`）が決めるので、引数を設けていません。dataclass は項目ごとに比べる `__eq__` を
  作ります。`__eq__` を持たない普通のクラスは「同じものか」で比べます
- 歩の番号の確かめ方：TypeScript の `number` は整数と小数を区別しないので、
  整数かどうかを実行時に確かめます。Python は `int` があるので、型検査に任せます
- 記録の探索：Python は標準ライブラリの `bisect` を使い、TypeScript は二分探索を手で書いています

## 実際に使った例へのリンク

ここに置いた型は、抽象のまま置いておくだけでは「使えるのか」が分かりません。
実際の作品で使ったものは、そこへのリンクを型のそばに書きます。

| 型 | TypeScript | Python |
|---|---|---|
| Command | [animal-bomber](https://github.com/nakatama225/animal-bomber) の操作の出どころ（[IntentSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/intent/IntentSource.ts)）と、操作の記録・再生（[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts)） | まだ無い（animal-bomber の [Python 版](https://github.com/nakatama225/animal-bomber/tree/main/py)は実装前） |

ここに置いた形は、使った先の形をそのまま写したものではありません。使ってみて分かった
直しを入れてあります。たとえば Command は、歩の番号を処理の側が数えて渡す形にしました。
animal-bomber では状態の中の時刻で代用していて、状態を作り直すと 0 に戻るため、
記録と再生の番号がずれうることが後から分かりました。

## How-to — 動かし方

TypeScript は Node.js（22 系の 22.13 以降、24 系、26 以降）、Python は 3.11 以降と
[uv](https://docs.astral.sh/uv/) が要ります。どちらもリポジトリの最上位から始めます。

TypeScript：型検査・静的検査・テスト

```sh
cd typescript
npm ci
npm run verify
```

Python：静的検査・書式・型検査・テスト

```sh
cd python
uv sync --frozen
uv run ruff check . && uv run ruff format --check . && uv run mypy && uv run pytest
```
