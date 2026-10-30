# algorithms-and-patterns

[![状態：wip（作りかけ。安定して使える版はまだ無い）](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

アルゴリズムと設計パターンを、再利用できる部品として実装したものです。

**現在の状態（2026年10月）**：設計の型（`patterns/`）を5つ置いています。TypeScript は5つとも
部品とテストがあります。Python は3つに部品とテストがあり、残る State と単位を型で分ける型は
標準ライブラリで足りるので、書き方の見本をテストに置いています。共通部品（`lib/`）は置き始めたところで、
いまは二分探索（TypeScript だけ。Python は標準ライブラリの `bisect` で足ります）と、
決定的な擬似乱数と、状態の要約と、固定刻みの時間（待つ部品は Python だけ）と、格子と、
幅優先の最短経路と、連鎖の一括処理（最も早く発火する時刻を求める関数を含みます）と、外から来た値の
読み取り（10 進の整数を書いた文字列の読み取りを含みます）の8つです。
具体的な解答（`problems/`）はまだありません。次に足すのは、実際の作品（animal-bomber など）で
使った共通部品と、設計の型に足す部品です。

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
lib/       共通部品 — データ構造とアルゴリズム、計測や整形のユーティリティ
patterns/  設計の型 — 問題の種類ごとの解き方を抽象化した定義
problems/  具体的な解答 — lib と patterns を使って個々の問題を解く
```

`problems/` の中は解いた場所（LeetCode / AtCoder など）で分けますが、
**場所ごとにリポジトリを分けることはしません**。同じ二分木も同じ探索の型も、
場所をまたいで共有するものだからです。分けた瞬間に共通化ができなくなります。

層の向きは `problems/` → `patterns/` → `lib/` の一方だけです。`lib/` は `patterns/` と
`problems/` を読み込みません。共通部品が特定の型や問題を知っていると、その型や問題を
変えるたびに共通部品も変わり、使い回せなくなるためです。逆の向きはよく、たとえば
TypeScript の Command は `lib/` の二分探索を使っています。

この向きは機械で検査しています。Python はテスト（[test_layers.py](python/tests/test_layers.py)）が
`lib/` の下のファイルの構文木を読み、TypeScript は静的検査（ESLint）の規則
`no-restricted-imports` を `src/lib/` に当てています（[eslint.config.js](typescript/eslint.config.js)）。
検査を書いただけでは、書き誤っていても違反が無ければ通り続けるので、検査が違反を実際に
見つけることもテストで確認しています（TypeScript は [lint-rules.test.ts](typescript/tests/lint-rules.test.ts)）。
見ないものもあります。Python は `importlib` などに名前を文字列で渡して読み込むもの、
TypeScript は `import()` で読み込むものを見ません。

検査が違反を見つけることを確認する進め方は、animal-bomber の境界の検査
（[guards.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/boundary/guards.test.ts)、
[test_guards.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/boundary/test_guards.py)）から
持ってきました。ただし形を変えています。animal-bomber は違反を書いたファイルを `src/` の下に
書き出し、検査のコマンドを別のプロセスで動かします。そのため Python 版では、前回の結果を使う
検査（ruff・mypy・import-linter）に古い答えを返させない指定が要ります。また、どちらの版も
本物の `src/` に書くので、ほかのテストと並べて実行できません。
このリポジトリは、違反を文字列のまま検査に渡し、ディスクに書き出しません。
また animal-bomber は依存の向きに専用のパッケージ（TypeScript は
[dependency-cruiser](https://github.com/nakatama225/animal-bomber/blob/main/ts/.dependency-cruiser.cjs)、
Python は import-linter）を使っていますが、このリポジトリは使いません。向きが1本だけなので、
Python の標準ライブラリの `ast` と ESLint の組み込みの規則で足り、開発用の依存を増やさずに済むためです。

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
差は、設計の型は下の「言語で形が変わったところ」に、共通部品は「置いてある共通部品」の
部品ごとの節にまとめています。

乱数や状態の要約のように、2つの言語で1ビットも違わない値を約束する部品もあります。その値は、両方の
言語のテストに同じ固定値の表として置いています。ただし、片方の言語の実装と表だけを
書き換えても、その言語のテストは通ってしまいます。そこで Python のテスト
（[test_cross_language.py](python/tests/lib/test_cross_language.py)）が TypeScript のテストの
ファイルを文字列として読み、2つの表が等しいことを検証しています。比べるのは両方向で、
片方にだけある行も食い違いとして止めます。0.0 と -0.0 は `==` では等しいですが、別の値として
比べます。TypeScript の表は目印の注釈
（`// 言語をまたぐ固定値：<表の名前> ここから` と `ここまで`）で囲み、1行に1件で書きます。
囲みの注釈は配列の最初の行と最後の行に置き、そうなっていなければ止めます。囲みの外に置いた
行は、TypeScript のテストは使うのに、比べられないためです。書き方の崩れた行も読み飛ばさずに
止め、TypeScript のファイルが無いときも、飛ばさずに失敗させます。

この1か所だけは、上に書いた「検査を言語ごとに完結させる」から外れます。読む側を Python に
したのは、TypeScript の型検査の設定に Node.js の型を含めておらず（`types` が空）、テストから
ファイルを読む `node:fs` の型が無いためです。表を JSON のファイルに出して両方の言語から読む形は
選びませんでした。両方の言語の外にある共通の置き場に出すと、どちらの言語のテストも自分の外の
ファイルを読み、外れる所が2か所に増えます。どちらかの言語の置き場に出しても、期待値がテストの
そばから離れ、テストだけを読んでも何を検証しているかが分からなくなります。

読み方は、animal-bomber で通信の約束の表を2つの言語で突き合わせるテスト
（[test_protocol_sync.py](https://github.com/nakatama225/animal-bomber/blob/main/server/tests/test_protocol_sync.py) の
`ts_table`）から持ってきました。囲みを探し、中の行を1行ずつ書き方と照らし、合わない行で止まる形です。
animal-bomber の乱数と状態の要約のテスト（[test_rng.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_rng.py)、
[test_statehash.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_statehash.py)）は、
TypeScript 版が出した値を、Python 版のテストに1度貼っただけです。TypeScript 版のテストには
同じ値が無いので、TypeScript の実装を変えても、どのテストも止まりません。

### 3. すべての部品にテストを置く

`tests/` は `src/` と同じ構造にします。例外は4つで、Python の State と単位を型で分ける型は
部品が無いので、見本だけをテストに置いています。層の向き・決定性を崩す書き方・静的検査の設定を確認するテスト
（`test_layers.py`・`test_determinism_guard.py`・`lint-rules.test.ts`）と、2つの言語の固定値の表を突き合わせるテスト
（`test_cross_language.py`）と、テストが使う偽の物と補助（Python の偽の時計 `fake_time.py`、両方の言語の
偽の届く関係 `fake_reaches.py`・`fake-reaches.ts`、止めた文の頭を比べる `error_head.py`・`error-head.ts`）は、
`src/` のどのファイルにも対応しません。
反対に、乱数の部品（`rng`）はテストを2つのファイルに分けています。乱数を生成する本体と、
種を導く関数は変わる理由が違うためです（`rng.test.ts` と `rng-derive-seed.test.ts`、
Python は `test_rng.py` と `test_rng_derive_seed.py`）。固定刻みの時間（`fixed_step`）も、同じ理由で、
経過時間を刻みの数に換える部品と倍率の部品のテストを分けています（`fixed-step.test.ts` と
`fixed-step-rate.test.ts`、Python は `test_fixed_step.py` と `test_fixed_step_rate.py`）。Python は、
待つ部品のテストも `test_fixed_step_frames.py` に分けています。格子（`grid`）も、格子の入れ物と
幅優先の最短経路のテストを分けています（`grid.test.ts` と `grid-path.test.ts`、Python は
`test_grid.py` と `test_grid_path.py`）。探索は格子の入れ物を受けずに動き、変わる理由が違うためです。
探索のテストは、さらに、止める値（格子の外の出発点や負の歩数など）を `grid-path-invalid.test.ts`
（Python は `test_grid_path_invalid.py`）に分けています。受け取る値の約束は、探し方とは別の理由で変わります。
連鎖の一括処理（`cascade`）も、たどり方・最も早い時刻・止める値の3つにテストを分けています
（`cascade.test.ts`・`cascade-earliest-times.test.ts`・`cascade-invalid.test.ts`、Python は `test_cascade.py`・
`test_cascade_earliest_times.py`・`test_cascade_invalid.py`）。最も早い時刻は一括処理と同じたどり方を使いますが、
時刻の扱い（無限大や同じ時刻の順）は、たどり方とは別の理由で変わります。
外から来た値の読み取り（`strict-read`）も、項目の読み取り・JSON の読み込み・閉じた種類への読み替えの3つに
テストを分けています（`strict-read.test.ts`・`strict-read-json.test.ts`・`strict-read-choice.test.ts`、Python は
`test_strict_read.py`・`test_strict_read_json.py`・`test_strict_read_enum.py`。読み替えの関数の名前が、TypeScript は
`readChoice`、Python は `read_enum` です）。項目の型と範囲の約束、標準の JSON の読み込みが黙って読むものの断り方、
種類の決め方は、それぞれ別の理由で変わります。
設計の型では Command が、記録と再生のテストと、届いた範囲を持つ記録（`ArrivalLog`）のテストを
分けています（`command.test.ts` と `command-arrival.test.ts`、Python は `test_command.py` と
`test_command_arrival.py`）。順に1つずつ受け取ることと、届いていない歩を読ませないことの約束は、
記録の縮め方や再生の仕方とは別の理由で変わります。出どころを組み立てる部品（`command-sources.ts`、
Python は `command_sources.py`）も、合わせる部品のテストと、途中で替わる出どころのテストを分けています
（`command-sources.test.ts` と `command-handover.test.ts`、Python は `test_command_sources.py` と
`test_command_handover.py`）。全部の出どころに並びの順に聞く約束と、替わる歩の約束は、別の理由で変わります。
届いた命令で進める側と、保存したものを再生する側を比べるテストも、さらに分けています
（`command-handover-replay.test.ts`、Python は `test_command_handover_replay.py`）。2つの側を揃える使い方
（命令の記録と替わる歩を一緒に保存する）は、部品の約束とは別の理由で変わります。
State も、状態の表し方のテストと、種類ごとの性質の表の見本を分けています（`state.test.ts` と
`state-traits.test.ts`、Python は `test_state.py` と `test_state_traits.py`）。共通の処理が性質だけを見る
使い方は、状態の表し方の約束とは別の理由で変わります。
テストは、部品が正しく動くことの確認であると同時に、
**その部品が何を保証しているのかの記述**でもあります。エッジケース
（空、1件、重複、境界値、異常値）を通しておくと、読む人は仕様を読み取れます。

## 置いてある共通部品

| 部品 | 何をするか | TypeScript | Python |
|---|---|---|---|
| 二分探索 | 昇順に並んだ列で、値が入る位置を求める。同じ値が続くなら、その最初の位置（`bisectLeft`）か、最後の次の位置（`bisectRight`）を選べる | [bisect.ts](typescript/src/lib/bisect.ts) | 部品は無し（標準の `bisect`。3.10 から `key=`） |
| 決定的な擬似乱数 | 種を1つ与えれば、言語と版をまたいで同じ並びが出る。生成した回数を外から読め、元を進めずに先を試算する写しを作れる。種と番号から、用途ごとに分けた乱数の種を導ける | [rng.ts](typescript/src/lib/rng.ts) | [rng.py](python/src/algorithms_and_patterns/lib/rng.py) |
| 状態の要約 | 状態を、比べられる 32 ビットの数1つにまとめる。何をどの順で混ぜるかは呼ぶ側が決め、同じ値を同じ順で混ぜれば、起動・環境・言語をまたいで同じ要約になる | [state-hash.ts](typescript/src/lib/state-hash.ts) | [state_hash.py](python/src/algorithms_and_patterns/lib/state_hash.py) |
| 固定刻みの時間 | 揺れる実時間を、長さの決まった刻みを何回進めるかに換える。端数は持ち越し、遅れすぎた分は捨てる。倍率は、刻みの長さを変えずに、進める回数で表す | [fixed-step.ts](typescript/src/lib/fixed-step.ts)（待つ部品は無し） | [fixed_step.py](python/src/algorithms_and_patterns/lib/fixed_step.py) |
| 格子 | マス目を、左上から行ごとに並べた1本の配列で持つ。外を読むと、作るときに決めた値を返すので、通れないものを表す値にすれば、使う側は範囲を確認せずに読める。外へ書くと止める | [grid.ts](typescript/src/lib/grid.ts) の `Grid` | [grid.py](python/src/algorithms_and_patterns/lib/grid.py) の `Grid` |
| 幅優先の最短経路 | 重みの無い格子で、条件を満たす最初のマスまでの最短経路を求める。格子の入れ物を受けず、列と行の数と、通れるかを答える関数だけで動くので、探索だけでも使える。同じ長さの経路のどれを返すかは、隣を試す順で決まる | [grid.ts](typescript/src/lib/grid.ts) の `findPath` | [grid.py](python/src/algorithms_and_patterns/lib/grid.py) の `find_path` |
| 連鎖の一括処理と最も早い時刻 | 要素が発火すると届く相手も同じ時刻に発火するとき、連鎖が尽きるまでまとめてたどり、発火した要素を1度ずつ返す。発火が起きる前に、要素ごとの時刻から、それぞれが実際に発火する最も早い時刻も、同じ届く関係とたどり方で見積もる | [cascade.ts](typescript/src/lib/cascade.ts) | [cascade.py](python/src/algorithms_and_patterns/lib/cascade.py) |
| 外から来た値の読み取り | JSON や保存した文字列から、項目を型と範囲を見ながら取り出す。合わなければ既定値で埋めずに止め、止める文はどの項目かで始める | [strict-read.ts](typescript/src/lib/strict-read.ts)、[decimal-text.ts](typescript/src/lib/decimal-text.ts) | [strict_read.py](python/src/algorithms_and_patterns/lib/strict_read.py)、[decimal_text.py](python/src/algorithms_and_patterns/lib/decimal_text.py) |

`lib/` の部品は、同じ入力から、起動のたびに同じ結果を出します。固定値の表を持つ部品（乱数と
状態の要約）は、さらに環境と言語をまたいでも1ビットも違わない値を出します。前の約束を崩す書き方を
機械で止めていることと、後の約束を守るために使わない計算は、下の「決定性を崩す書き方の検査」に
書いています。

### 二分探索

二分探索は、同じものを2か所で手で書いていました。このリポジトリの Command の記録
（[command.ts](typescript/src/patterns/command.ts) の `at`）と、animal-bomber の操作の記録
（[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts) の `at`）です。
2か所目を共通化の合図と決めているので、`lib/` に引き上げ、Command はこれを使う形に
書き換えました（animal-bomber の側は、手で書いたままです）。答えは Python の `bisect_left`・
`bisect_right` と同じで、違うのは探す値が NaN のときに止まることだけです。Python は止まらずに、
先頭か末尾の位置を返します。中点は、手で書いていたときの `(low + high) >> 1` をやめ、割り算で
求めています。`>>` は値を 32 ビットの整数として読むので、和が 2**31 以上になると負になるためです。

### 決定的な擬似乱数

種を1つ決めれば、同じ並びを何度でも出せる乱数です。記録した入力から同じ結果を作り直す処理や、
2つの言語で同じ結果を出す処理に使います。アルゴリズムは mulberry32 で、状態は 32 ビットの整数1つです。

- 標準の乱数を使わない理由：TypeScript の `Math.random` は種を渡せません。Python の
  `random.Random` は種を渡せますが、Python の版をまたいで同じ並びが出ると約束しているのは
  `random()` だけで、`randrange`・`choice`・`shuffle` は版によって変わりえます（公式文書の再現性の節）
- 生成する回数：`random`・`below`・`between`・`chance`・`choice` は、1回呼ぶと乱数を必ず1回だけ
  生成します。`shuffled` は要素の数 - 1 回で、0 個と 1 個なら生成しません。`clone` と種を導く関数は
  生成しません。`chance(0)` と `chance(1)` も、答えが決まっていても1回生成します。生成する回数が引数や結果で
  変わると、同じ種でもそれ以降の並びが全部ずれるためです。生成した回数は `calls` で読めます。
  2つの実行の結果がずれたとき、生成した回数も比べると「どちらかが余計に生成した」まで絞れます
- 種から種を導く関数（`deriveSeed`・`derive_seed`）：用途ごとに乱数を分けるのに使います。
  1つの乱数を用途の違う処理で共有すると、片方が生成する回数を変えただけで、もう片方の並びも
  変わるためです。番号（`stream`）に 1 を足して奇数の 0x9E3779B1 を掛け、元の種との XOR を取ります。
  番号 0 から 2**32 - 2 までは、どれも互いに違い、元の種とも違う種になります。2**32 - 1 は
  元の種がそのまま返るので、止めます。導いた種どうしの並びに相関が無いかは測っていません
- 暗号用途には使えません。約束するのは、同じ種から同じ並びが出ることだけです。
  先を読まれないことは約束しません

言語で形が変わったところは3つです。

- 32 ビットの演算：TypeScript は `Math.imul`（掛け算の下位 32 ビット）と `>>> 0`
  （符号なしの 32 ビットに読み直す）で書きます。Python の整数は桁あふれしないので、足し算と
  掛け算のたびに `& 0xFFFFFFFF` で下位 32 ビットへ切り落とします。1か所でも忘れると並びがずれます
- 整数の引数の確認：TypeScript の `number` は整数と小数を区別しないので、種・上限・範囲の両端・
  番号が安全な整数（絶対値が 2**53 未満の整数）かを実行時に確認します。小数や NaN を `>>> 0` に通すと、
  黙って別の整数になるためです。2**53 以上の数は、受け取った時点ですでに丸められているかもしれないので、
  これも止めます。Python は `int` の型で受けるので、整数かどうかは型検査に任せます。種と範囲の両端は、
  Python ではどんな大きさの整数も受けます（種は下位 32 ビットだけを使います）。上限と範囲の幅
  （`stop - start`）は、両方の言語とも 2**53 - 1 までで、超えれば乱数を生成する前に止めます。
  これより大きい値は TypeScript 版が正確に表せず、2つの言語で同じ答えを約束できないためです
- 混ぜ方：どちらも Fisher–Yates で、渡した列を書き換えずに新しい列を返します（名前は `sorted` に
  合わせて `shuffled`）。TypeScript で `sort(() => rng.random() - 0.5)` と書くと、比べた結果が
  矛盾し、並びが並べ替えの実装に左右されます。Python で `sorted(items, key=lambda _: rng.random())`
  と書くと、並びは決まりますが、生成する回数が要素の数になり、TypeScript 版と並びがそろいません

2つの言語で同じ値が出ることは、両方のテストに置いた同じ固定値の表で検証しています
（Design Choice の 2）。表の値は2つの言語の実装で別々に出して一致を確認し、animal-bomber の
Python 版のテスト（[test_rng.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_rng.py)）に
貼ってある TypeScript 版の値（種 12345・1・0・0xFFFFFFFF の最初の5つ）とも照らしました。

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 乱数の本体は、animal-bomber の [rng.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/rng.py)
  （Python）と [Rng.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/Rng.ts)（TypeScript）です。
  animal-bomber の原型（ブラウザで動く1つの HTML ファイルで書いた最初の版）は、1つの `Math.random` を44か所で共有していて、見た目だけの粒子を1つ多く出しただけで、
  その後の抽選が全部ずれました。そのため結果に関わる乱数をこの形にし、見た目だけの乱数は別の型に
  しています（[cosmetic_rng.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/presentation/cosmetic_rng.py)、
  [CosmeticRng.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/presentation/CosmeticRng.ts)）
- 名前と範囲の決まりは、Python 版にそろえました。TypeScript 版は `next`・`int`・`range`・`pick` と、
  渡した配列を書き換える `shuffle` で、空の配列から選ぶとき以外は引数の範囲を確認していませんでした。
  このリポジトリでは、両方の言語を `random`・`below`・`between`・`chance`・`choice`・`shuffled` に
  そろえ、TypeScript でも範囲の外の引数で止めます
- 種から種を導く式は、CPU の判断に専用の乱数を持たせる所（[source.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/source.py) の
  `cpu_seed`、[CpuInputSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/CpuInputSource.ts) の `cpuSeed`）と
  同じです。CPU が試合の乱数を使うと、CPU が考えた回数でアイテムの抽選が変わるので、試合の種と
  プレイヤーの番号から CPU の種を導いています。番号の範囲を決めて、外なら止めるのは、このリポジトリで足しました
- ラウンドごとの種（[match.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/rules/match.py) の
  `seed_for_round`、[MatchConfig.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/rules/MatchConfig.ts) の
  `seedForRound`）は、同じ考えを足し算で書いた例です（試合の種 + ラウンドの番号 × 0x9E3779B1）。
  こちらは番号 0 で元の種がそのまま返ります。このリポジトリは XOR の形にそろえました

種を渡し忘れて結果が振れたことは、ほかの作品でもありました。[data-science-portfolio](https://github.com/nakatama225/data-science-portfolio) の
機械学習の比較（[training.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/src/spacex_capstone/modeling/training.py) の
`default_model_specs`）では、決定木に種を渡していなかったため、検証データの正解率が実行ごとに
0.722 と 0.667 に振れ、モデルを良くしたのか偶然良く出たのかを区別できませんでした。

### 状態の要約

状態を、比べられる数1つにまとめる部品です。同じ処理を2回走らせた結果や、2つの環境で走らせた
結果が同じかを、状態の全体を比べずに確認するのに使います。ずれは起きた直後には見えず、
しばらくたってから原因と離れた所で見えることが多いので、決めた間隔で要約を比べておくと、
ずれた直後に気づけます。アルゴリズムは FNV-1a（値を1バイトずつ混ぜていく、短い要約の作り方）の
32 ビット版です。

- 混ぜる順：何をどの順で混ぜるかは呼ぶ側が決めて、固定します。順が変われば、同じ状態でも
  別の値になります。値の種類（整数か文字列か）は混ぜないので、真偽値は 1 と 0 の整数と、
  空の文字列は整数 0 と同じ要約になります。種類は、決めた順で決まる前提です
- 小数：丸めたり文字列にしたりせず、IEEE 754 の 64 ビットのビット列のまま混ぜます。
  0.1 + 0.2 と 0.3 のようなわずかな差も、`==` では等しい 0.0 と -0.0 も、別の要約になります。
  数を文字列にしてから混ぜる形は選びませんでした。Python の `repr` と JavaScript の `String` は、
  整数の値の書き方（`1.0` と `1`）、指数の形で書き始める境目（`1e16` を Python は `1e+16`、
  JavaScript は 17 桁の整数で書く）、指数の桁の書き方（`1e-07` と `1e-7`）の3つで違うためです
- 文字列：UTF-8 のバイト列のあとに、そのバイトの数を混ぜます。数を混ぜないと、'ab' と 'c' を
  続けて混ぜた要約と、'a' と 'bc' を続けて混ぜた要約が同じになります。文字の数でなくバイトの数に
  したのは、文字の数え方が言語で違うためです（'𠮷' を Python の `len` は 1、TypeScript の
  `length` は 2 と数えます）
- 整数：-2**31 以上 2**32 未満を受け、32 ビットの2の補数で混ぜます。符号つきと符号なしで同じ
  ビットの並びになる値（-1 と 0xFFFFFFFF）は、同じ要約になります。符号つきの差と、符号なしの
  32 ビットの値（乱数の状態など）の両方を受けるためです。範囲の外は、下位 32 ビットに切り落とさずに
  止めます。切り落とすと、違う値が同じ要約になります
- 止まるときは、混ぜる前に止まり、それまでの要約を変えません
- 衝突しない保証は無く、改竄を防ぐ用途には使えません。約束するのは、同じ値を同じ順で混ぜれば
  同じ要約になることだけです

言語で形が変わったところは3つです。

- 文字列のバイト列：TypeScript は、型の設定が ES2022 だけで `TextEncoder` が型に無いので、
  UTF-8 のバイト列を符号位置（Unicode が文字に振った番号）から手で組みます。サロゲート
  （U+D800〜U+DFFF。UTF-16 が U+10000 以上の文字を2つの値の対で表すのに使う範囲で、1つだけでは
  文字を表しません）を除く全部の符号位置で、`TextEncoder` と同じバイト列になることを、組んだときに
  確認しました。Python は `str.encode` です
- 小数のビット列：TypeScript は `DataView` の `setFloat64` で、下位のバイトから並べる順を指定して
  書き出します。`Float64Array` で書き出すと、バイトの順が実行環境の順になるためです。Python は
  `struct` の `<d`（`<` が下位のバイトから並べる指定）です
- 整数かどうかの確認：TypeScript は、整数でない数（1.5・NaN・無限大）も止めます。`| 0` や `>>> 0` に
  通すと、1.5 は 1 に、NaN は 0 に、黙って変わるためです。Python は `int` の型で受けるので、
  型検査に任せます

2つの言語で同じ要約が出ることは、両方のテストに置いた同じ固定値の表（整数・小数・文字列・
種類の違う値を続けて混ぜたもの、の4つ）で検証しています（Design Choice の 2）。表のセルは数だけ
なので、文字列は符号位置の並びで書いています。空の要約と、整数・小数・文字列・真偽値・整数を
この順で混ぜた要約の1つは、animal-bomber の Python 版のテスト
（[test_statehash.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_statehash.py)）に
貼ってある TypeScript 版の値とも同じです。

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 要約の本体は、animal-bomber の [statehash.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/statehash.py)
  （Python）と [StateHash.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/StateHash.ts)（TypeScript）です。
  記録した操作から同じ結果を作り直せるかの確認と、通信で2つの端末が同じ状態にあるかの突き合わせに
  使っています（[world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/world.py) の
  `hash_world`、[WorldState.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/WorldState.ts) の `hashWorld`）
- 混ぜるバイトの並びを、2つの言語で1つに決めました。animal-bomber は、文字列を TypeScript 版が
  UTF-16 の符号単位（`charCodeAt` の値）と `length` で、Python 版が UTF-8 のバイトとバイトの数で
  混ぜていて、ASCII の外では2つの版の要約がそろいませんでした。Python 版のテストが TypeScript 版の
  値と比べているのも、ASCII の文字列だけです。小数も、TypeScript 版は `Float64Array` で書き出していて、
  バイトの順を実行環境に任せていました
- 止める値を3つ足しました。どれも animal-bomber には無い約束です
  - NaN：ECMAScript の仕様は、NaN を書き出したときのビット列を、実装が選んでよいとしています
    （`DataView` の `setFloat64` が通る手順の NumericToRawBytes。同じ NaN には同じビット列を選ぶことだけを
    求めています）。Python でも、NaN のビット列は作り方で変わります（`math.nan` と `-math.nan` は
    符号のビットが違います）。同じ「NaN」が同じ要約になる保証が無いので、混ぜずに止めます。
    animal-bomber は、どちらの版も NaN を混ぜていました
  - 対になっていないサロゲート（'\ud800' など）：UTF-8 にできません。Python の `str.encode` は止まり、
    `TextEncoder` は U+FFFD（置き換えの文字）に置き換えます。置き換えると違う文字列が同じ要約になる
    ので、TypeScript でも止めます
  - TypeScript の整数でない数（1.5 など）：animal-bomber の TypeScript 版は `value | 0` で、範囲の外も
    小数も黙って 32 ビットの整数にしていました。Python 版は範囲の外を止めていたので、範囲はそれに
    そろえ、TypeScript では小数も止めます

使ってみて分かったこともあります。結果を左右する値を状態に足したら、要約にも足します。
animal-bomber では、盤面に置いた物の持ち主を混ぜておらず、持ち主だけが違う2つの状態が、その違いが
結果に表れるまで同じ要約になっていたことが、後から見つかりました。こうした漏れは、
状態の項目を1つずつ変えて、要約が変わるかを見るテストで見つけられます（[test_world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/state/test_world.py) の
`Test状態の要約`）。このリポジトリには要約を作る具体的な状態が無いので、このテストは置いていません。
状態の種類を閉じた union で表しているなら、要約を作る分岐も、種類を漏れなく扱ったかを型検査が
確認する形（Python は `match` と `assert_never`、TypeScript は `never` への代入）で書きます。
種類を足したときに、要約へ混ぜ忘れると型検査が止めます（[world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/world.py) の
`_hash_life`、[WorldState.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/WorldState.ts) の `hashLife`）。

要約は、ずれを見つけるほかにも使えます。状態を読むだけのはずの処理（判断や描画）を呼ぶ前と後で
要約を比べると、その処理が状態を書き換えていないことを確認できます（[test_cpu.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/ai/test_cpu.py) の
`test_入力を返す前と後で_試合の状態が変わらない`）。要約に乱数の状態と生成した回数も混ぜておくと、
乱数を余計に生成したずれも見つかり、読むだけのはずの処理が乱数を生成したことも分かります。

### 固定刻みの時間

実時間で動く処理を、長さの決まった刻みの繰り返しで進めるための部品です。1回呼ぶと1刻み進む
処理には経過時間を渡さず、実時間を「いま何刻み進めるか」に換える所を1か所にします。1刻みの
中身が機械の速さやフレームの揺れで変わらないので、同じ操作から同じ結果が出ます。

- 端数の持ち越し（`StepAccumulator`）：経過時間をナノ秒の整数で受け、「ナノ秒 × 1秒あたりの
  刻みの数」の整数で積みます。この単位では1刻みがちょうど 10 億になり、割った余りが正確に残る
  ので、何時間続けても1秒あたりの刻みの数はずれません。負の経過時間は、0 に丸めずに止めます
- 遅れすぎた分：1回に返す刻みの数には上限を置き（`max_steps`・`maxSteps`）、上限を超えたら
  上限を返して、端数も捨てます。機械がスリープから戻ったときなどに、遅れた分を全部まとめて
  進めると、進め終わらないうちに次の刻みの時刻が来て、遅れが積み上がるためです。上限ちょうど
  までは、端数を残します
- 次の刻みまでの時間（`ns_to_next_step`・`nsToNextStep`）：切り上げます。切り捨てると、その時刻
  ちょうどに目を覚ましても1刻みにわずかに足りず、0刻みのフレームになります。そのあと次の刻みまでの
  時間が 0 になり、呼ぶ側の輪が待たずに回ります（時計が進まなければ、0刻みのフレームが続きます）
- 倍率（`RateScaler`）：倍速と低速は、刻みの長さを変えずに、進める回数で表します。0.5 倍なら
  2フレームに1回、1.5 倍なら1回と2回を交互に進め、端数は持ち越します。止めるときは呼ばず、
  倍率 0 は受けません
- 描く値を混ぜる割合（`blend`）：倍率が整数でないと、1フレームに進む刻みの数が揃わず、進めた
  刻みの値をそのまま描くとコマ送りに見えます。1つ前の刻みの値に、持ち越した端数の割合だけ
  寄せて描けば、どのフレームも倍率分ずつ進みます（そのかわり、描く位置はいつも1刻み遅れます）。
  割合は `take` のときに決めて控え、倍率を替える `set` では変えません。止めている間に倍率を
  替えても、止まっている絵が動かないようにするためです。ただし、整数と整数でない倍率の間で
  替えたフレームだけは、進みが倍率分から最大1刻み外れます
- フレームの輪（`frames`。Python だけ）：次の刻みの時刻まで待ち、前のフレームからの経過時間を
  刻みの数に換えて返します。次の刻みの時刻は持ち越した端数から毎回計算し直すので、待ちが
  遅れても、次のフレームでは刻みの境目に戻ります。最初のフレームは待たずに 0 を返し、抜ける
  ときは `break` します。輪は、進めた刻みを通算で数えません。止めている間も輪は動き続け、
  進めるかどうかは呼ぶ側が決めるので、輪が数えると、実際に進めた回数とずれます。Command の
  歩の番号を、処理の側が数えて渡すのと同じ考えです
- 締め切りまで眠る関数（`sleep_until`。Python だけ）：早く目を覚ましたら、眠り直します。時計と
  眠る関数は呼ぶ側が渡し、`lib/` は `time` を読み込みません。輪には
  `functools.partial(sleep_until, sleep=time.sleep)` の形で渡します

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、
起動のたびに同じ結果を出す）だけです。計算は整数の足し算・掛け算と、切り捨て・切り上げの
割り算で書き、`round` は使いません。例外は3つで、Python の倍率は分数（`Fraction`）で計算し、
`progress` と `blend` は小数を返し、`sleep_until` は眠る秒を小数で渡します。

言語で形が変わったところは4つです。

- 時刻の単位：どちらも経過時間をナノ秒の整数で受けます。Python の `time.perf_counter_ns` は
  ナノ秒の整数を返します。ブラウザの `performance.now()` はミリ秒の小数なので、呼ぶ側は時刻を
  先にナノ秒の整数に換えてから差を取ります。差を取ってから換えると、換えるときの切り捨ての
  誤差がフレームごとに積もります
- 倍率の持ち方：Python は標準の分数（`fractions.Fraction`）で受け、端数も分数で持ちます。分母の
  違う倍率（1/2 から 1/3）に替えても、端数をそのまま足せます。TypeScript は分母（`parts`）を
  作るときに決め、分子（`rateParts`）を整数で持ちます。分母は替えられないので、使う倍率が
  どれも整数の分子で表せる分母を選びます（1/2 と 1/3 を使うなら 6）
- 整数の引数の確認：TypeScript は、1秒あたりの刻みの数・上限・経過時間・刻みの数・倍率の分母と
  分子が安全な整数かを、実行時に確認します。1回に返す刻みの数の上限は 9_007_198 までです。
  (上限 + 1) × 10 億が 2**53 - 1 に収まる範囲で、上限を超えるかを掛け算の前に比べ、2**53 を
  超えて丸められる掛け算をしないためです。`take` も、端数と「刻みの数 × 分子」の和が 2**53 - 1 を超えるなら、
  掛ける前に止めます。Python は `int` の型で受け、整数は桁あふれしないので、上限の大きさを
  限らず、とても長い経過時間（2**64 ナノ秒など）にも上限を返します
- 待つ部品：Python だけに置いています。Python は描く時刻を自分で決められ、輪を generator
  （`for steps in frames(...):` で受け取り、`break` で抜ける）で書けます。TypeScript はブラウザが
  描く時刻を決め（`requestAnimationFrame`）、このリポジトリの型の設定（ES2022 だけ）には、時計
  （`performance.now`）も待つ関数（`setTimeout`）もありません

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 本体は、animal-bomber の [loop.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/shell/loop.py)
  （Python。`TickAccumulator`・`GameSpeed`・`frames`・`sleep_until`）と
  [FrameLoop.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/platform/FrameLoop.ts)
  （TypeScript。`TickAccumulator`・`GameSpeed`）です。1秒あたりの刻みの数（60）と1回の上限（15）は
  定数でしたが、引数にしました
- 1刻みの処理から経過時間を外したのは、原型（ブラウザで動く1つの HTML ファイルで書いた最初の版）の
  失敗からです。原型は1回の処理に前のフレームからの経過時間を渡し、倍速のつまみをその経過時間に
  掛けていたので、倍速にすると1回のキー入力が2〜3回に数えられました。animal-bomber は、1回呼ぶと
  1刻み進む形にし、倍速は呼ぶ回数で、止めるのは呼ばないことで表しています
  （[tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/tick.py) の説明、
  [simulation.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/simulation.py) の `step`）。
  当たり判定を細かく挟む処理も、1刻みの移動の中だけに置いています
  （[movement.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/movement.py)）。
  原型は、この細かい分け方を時間を進める処理そのものに書いていたので、入力の読み取りまで一緒に
  分かれていました
- TypeScript 版の `TickAccumulator` はミリ秒の小数で積んでいたので、Python 版と同じナノ秒の整数にそろえました。
  Python 版のテスト（[test_loop.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/shell/test_loop.py)）
  には、ミリ秒の小数で積む形では、3時間分（648_000 回）の合計が1つ足りない 647_999 になったと
  書いてあります
- TypeScript 版の `GameSpeed.take` は引数を取らず、1刻み分の時間が経つたびに呼ぶ形でした。
  Python 版と同じく、そのフレームで経った刻みの数を渡す形にしました
- TypeScript の `blend` は、animal-bomber の TypeScript 版の `GameSpeed.progress` から変えたものです。
  あちらは描く時刻をブラウザが決めるので、実時間の進み具合（次に刻みを進めるまでの割合）も
  受け取り、倍率を掛けて端数に足し、上限を 1 にしています。このリポジトリは、Python 版の `blend`
  （最後の `take` のときの端数の割合。`set` では変えない）に2つの言語をそろえました。ブラウザが
  決めた時刻に描くとき、刻みの間を実時間で埋める値は、この部品にはありません。このリポジトリの
  TypeScript の `progress` は、Python 版と同じく持ち越した端数だけを返します。animal-bomber の
  TypeScript 版の `progress` とは、名前が同じで意味が違います
- 倍率は、animal-bomber では 0.5 から 3 までを 0.25 ずつに限っていました（Python 版は 4 を分母に
  した整数で、TypeScript 版は小数で端数を持ちます。0.25 の倍数は2進数の小数で正確に表せるので、
  誤差が出ません）。このリポジトリは、0 より大きいどの分数の倍率も受けます。混ぜる割合を
  `take` のときに決めて控える形は、Python 版の形です（loop.py の `GameSpeed` の説明）。割合を
  その場の倍率から決めると、止めている間に整数と整数でない倍率の間で替えたとき、止まっている絵が
  最大1刻み分動きます
- 待ち方は、animal-bomber が測って選びました（Python 版の
  [README.md](https://github.com/nakatama225/animal-bomber/blob/main/py/README.md) の「フレームの間の
  待ち方を測り、眠ることにした」の表）。測る前に書いた決め方
  （[bench_pacing_rule.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tools/bench_pacing_rule.py)）には、
  目を覚ますのが予定より遅れる幅の 99 パーセンタイル（p99。小さい順に並べて 99% の位置にある値）が
  2 ms 以下、という条件などがあり、3回の測定で3回とも満たしたのは、眠らずに時計を読み続けて待つ形
  （空回り）だけでした。2 ms はフレームの時間の配分から置いた数で、遊んでいて感じるかどうかから
  決めた数ではなかったので、animal-bomber は測ったあとにこの上限を外し、眠る形にしました。
  眠る形は、目を覚ますのが予定より遅れても（p99 で 5.48〜6.11 ms）、1刻み（16.7 ms）より短いので、
  1刻み以外を進めたフレームは 0 でした。空回りは遅れが 0 ですが、待つ間もプロセッサのコアを1つ
  使い続け（使用率 100%。眠る形は 32〜33%）、ほかの Python のスレッドは GIL（同時に1つのスレッド
  しか Python のコードを動かさないための鍵）の受け渡しを待たされます。予定の 2 ms 前まで眠り、
  残りを空回りする形も測りましたが、眠ると目を覚ますのが中央値で 3.7 ms ほど遅れるので、空回りを
  始める前に予定を過ぎることが多く、遅れが残りました（p99 で 3.21〜3.48 ms）。そのため、
  このリポジトリには眠る形の `sleep_until` だけを置き、空回りの `spin_until` は置いていません
- 同じ測定で、pygame の `Clock.tick(60)` で待つ形は、2割を超えるフレーム（600 フレームのうち
  134〜135）が0刻みか2刻み以上を進めました。輪が決めた締め切りを受け取らず、前に呼んだ時刻から
  数えて待つためです。待つ関数の型（`Wait`）に、締め切りを受け取ることと、返ったとき時計が
  締め切り以上であることを約束として書いているのは、このためです
- 偽の時計（[fake_time.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/shell/fake_time.py)）の
  形も、animal-bomber から持ってきました
- 1フレームに進める数を揺らしても結果が変わらないことを、animal-bomber は試合の記録を輪で再生して
  確認しています（[test_pacing.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_pacing.py)。
  0・1・2・7・15 と揺らし、1刻みずつ再生した結果と比べる）。このリポジトリには、刻みごとに進める
  具体的な処理がありません。テストの中に小さな処理を書いて比べても、その処理が経過時間を受け取らない
  限り必ず同じになり、部品の約束の確認になりません。そこで、輪が返した数の合計が経過時間どおりに
  なることと、その前提として1フレームの数が実際に揺れたことを確認しています（`test_fixed_step_frames.py`）

秒を刻みの数に換える関数は、このリポジトリに使う所が無いので置いていません。animal-bomber は、
指定した秒より早く終わらせないよう、秒を刻みの数に切り上げて換えています
（[tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/tick.py) の
`seconds_to_ticks`、[Tick.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/Tick.ts) の
`secondsToTicks`）。秒を小数のまま掛けるので、4.15 × 60 は 249.00000000000003 になり、切り上げて
250 刻みになります。animal-bomber は、2つの版で同じ値にするため、この値をそのままテストで固定しています
（[test_tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/core/test_tick.py)）。
置くなら、時間をナノ秒の整数で受け、`ns_to_next_step` と同じく整数の割り算で切り上げます。

### 格子と幅優先の最短経路

マス目の上で、条件を満たす最初のマスまでの最短経路を求める部品と、マス目を持つ入れ物です。
2つは別の部品で、探索（`findPath`・`find_path`）は格子の入れ物（`Grid`）を受けません。列と行の
数と、そのマスへ進めるかを答える関数（`passable`）だけで動くので、盤面を別の形で持っている
呼ぶ側も、探索だけを使えます。

- 格子の入れ物：左上から行ごとに並べた1本の配列で持ち、添字の計算（行 × 列の数 + 列）を
  クラスの中に閉じ込めます。外を読むと、作るときに決めた値（`outside`）を返します。通れない
  ものを表す値を外の値にすれば、当たり判定や、まっすぐ伸びる範囲を求める処理に、範囲を確認する
  分岐を書かずに済みます。外へ書くと止めます。外は読むと決めた値を返すだけの場所で、書こうと
  するのは呼ぶ側の誤りだからです。値は作るときに写して持つので、渡した配列をあとで書き換えても
  格子は変わりません
- 幅優先：どのマスへ進む手間も同じなので、幅優先で最初に見つかった経路が最短です。重みを扱う
  探し方（ダイクストラ法や A*）は、複雑さに見合いません
- 出発点：目的地として見ず、通れるかも尋ねません。返すのは出発点の次のマスから目的地までの
  並びで、長さが歩数です。出発点が目的地かは、呼ぶ側が先に見ます。いま立っているマスが通れない
  マスになっていても、そこから出る道を探せます
- 目的地（`goal`）：マスと、出発点からの歩数を受け取ります。届いたマスに、出発点に近い順に
  1回ずつ呼ぶので、「3マス以上離れた所」のような条件も書けます。目的地も、通れるマスの中から
  探します
- 探す歩数（`maxDistance`・`max_distance`）：ちょうどこの歩数のマスまでを見ます。0 なら、隣が
  目的地でも見つかりません。負の数は止めます
- 同じ長さの経路の選び方：隣を試す順（`order`）で先に届いた経路を返します。既定は右・左・下・上
  （`FOUR_NEIGHBOURS`）です。この順は隣の決め方も兼ね、ここに無い向きへは進みません

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、
起動のたびに同じ結果を出す）だけです。計算は整数の足し算・掛け算と、余りと切り捨ての割り算
だけです。訪れた印と、各マスへどのマスから来たか（来た所）は、マスの添字で読み書きする
配列で持ち、マスを `set` や `dict` に入れて順に取り出すことはしません。Python で `set` を
順に取り出すと、中身によっては、その順が起動のたびに変わります（同じ節の「`set` を順に取り出すこと」）。

言語で形が変わったところは5つです。

- 待ち行列：TypeScript は配列と先頭の添字で持ちます。ES2022 には先頭から取り出すための型が無く、
  配列の `shift` は残りの要素を前へ詰めるので、要素が多いと遅くなります。同じ Mac の Node.js 26 で、
  10 万個を積んで `shift` で全部取り出すと約 10 秒、先頭の添字を進めて読むと 1 ミリ秒未満でした
  （1 万個なら、`shift` でも 1 ミリ秒未満でした）。Python は標準の `collections.deque` で、先頭から
  取り出す時間は要素の数によりません
- 訪れた印と来た所の配列：TypeScript は、訪れた印を `Uint8Array` に、来た所を数の配列に持ちます。
  来た所を `Int32Array` にすると、2**31 以上の添字が負の数に化けるためです（数の配列は 2**32 - 1 より
  長く作れず、作る所で止まります）。Python はどちらも `list` です
- マスを `set` や `Set` に入れるとき：Python の frozen dataclass は中身で比べる `__eq__` と `__hash__` を
  持つので、`Cell` をそのまま `set` に入れて、中にあるかを見られます。TypeScript の `Set` と `Map` は
  オブジェクトを同じものかで比べるので、中身が同じ別のオブジェクトを見分けません。まだ置いていない
  障害を `passable` に足すときなどは、添字（行 × 列の数 + 列）か文字列を鍵にします
  （[grid-path.test.ts](typescript/tests/lib/grid-path.test.ts) の「まだ置いていない障害」のテストがこの形です）
- 書き換えるメソッドの名前と止め方：どちらも `put` です。Python のクラスで `set` という名前の
  メソッドを定義すると、同じクラスの中でそのメソッドより後に書いた型注釈の `set[...]` が、組み込みの
  `set` でなくそのメソッドを指します。型検査（mypy）が止め、3.13 までは、クラスを作る所で TypeError に
  なります。3.14 からは注釈をあとで評価するので、クラスは作れますが、注釈を読み出す所で同じ TypeError に
  なります（このときは、メソッドより前に書いた注釈も同じです）。TypeScript もそろえて `put` に
  しました。外へ書いたときは、Python は `ValueError`、TypeScript は `RangeError` で止めます。
  Python は animal-bomber の `board.py` の `put` と同じです。`IndexError` は `list` などの並びの添字が
  範囲の外のときの例外で、ここで受け取るのは添字でなくマスの位置なので、使いませんでした。
  TypeScript は、`lib/` のほかの部品と同じく、範囲の外の引数を `RangeError` で止めます
- 整数の引数の確認：TypeScript は、列と行の数・マスの位置・探す歩数・隣への差分が安全な整数かを、
  実行時に確認します。小数のマスは範囲の確認を通り（0 ≤ 0.5 < 3）、添字が小数になって、配列は
  `undefined` を返し、書き込みは配列の要素になりません。Python は `int` の型で受けるので、型検査に
  任せます。また、TypeScript の既定の順（`FOUR_NEIGHBOURS`）は `Object.freeze` で凍らせています。
  どの呼び出しにも同じ配列を既定として渡すので、1か所で書き換えると、ほかの呼び出しの経路まで
  変わるためです（`readonly` は型検査だけの約束です）。Python の既定の順はタプルで、書き換えられません

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 探索の本体は、animal-bomber の [path.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/query/path.py)
  （Python。`find_path`）と [PathFinder.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/query/PathFinder.ts)
  （TypeScript。`findPath`）です。訪れた印と来た所を添字で読み書きする配列で持つこと、右・左・下・上の順で
  隣を試すこと、出発点を目的地として見ないこと、出発点の次から目的地までを返すことは、そのままです。
  animal-bomber の探索は試合の状態とプレイヤーを受け、通れるかの判定（ブロック・爆弾・燃えかけて
  いるマス・踏むと損をするアイテム・これから置く爆弾）を中に持っています。このリポジトリは、通れるかを
  関数で受け、判定を呼ぶ側に任せました。また、出発点が格子の外のときと、探す歩数が負のときは
  止めます。animal-bomber の探索は、どちらも確認していません。テストの形は
  [test_path.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/query/test_path.py) と
  [path-finder.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/ai/path-finder.test.ts) です
- 格子の入れ物は、[board.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/board.py) の
  `Board` と [Board.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/Board.ts) の `Board` です。
  外を壊せない壁として返すので、当たり判定や爆風の伸び方に、範囲を確認する分岐がありません。
  このリポジトリでは、外の値を作るときに受けます。TypeScript 版の `Board` は、外を指した `set` を
  何もせずに終え、作るときに値の配列を写さず、大きさが合わないと `Error` を投げていました。
  このリポジトリでは、Python 版にそろえて、外へ書くと止め、値を写して持ちます。また、列か行が 1 未満の
  格子は作れないようにしました。animal-bomber の `Board` は値の数だけを比べていますが、負の数どうしの
  積は正になるので、それだけでは (-2, -2) と値 4 つの組が通ってしまうためです
- 共通部品に引き上げたのは、animal-bomber で同じ探索を2回書いていたためです。2回目は、相手を
  追いかける炎（狐火）の道探し（[fox.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/abilities/fox.py) の
  `_next_step`、[FoxfireActor.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/fox/FoxfireActor.ts) の
  `#nextStep`）で、見たマスを、Python は `Cell` を鍵にした `dict` で、TypeScript は文字列の `Set` で
  覚えていました。狐火の道探しは、
  相手がいまのマスにいれば、いまのマスを返します。それ以外は、いちばん近い相手への最短の道の最初の
  1マスだけを返し、深さの上限は 22 マス（`SEARCH_DEPTH`）です。隣を試す順（`SEARCH_ORDER`）は
  `FOUR_NEIGHBOURS` と同じ並びです。この部品で書くなら、先に相手がいまのマスにいるかを見て、いなければ
  `passable` を空きマス、`goal` を相手のいるマス、探す歩数を 22 にして呼び、返った経路の先頭を次の
  1マスにします。狐火の道探しを写したものと、乱数で作った格子 2 万通りで突き合わせ、全部で同じ答えに
  なることを確認しました。2つ目の使い道にも、この形で足ります。animal-bomber の側は、手で書いたままです
- 順で答えが変わる探し方（同じ長さの経路のどれを返すか、など）を原型（ブラウザで動く1つの HTML
  ファイルで書いた最初の版）とそろえるため、animal-bomber は向きの一覧（上・右・下・左）とは別に、
  走査の順（右・左・下・上）を置いています（[coord.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/coord.py) と
  [Coord.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/Coord.ts) の `SCAN_ORDER`）。
  向きの一覧そのものを並べ替えると、乱数で向きを選ぶ所など、原型と順が対応していない所の答えまで
  変わるためです。このリポジトリには向きの一覧が無く、`FOUR_NEIGHBOURS` が走査の順そのものです

使ってみて分かったことも2つあります。近さは、縦と横の差の和（マンハッタン距離）でなく、歩ける
経路の長さで見ます。原型は差の和で見ていたので、壁の向こうの相手を近いと判断し、届かない飛び道具を
撃ち続けました（[context.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/context.py) の
`foe_path_distance`。返った経路の長さを使います）。また、経路に沿って少しずつ動かすときは、
マスに着いたとみなす範囲を、1回に動く距離の最大の半分より広くします。狭いと、マスの中央を挟んで
行き過ぎと戻りを毎回繰り返し、止まりません（[follow.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/follow.py) と
[PathFollower.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/PathFollower.ts) の `ARRIVED`）。

### 連鎖の一括処理と最も早い時刻

要素の1つが発火する（その要素の処理が起きる）と、そこから届く要素も同じ時刻に発火し、さらにその先へも
広がる、という連鎖を扱う部品です。要素は 0 から始まる添字で表し、どの要素からどの要素へ届くかは、
添字を受けて届く相手の添字を返す関数（`reaches`）で渡します。

- 一括処理（`cascade`）：起点から連鎖が尽きるまでたどり、発火した要素を、発火する順に1度ずつ返します。
  待ち行列でたどり、積むときに印を付けます。取り出すときに付けると、2つの経路から届いた要素を2度積み、
  2度処理します。同じ要素へいくつもの経路で届く形（ひし形）、輪、自分自身へ届く形でも、1度ずつで止まります
- 発火する順：起点を渡した順に先に積み、そのあとは積んだ順にたどります。返す順は、起点から何回届いて
  発火したか（段）の小さい順で、同じ段の中は積んだ順です。`reaches` は、発火した要素にだけ、この順に
  1度ずつ呼びます。待ち行列は、返す並びをそのまま使い、先頭の添字を進めて読みます。積んだ順がそのまま
  発火する順なので、別の並びに写さずに済みます（Python も `deque` を使いません）
- 最も早い時刻（`earliestTimes`・`earliest_times`）：要素ごとに自分で発火する時刻を持ち、届いた相手は同じ
  時刻に発火するとき、発火が起きる前に、それぞれが実際に発火する最も早い時刻を見積もります。添字を
  時刻の小さい順に並べ（同じ時刻なら添字の小さい順）、まだ発火していない要素から一括処理と同じたどり方を
  当て、届いた要素にその時刻を入れます。時刻の見積もりと実際の連鎖が、同じ `reaches` と同じたどり方で
  決まります
- 印を1組だけ使う：最も早い時刻では、起点を替えても印を共有します。前の起点の連鎖で時刻の決まった要素は
  積まれず、その先もたどり直しません。手間は、並べ替えと、届く関係の数（`reaches` が返す相手の合計）で
  済みます。小さい時刻から決めるので、あとから届く遅い時刻が、決まった時刻を書き換えることもありません。
  起点ごとに新しい印で一括処理を呼ぶ形は選びませんでした。決まった要素の先を毎回たどり直すので、手間が
  要素の数の2乗になりえます。そのうえ、届いた要素のうち時刻の決まっていないものにだけ書く条件を足さないと、
  遅い起点から早い起点へ届く形で、早いほうの時刻が遅いほうに書き換わります
- 無限大と負の時刻：時刻が無限大（`math.inf`・`Infinity`）の要素は、自分では発火せず、ほかから届いた
  ときだけ時刻が入ります。どこからも届かなければ無限大のままです。負の時刻と負の無限大は受けます。
  比べるだけで足し引きしないので、どの値でも意味が変わらないためです
- 止める値：要素の数が負のとき、起点か `reaches` が返した添字が範囲の外のとき、時刻が NaN のときです。
  負の添字は、Python の `list` では後ろから数えた要素を指し、別の要素に印を付けてしまいます。NaN は
  大小を比べるとどれも偽になり、並べた順が決まりません。起点の範囲と時刻の NaN は、たどり始める前に
  すべてを見ます

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、
起動のたびに同じ結果を出す）だけです。計算は添字と時刻の比べだけで、時刻は足し引きせず、渡した値を
そのまま返します。印は添字で読み書きする配列で持ち、要素を `set` や `dict` に入れて順に取り出すことは
しません。

テストでは、期待値を別の求め方でも作っています。3個の要素の間のありうる届く関係（自分自身へ届く組も
含めて 512 通り）と、1・2・無限大から選んだ時刻の組（27 通り）の全部で、全部の組を比べて変化が無くなる
まで繰り返す素朴な形（animal-bomber の見積もりと同じ形）と、最も早い時刻が一致します。一括処理も、全部の
関係と起点の組で、待ち行列を使わず組を全部見直す求め方と同じ要素を、1度ずつ返します。

言語で形が変わったところは2つです。

- 時刻の並べ方：Python は `sorted` に時刻を読む関数（`key`）を渡します。TypeScript は添字の配列の `sort` に、
  大小を直に比べる関数を渡します。どちらの並べ替えも安定（同じ時刻なら元の順を保つ）で、TypeScript では
  ES2019 から仕様で決まっています。比べる関数を時刻の差（`times[a] - times[b]`）で書いても、`sort` は
  比べる関数が返した NaN を「等しい」として扱うので、無限大どうしの差が NaN になっても同じ順になります。
  その扱いに頼らないよう、大小で比べています
- 整数の引数の確認：TypeScript は、要素の数・起点・`reaches` が返す添字が安全な整数かを、実行時に
  確認します。小数の起点は範囲の確認を通り（0 ≤ 0.5 < 3）、`Uint8Array` の小数の添字は読むと `undefined` で、
  書いても要素にならないので、印が付かないまま積まれます。空きのある時刻の配列（`[1, , 2]`）の空きも、
  NaN と同じく止めます。Python は `int` の型で受けるので、型検査に任せます。印は、TypeScript が
  `Uint8Array`、Python が `list` です

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 一括処理の本体は、爆発の処理（[blast.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/blast.py) の
  `detonate`、[explode.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/mutations/explode.ts) の
  `detonate`）です。爆弾の爆風が届いた別の爆弾も、同じ刻み（tick）のうちに爆発します。触れた爆弾の導火線を
  0 にして次の刻みに爆発させる形にすると、連鎖が1刻みに1段しか広がらず、爆風の出る刻みが原型と変わります。
  そこで、触れた爆弾を待ち行列に積み、連鎖が尽きるまで1刻みの中でまとめて処理し、別の経路から二度届くので、
  積むときに印（`Bomb.chained`）を付けています（blast.py のモジュールの説明）。このリポジトリは、爆弾を添字に、
  爆風が届くかを `reaches` に置き換えました
- 印の置き場所を変えました。animal-bomber は印を爆弾の項目（`chained`）に持ちます。このリポジトリの部品は
  要素の中身を知らないので、添字で読み書きする配列に持ちます。要素そのものを `set` や `Set` に入れて印に
  する形も選びませんでした。Python の `set` は要素のクラスの `__eq__` と `__hash__` で同じかを決め、
  TypeScript の `Set` はオブジェクトをいつも同じものかで比べる（上の格子の節の「マスを `set` や `Set` に
  入れるとき」）ので、要素そのものに印を付けると、中身が同じ別の要素に同じ印が付くかどうかが、言語と
  要素のクラスで変わります。また、中にあるかを見るだけなら順は関わりませんが、印の `set` を順に取り出すと
  （発火した要素を印から並べ直すなど）、animal-bomber の爆弾のように `eq=False` で同じものかで比べる要素は、
  `hash` が番地（メモリ上の位置）から作られるので、取り出す順が起動のたびに変わりえます
  （[bomb.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/bomb.py) の説明）。
  添字の配列なら、どちらの心配もありません
- 起点が複数のときの扱いを決めました。animal-bomber は、導火線の尽きた爆弾を置かれた順に1つずつ爆発させ、
  連鎖ごとに、壊れたブロックを盤面から取り除いてから次の連鎖へ進みます（blast.py のモジュールの説明の
  「順が結果を決める所」。置かれた順に連鎖を始めるのは `detonate_expired`、ブロックを取り除くのは
  `detonate` の終わりです）。先の連鎖に巻き込まれた爆弾は、もう盤面に無いので飛ばします。このリポジトリの
  `cascade` は、渡した起点をまとめて先に積む1つの連鎖として扱います。animal-bomber の形にするなら、
  起点を1つずつ渡し、前の連鎖で発火した要素は起点に渡さず、`reaches` からも返さないようにします
- 最も早い時刻は、危険の見積もり（[danger.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/query/danger.py) の
  `_propagate_chains`、[DangerMap.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/query/DangerMap.ts) の
  `propagateChains`）を書き換えたものです。animal-bomber は、早い爆弾の爆風が遅い爆弾に届いていれば遅いほうを
  早いほうに合わせる、を全部の組で比べ、変化が無くなるまで、最大で爆弾の数だけ繰り返します。手間は、
  繰り返しの回数（爆弾の数）× 組の数（爆弾の数の2乗）で、Python 版はさらに、届くマスの `list` を `in` で
  探します。このリポジトリは小さい時刻から決める形にし、手間を並べ替えと届く関係の数に抑えました
- 見積もりと実際の爆発が、届く範囲を同じ関数で求める考えは、[blast_reach.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/query/blast_reach.py)
  （TypeScript 版は [BlastReach.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/query/BlastReach.ts)）から
  持ってきました。2か所で別々に書くと、片方だけ変えたときに、見積もりでは安全なマスに実際には爆風が届く、
  という食い違いが生まれるためです（blast_reach.py の説明）。見積もりが誘爆を織り込まないと、まだ時間が
  あると読んで、爆弾を置いた場所で自分の爆風に当たります。原型の実測では、これが CPU の自爆の主な原因で、
  被弾のうち自爆が 80〜100% を占めていました（danger.py の説明の「誘爆を織り込む」）。このリポジトリでは、
  最も早い時刻も一括処理と同じ内部の関数でたどるので、届く関係に加えて、たどり方も1つです

使ってみて分かったこともあります。重なりを除く行は、そのとき害が無くても消しません。animal-bomber の
原型は、ブロックを壊す関数の入口で「もう壊れていれば帰る」ので、1つのブロックは1回だけ壊れていました。
原型から移すときにこの行が落ち、2つの爆弾の爆風が同じブロックに届くと、壊れたブロックの一覧に同じマスが
2回入るようになりました。そのときは同じマスを2回空けても害が無く、TypeScript 版では、壊れたブロックごとに
アイテムを落とす抽選を足したときに表に出ました。抽選が2回行われ、アイテムの出る確率が 55% から約 80% に
上がり、CPU どうしの試合では種 0〜9 のすべてで起きていました（TypeScript 版の修正のコミット f6c3b25 の本文）。
Python 版は、同じマスが重なって入ることと、抽選を足すときに1ブロックに1回にするかを決めることを、一覧の
説明に書いていました（[抽選を足す前の blast.py](https://github.com/nakatama225/animal-bomber/blob/e4bd5b89f34fb4550fd18a435112d4a3b7b0586d/py/src/animal_bomber/domain/systems/blast.py) の
`Detonation.destroyed`）。いまはどちらの版も、一覧に入れるときに重なりを除き、重なると何が起きるか（同じ
マスにアイテムが2つ出うる）をその場所に書いています（[blast.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/blast.py) の
`Detonation.destroyed`、Python 版に抽選を足したコミット d8a08cc の本文）。このリポジトリの一括処理では、
積む前に印を見る行がこの役目を持ちます。この行を消すと、ひし形の連鎖で同じ要素を2度返すことを、テストで
見ています。

### 外から来た値の読み取り

通信で届いた JSON や、自分で決めた形で保存した文字列のように、外から来た値を、型と範囲を見ながら読む
部品です。合わない値は、既定値で埋めたり読み飛ばしたりせず、`ReadError` で止めます。止める文は、どの項目かで
始めます（`count が無い`、`names[1] が文字列でない: 2`）。

読み飛ばすと、足りない項目を待ったまま止まり、原因が別の所に見えます。既定値で埋めると、同じ入力から作るはずの
結果が、読んだ側だけ違うものになります。animal-bomber の通信対戦は、全員の端末が同じ設定と同じ操作から同じ試合を
進める作りで、通信の約束の説明に、この2つが書いてあります（読み飛ばすと原因が「通信が遅い」に見える。試合の
設定を既定値で埋めると、その端末だけ別の試合になる）。

- 読み込み（`parseJsonObject`・`load_json_object`）：JSON の文字列を読み、外側がオブジェクトであることを見ます。
  無限大になる数（`1e400`）と、JSON に無い `NaN`・`Infinity` は、読まない項目の奥にあっても、読み込む所で
  断ります。読めない文字列も、入れ子が深すぎて標準の部品が別の例外を出す文字列も、`ReadError` にします
- 項目の読み取り（`readInt`・`read_int` など）：項目を1つ、型を見ながら取り出します。無い項目も止めます。整数は
  最小と最大の両方を必ず受け、最小と最大そのものは読めます。読む時点で上限を置かないと、受けた値を使う先
  （32 ビットの数を前提にした計算など）で、別の例外として止まります。余分な項目は読み飛ばすので、書く側が
  項目を足しても、読む側が知っている項目は読めます
- 配列（`readArray`・`read_list`）：要素を読む関数を受け取り、要素を1つずつ、項目と同じ読み取りで読みます。
  止める文は、要素の位置（`names[1]`）で始まります。型を見ていない要素をそのまま返すと、使う側が要素を読む所で、
  同じ検査をもう一度書きます
- 閉じた種類への読み替え（`readChoice`・`read_enum`）：文字列の項目を、決めた種類のどれかとして読みます。
  知らない値は、既定の種類に倒さずに止めます。読み替えは、外から来た所で1度だけ行います
- 10 進の整数を書いた文字列（`parseDecimal`・`parse_decimal`）：保存した文字列の中の数を、書く側が書く形
  （頭に 0 を付けない、ASCII の数字だけの 0 以上の整数）でだけ読み、最大より大きい数を止めます。JSON の
  読み取りとは変わる理由が違うので、別のファイル（`decimal-text.ts`・`decimal_text.py`）に置いています

書く側も、読む側が読める範囲でだけ書きます。読む側だけを厳しくすると、書いたものを読み戻せなくなります。
反対に、書く側が書く形は、読む側も受けます。animal-bomber の操作の記録は、読み戻しを厳しくしたときに、
記録する関数も、読み戻せない時刻（負の数や小数）を断るようにしました。同じ時刻に2度記録したものは、
書く側がそのまま書くので、読む側も受けています（どちらも、TypeScript 版のコミット f77ae5d の本文）。

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、起動のたびに
同じ結果を出す）だけです。読んだ値は、型と範囲を見て返すだけです。値を変えるのは、TypeScript の `readInt` が
-0 を 0 にそろえることと、Python の `read_float` が整数を float にすることだけです。

言語で形が変わったところは6つです。

- 黙って通る値：どちらの言語にも、書く側が書かない形を黙って読む所があり、その所が違います。Python は、
  `bool` が `int` の仲間（`True == 1`）で、`json` は JSON に無い `NaN`・`Infinity` を数として読み、`1e400` を
  無限大にします。`int()` は前後の空白と改行（`' 1\n'`）、桁の区切り（`'1_000'`）、符号（`'+1'`）、全角や
  ほかの文字の数字（`'１２'`・`'٣'`）を読み、正規表現の `\d` も全角の数字に合います。`re.match` と `$` の組は
  末尾の改行の前でも合うので、`re.fullmatch` で文字列の全体に当てます。JavaScript は、`'toString' in {}` が
  真で、`{}['__proto__']` は `Object.prototype` を返すので、項目の有無を `Object.hasOwn` で見ます。`Number` は
  空の文字列を 0 と、`' 1\n'` を 1 と、`'0x10'` を 16 と、`'1e3'` を 1000 と読むので、正規表現で形を見てから
  数にします。JavaScript の `\d` は ASCII の数字にだけ合い（`u` を付けても同じ）、`$` は `m` を付けなければ
  末尾の改行の前で合いません。そのため TypeScript 版では、`[0-9]` を `\d` に替えても答えは変わりません。
  Python 版にそろえて `[0-9]` と書いています
- 整数と小数：Python の `json` は `1.0` と `1e3` を小数として読むので、整数の項目では止めます。JavaScript の
  `JSON.parse` が返す値は `1` と `1000` で、整数と見分けられないので、TypeScript 版は読みます。Node.js 26 は、
  値を1つ読むたびに呼ばれる関数（reviver）の3つ目の引数に、書いたままの字面を渡しますが、型の設定（ES2022）の
  `JSON.parse` の型にはその引数が無いので、使っていません。TypeScript は、安全な整数（絶対値が 2**53 未満の
  整数）でない数も止めます。`Number('9007199254740993')` は 2**53 に丸まり、隣の数と区別できません。範囲の
  最小と最大も、`parseDecimal` の最大も、安全な整数に限ります。Python の `int` は大きさに限りが無いので、
  範囲で止めます（`parse_decimal` は、2**53 より大きい数も最大まで読みます）。桁あふれは、Python は小数
  （`1e400`）を読み込みで断ります。桁の多い整数は、4300 桁までは読み込んでから項目の範囲で止め、それを超えると
  `int()` の桁の上限で `json` が `ValueError` を出すので、読み込みで `ReadError` にします。JavaScript は整数も
  小数として読むので、400 桁の整数も読み込みで無限大になり、そこで断ります
- -0：`JSON.parse('-0')` は -0 です。TypeScript の `readInt` は 0 にそろえて返します。`Object.is` で比べる所
  （このリポジトリの Command の既定の比べ方）では、-0 と 0 が別の値になるためです。`readFloat` は -0 のまま
  返します。Python の `json` は `-0` を整数の 0 として読むので、小数の項目でも 0.0 になります（`-0.0` と
  書けば -0.0）
- 閉じた種類：TypeScript の `readChoice` は文字列の配列を受け、その文字列の union の型で返します。Python の
  `read_enum` は `Enum` のクラスを受け、値（`value`）が等しいメンバー（クラスに並べた種類の1つ）を返します。
  読むのは文字列だけです。整数を種類に渡す形にすると、標準ライブラリの3つの振る舞いを、それぞれ先に断る
  必要があります。`IntFlag` は、決めていない
  ビットを含む値を断る指定（`boundary=STRICT`）でも、負の整数を補数として受けます（`READ = 1`・`WRITE = 2`
  の種類 `Access` で、-1 は `READ|WRITE`、-2 は `WRITE`、-4 は何も立てていない値。-5 と 4 は断ります）。
  指定の無い `IntFlag` は、決めていないビットも受けます。`IntEnum` は `True` と `1.0` を 1 の値として受けます。
  文字列からは、整数を値に持つ種類の値を作れない（`Access('3')` は `ValueError`）ので、文字列だけを読めば、
  この3つは起きません。止める文は、候補の値も断った値と同じく `repr` で並べるので、整数を値に持つ種類では
  `'1'（1・2 のどれか）` のように、断ったのが文字列であることが分かります（TypeScript 版も、候補を引用符つきで
  並べます）。
  止めるのは実行時で、型検査は止めません。型変数の上限は `Enum` で、`IntFlag` も `Enum` の仲間なので、
  mypy は `read_enum(obj, key, Access)` を通します。上限を `StrEnum` にすれば mypy が止めますが、文字列を値に
  持つふつうの `Enum`（animal-bomber の動物の種類と CPU の強さ）も通らなくなります。ビットの組を外から
  読むときは、`read_int` で 0 以上と上限を見てから作ります（`Access(read_int(obj, "access", minimum=0, maximum=3))`）。
  3つの振る舞いは、この関数が整数を読まない理由として、テスト（`test_strict_read_enum.py`）に置いています
- 例外：Python の `ReadError` は `ValueError` の子で、`json` が出す例外と同じ仲間です。TypeScript の
  `ReadError` は `Error` の子で、`RangeError` の子にはしていません。ほかの `lib/` の部品は、呼ぶ側の誤りを
  `RangeError` で止めます。外から来た値の誤りは、受け取った側で断って続けることがあるので、同じ `catch` で
  受けないように分けました。元の例外は、Python が `from exc`（`__cause__`）で、TypeScript が `cause`（ES2022）で
  残します。この部品も、呼ぶ側が渡した範囲の誤り（最小が最大より大きい、`parseDecimal`・`parse_decimal` の
  最大が負、TypeScript では最小か最大が安全な整数でない）は `ReadError` にせず、TypeScript は `RangeError`、
  Python は `ValueError` で止めます。Python の `ReadError` も `ValueError` の子ですが、`except ReadError` で
  受ければ、呼ぶ側の誤りは受けません
- 入れ子の深さ：Python の `json` は、入れ子が深いと `RecursionError` を出します。1000 段の入れ子は、3.11 では
  読めず、3.14 では読めました。TypeScript の `JSON.parse` は 1000 万段でも読めますが、無限大を断るために
  reviver を付けると、1 万段で `RangeError` になりました（Node.js 26）。
  どちらも `ReadError` にします。止まる深さは、版と実行環境で違います

見ないものもあります。

- 同じ項目名が2度ある JSON は、どちらの言語も後の値を読みます。`JSON.parse` は後の値を使い、見つける手段が
  ありません。Python は `json.loads` の `object_pairs_hook` で見つけられますが、2つの言語の答えをそろえて、
  断りません。オブジェクトを `JSON.stringify` で書く限り、同じ名前は書かれません。Python の `json.dumps` は
  名前を文字列にしてから書くので、名前が文字列だけの辞書なら重なりませんが、`{1: 'a', '1': 'b'}` のように
  文字列にすると同じになる名前を持つ辞書からは、同じ名前を2度書きます（読み戻すと、後の `'b'` だけが残ります）
- オブジェクトの中の項目は、その項目の名前だけで文を始めます（`config` の中の `size` が無ければ `size が無い`）。
  配列の要素は、配列の名前と位置で始めます
- 文字列の中身（対になっていないサロゲートなど）は見ません
- 小数の項目に書いた 2**53 より大きい整数は、Python でも float にする所で丸まります

型の宣言から読み取りを作るライブラリ（TypeScript の zod、Python の pydantic）は選びませんでした。この
リポジトリは、実行に要る依存を持たないためです（Python の `dependencies` は空で、TypeScript も開発用の
依存だけです）。

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 読み込みと項目の読み取りは、通信の約束の読み取り（[protocol.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/protocol.py) の
  `_load_object` と `_Fields`、[protocol.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/protocol.ts) の
  `FieldReader`）から持ってきました。`NaN`・`Infinity`・`1e400` を断る `parse_constant`・`parse_float`、`True` を
  断る整数の読み取り、`'toString' in` が真になるので `Object.hasOwn` で有無を見ること、です。protocol.py の
  モジュールの説明は、TypeScript 版も断るが Python では通るもの（`bool`・`NaN`・`Infinity`・`1e400`・負の数の
  入力のビット）と、TypeScript 版に無い検査（`1.0`・動物の数・上限）を分けて書いています
- 上限を必ず受ける形にしました。animal-bomber の Python 版は、届いた設定の制限時間と体力に上限
  （`WIRE_INT_MAX`。符号つき 32 ビットの最大）を置いています（TypeScript 版は置いていません）。Python 版の
  状態の要約は 32 ビットに収まる整数しか混ぜられず、上限を置かずに 2**32 近くまで受けると、最初の要約を送る
  時点で全員の端末が例外で止まることが、Python 版のレビューで見つかったためです（コミット 63fc404 の本文）。
  animal-bomber の Python 版の整数の読み取り（`_Fields.integer`）は上限を省け、TypeScript 版（`FieldReader.int`）は
  上限を受けませんが、このリポジトリの `readInt`・`read_int` は省けません
- TypeScript の整数の確認を、`Number.isInteger` から `Number.isSafeInteger` に替えました。animal-bomber の
  通信の約束は `Number.isInteger` で見ていて、2**53 以上の整数も通ります（記録の読み戻しの InputLog.ts は
  `Number.isSafeInteger` で見ています）
- 10 進の整数の読み取りは、操作の記録の読み戻し（[input_log.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/input_log.py) の
  `_ENTRY`、[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts) の
  `decode`）から持ってきました。Python 版は `\d` でなく `[0-9]` で書き、`fullmatch` で全体に当てます。
  TypeScript 版は、`Number` の前に正規表現で形を見ます。記録の文字列は、プレイヤーごとの操作を `|` で区切って
  並べた形（`0:12,8;30,0|1:…`）で、animal-bomber は `|` で区切った1つを区画、区画の最初の `:` より前
  （プレイヤーの番号か、途中で抜けたプレイヤーを表す `departed`）を見出しと呼んでいます。TypeScript 版の記録の
  読み戻しは、以前は読めない区画を例外にせず、見出しの無い区画（`:0,8`）を、`Number('')` が 0 になるので
  プレイヤー 0 の操作として読み、見出しを書き誤った区画（`departd:1,5`）を、番号が NaN のプレイヤーの操作として
  読んでいました。後者では途中で抜けたプレイヤーが記録から消え、再生するとそのプレイヤーの最後の入力を
  使い続け、例外も出ずに別の試合になります。製品にまだ記録の文字列を読む経路が無いうちに、読む側を足す前に
  修正しています（コミット f77ae5d の本文。抜けたプレイヤーの区画の tick が数でないと NaN になり、代わりの
  出どころに替わらない件は、その前のレビューのコミット 67f3fb6 の本文）
- `IntFlag` の負の数の件は、animal-bomber の入力の型の説明（[player_input.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/input/player_input.py)）に
  あります。通信の約束は、入力のビットを 0 以上の整数として読んでから `PlayerInput` にし（protocol.py の
  `_Fields.bits`）、記録の読み戻しは正規表現が `-` を読まないので、どちらにも負の数は届きません
- 1つのメッセージを読むクラス（`_Fields`・`FieldReader`。メッセージの種類の名前を持ち、文の頭に付ける）を、
  項目ごとの関数にしました。文は、メッセージの種類でなく項目の名前で始めます。配列は、要素の形ごとの
  メソッド（整数の配列・番号の配列・報告の配列）の代わりに、要素を読む関数を受け取ります

閉じた種類への読み替えは、data-science-portfolio の着陸の結果の読み取り
（[labeling.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/src/spacex_capstone/preprocessing/labeling.py)）
にもあります。`LandingMethod.from_raw` は、知らない表記を既定の方式に倒さず、`raise ... from exc` で止めます。
一方 `LandingOutcome.parse` は、成否と方式を別々の項目に読むので、`'True None'` から、成功したのに着陸を
試みていない値（`succeeded=True`・`attempted=False`）を作れます（`attempted` の説明には、試みていなければ
`succeeded` は必ず False とあります）。項目を1つずつ厳しく読んでも、組み合わせとしてありえない値は止まりません。
同時には成り立たない値の組があるときは、項目を独立に持たず、設計の型の State（状態を閉じた union で表す）の
ように、状態ごとに持つ値を分けます。

### 決定性を崩す書き方の検査

`lib/` の部品の約束は2段です。

- すべての部品：同じ入力から、起動のたびに同じ結果を出します。乱数と時刻は、引数で受け取ります
- 固定値の表を持つ部品（乱数と状態の要約）：さらに、実行環境と言語をまたいでも、1ビットも違わない
  値を出します。2つの言語の固定値の表で検証します（Design Choice の 2）

1つ目の約束を崩す書き方のうち、次のものを機械で止めています。

- TypeScript：`Math.random`・`Date.now`・`new Date()`・`Date()`・`for...in`。`Math.random` と `Date` は
  ES2022 の一部で、import しなくても使えるので、静的検査（ESLint の `no-restricted-properties` と
  `no-restricted-syntax`）を `src/lib/` に当てています（[eslint.config.js](typescript/eslint.config.js)）。
  `new Date` は、時刻を引数で渡す形（`new Date(0)`）も止めます。`lib/` では `Date` を作りません。
  `performance.now`・`setTimeout`・`crypto` は、型の設定（ES2022 だけで、DOM と Node.js の型を
  入れていない）に無いので、型検査が先に止めます。`for...in` は、並べる順を仕様が実装に任せる
  場合があり（Proxy や型付き配列がかかわるとき、並べている途中で項目を消したときなど）、継承した
  項目まで並べます。順が要る並びは配列で、名前と値の組は `Map`（入れた順を保つ）で持ちます
- Python：`random`・`secrets`・`uuid`・`time`・`datetime` の import と、組み込みの `hash`・`id`。
  テスト（[test_determinism_guard.py](python/tests/lib/test_determinism_guard.py)）が、`lib/` の下の
  ファイルの構文木を読みます。乱数と時刻の主な出どころであるこの5つのモジュールは、import しないと
  使えないので、import で止めます。見るのは、この5つの import だけです（ほかの出どころは、下の
  「見ないもの」に書きます）。`hash` と `id` は import なしで使え、文字列の `hash` とオブジェクトの
  `id` は起動のたびに変わります。呼び出しのほか、`sorted(items, key=id)` のような渡し方も見つけます

検査を書いただけでは、書き誤っていても違反が無ければ通り続けます。Python は、禁じる名前の一覧を
テストに置き、それを正としています。設定から名前を読むだけだと、名前を書き誤っても（`random` を
`randomx` と書いても）緑のままです。そこで、一覧の名前が実在することと、その名前を使う書き方を
実際に見つけることを、手で書いた違反の表で確認しています。TypeScript は、違反を1行ずつ書いた文字列を
静的検査に渡して止まることと、規則がエラーとして `src/lib/` にだけ当たることを、テスト
（[lint-rules.test.ts](typescript/tests/lint-rules.test.ts)）で確認しています。

見ないものもあります。TypeScript は、別の名前を通した呼び出し（`globalThis.Math.random()`、`Math` を
別の変数に入れてから呼ぶもの）と、時刻を読むほかの入り口（`Intl.DateTimeFormat` の `format` を
引数なしで呼ぶもの、など）を見ません。Python は、`importlib` や `__import__` に名前を文字列で渡して
読み込むもの、`builtins` を別の名前で読み込んでから呼ぶもの、`os` の乱数と実時間（`os.urandom`・
`os.getrandom`・`os.times`）、`hash` をメソッドとして呼ぶもの（`'a'.__hash__()`）を見ません。

禁じなかったものと、その理由です。

- `round`：Python の `round` は偶数への丸め（`round(2.5)` は 2）で、TypeScript の `Math.round`
  （`Math.round(2.5)` は 3）と答えが違います。ただ、どちらも同じ入力なら、起動や環境をまたいでも
  同じ値を返すので、決定性は崩しません。崩すのは2つの言語の一致で、それは2つの言語の固定値の表が
  見つけます。起動のたびに変わる値は、たまたま同じ値が出た起動では表のテストを通ってしまうので、
  書き方そのものを止める検査が要ります。表で見つかるものは表に任せ、検査は表で見つけにくいものに
  絞りました。固定値の表を持つ部品は、`round` と `Math.round` を使わず、整数の割り算や
  切り捨て・切り上げで書きます。丸めを使う部品を置くときは、ちょうど半分になる入力を表に入れます
- 三角関数・指数・対数・小数の累乗（`**`・`pow`・`math.pow`・`Math.pow`）：最後の桁が、実行環境や
  言語によって違うことがあります。累乗は、指数が 2 や 0.5 でも違います。同じ Mac で、Python の
  `1.509 ** 2` は 2.2770809999999995、JavaScript の `1.509 ** 2` は 2.277081 でした（`1.509 * 1.509` は
  どちらも 2.277081）。`0.977 ** 0.5` も、Python は 0.9884331034521253、JavaScript は
  0.9884331034521254 で、平方根（`math.sqrt` と `Math.sqrt`）はどちらも 0.9884331034521254 でした。
  四則演算と平方根は、IEEE 754 が正確な丸め（真の値にいちばん近い数を返すこと）を求めているので、
  同じ入力なら環境と言語をまたいでも同じ値になります。固定値の表を持つ部品は、これらの計算を
  使わず、2乗は `x * x` と掛け算で、平方根は `math.sqrt` と `Math.sqrt` で書きます。食い違う入力は
  まれで、固定値の表では見つけにくいためです。禁じないのは、固定値の表を持たない部品なら使って
  よいためです
- 小数の `sum`：Python 3.12 で小数の合計の出し方が変わり、`sum([0.1] * 10)` は 3.11 では
  0.9999999999999999、3.12 からは 1.0 です。このリポジトリは、検査を 3.11 と新しい版の両方で通すので、
  固定値の表が見つけます
- `set` を順に取り出すこと：Python で文字列や Enum の `set` を順に取り出すと、その順は起動のたびに
  変わります（並びを決める文字列の `hash` が起動ごとに変わり、Enum の `hash` は名前の文字列の
  `hash` であるため）。Enum は決まった値に見えるので、気づきにくい所です。いまの `lib/` には
  `set` を順に取り出す部品が無いので、検査を置いていません。置くときは、`sorted` で順を決めてから
  取り出します。TypeScript の `Set` と `Map` は入れた順を保つので、この問題はありません

検査の形は animal-bomber から持ってきました。組み込みの関数を構文木で探す検査
（[test_builtins.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/boundary/test_builtins.py)）、
禁じる名前を正の一覧で持つ形（[banned_names.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/boundary/banned_names.py)）、
ESLint の2つの規則（[eslint.config.js](https://github.com/nakatama225/animal-bomber/blob/main/ts/eslint.config.js)）です。
禁じる基準（乱数の出どころ・実時間の出どころ・環境で結果が違いうる計算）は
[01-層とは何か.md](https://github.com/nakatama225/animal-bomber/blob/main/py/docs/01-層とは何か.md) にあります。
変えた点は次のとおりです。

- 禁じる範囲を狭めました。animal-bomber は、`round`・`sum`・小数の累乗（`pow` と `**`）、三角関数
  などの `math` の関数、`numpy` と `cmath`、`os` の乱数と実時間（`os.urandom`・`os.getrandom`・
  `os.times`）、TypeScript の `performance.now` と三角関数なども禁じています。このリポジトリは、
  上の理由で、`round` と `sum` は固定値の表に任せ、累乗と三角関数など（`cmath` を含みます）は、
  固定値の表を持つ部品で使わないことにしました。Python で禁じる名前は、乱数と時刻の主な出どころの
  5つのモジュールと `hash`・`id` に絞り、`os` の3つは見ていません。`lib/` で `os` を使う部品を
  置くときに、一覧に足すかを決めます。`numpy` は依存に含めていないので、読み込めません。
  `performance.now` は型検査が止めます
- 止める書き方を2つ足しました。TypeScript の `new` を付けない `Date()`（引数を渡しても無視し、いまの時刻を
  文字列で返します）と、Python の `from builtins import id as …` の形です。animal-bomber は、
  `new` を付けた `Date` と、`builtins.hash` のような属性の形だけを見ています
- Python の import の検査を、テストの構文木の検査1つにしました。animal-bomber は、ruff の規則（TID251）と
  import-linter の2つで重ねています。組み込みの関数は ruff の規則では見られず、構文木の検査が要るので、
  import もそこで見ます。ruff の規則は行末の `# noqa` で黙らせられますが、構文木の検査は
  行末の注釈では黙りません
- hash の種を変えた子プロセスで同じ処理を走らせて突き合わせる検査
  （[test_hashseed.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/determinism/test_hashseed.py)）は
  持ってきていません。上の `set` の段落のとおり、いまの `lib/` には、それで見つかる部品が無いためです。
  animal-bomber では、要素が2つの文字列の `set` は、3つの種で順がたまたま同じになることが4組に1組ほど
  あり、種を9つに増やしています

## 置いてある設計の型

| 型 | 何を解くか | TypeScript | Python |
|---|---|---|---|
| Command（命令を値として渡す） | 1歩ずつ進む処理と、「その歩で何をするか」を決める側を切り離す。記録と再生が、部品を1つ挟むだけで作れる。遅れて届く命令は、届いた範囲を持つ記録（`ArrivalLog`）で受け取ると、まだ届いていない歩を読んだときに止まる。出どころは、いくつかを合わせる（`CombinedSource`）ことも、途中で代わりに替える（`HandoverSource`）こともでき、どちらも処理の側は変わらない | [command.ts](typescript/src/patterns/command.ts)、[command-sources.ts](typescript/src/patterns/command-sources.ts) | [command.py](python/src/algorithms_and_patterns/patterns/command.py)、[command_sources.py](python/src/algorithms_and_patterns/patterns/command_sources.py) |
| Strategy（答え方を差し替える）と登録表 | 同じ問いへの答え方を名前で引けるように並べる。答え方を足すときに、使う側と既存の答え方を触らない | [strategy.ts](typescript/src/patterns/strategy.ts) | [strategy.py](python/src/algorithms_and_patterns/patterns/strategy.py) |
| Chain of Responsibility（規則を優先順に試す） | 1つの長い if の連なりを、独立した規則の並びにする。規則を足す・外す・入れ替えるのが、並びの1行の操作になる | [chain-of-responsibility.ts](typescript/src/patterns/chain-of-responsibility.ts) | [chain_of_responsibility.py](python/src/algorithms_and_patterns/patterns/chain_of_responsibility.py) |
| State（状態を閉じた union で表す） | 取りうる状態を型で閉じ、状態ごとに持つ値を分ける。状態を足したときの扱い忘れを、型検査が見つける。値を返さない分岐の書き忘れも、型検査と静的検査の設定で見つける。種類ごとの性質を1か所にまとめると、共通の処理は種類を見ずに性質だけで書ける | [state.ts](typescript/src/patterns/state.ts)（性質の表の見本は [state-traits.test.ts](typescript/tests/patterns/state-traits.test.ts)） | 部品は無し（標準ライブラリで足りる）。書き方の見本は [test_state.py](python/tests/patterns/test_state.py) と [test_state_traits.py](python/tests/patterns/test_state_traits.py) |
| 単位を型で分ける（ブランド型） | 実行時は同じ数でも意味の違う値（区間ごとに 0 へ戻る番号と通しの番号、メートルと秒など）を別の型にし、取り違えを型検査に見つけさせる | [brand.ts](typescript/src/patterns/brand.ts) | 部品は無し（`typing.NewType` で足りる）。書き方の見本は [test_brand.py](python/tests/patterns/test_brand.py) |

### Command の届いた範囲を持つ記録

`CommandLog` は、記録より先の歩を読むと、最後の命令を返します。記録を再生するだけなら、
それで足ります。ところが、命令が通信などで遅れて届くときに同じ記録を使うと、まだ届いていない
歩を読んでも、それらしい命令が返ります。届く前に読んだ側だけが別の命令で進み、例外も出ずに
結果がずれます。`ArrivalLog` は、どの歩まで届いたかを持ち、まだ届いていない歩を読むと止まります。
読む側は、`has` で届いたかを見てから読みます。`ReplaySource` には、`CommandLog` と同じように
そのまま渡せます。

命令は、歩の順に1つずつ受け取ります。飛んだ歩・戻った歩・同じ歩の2度目は断り、断ったときは
届いた範囲も記録も変えません。飛んだ歩を受け付けると、抜けた歩には直前の命令が続いて見え、
本当の命令が後から届いても、もう受け取れません。負の歩（TypeScript は小数の歩も）は、届いたかを
問う `has` でも止めます。数え間違いの結果なので、届いた・届いていないのどちらでも答えません。
animal-bomber の `has` は、負の時刻に「届いている」と答えます。

届いた範囲（`arrived_through`・`arrivedThrough`）は、中に持つ `CommandLog` が最後に受け付けた歩
（`last_step`・`lastStep`）をそのまま使い、別に数えません。`CommandLog` は、命令が変わらず
記録を増やさなかった歩でも、最後に受け付けた歩を進めるので、同じ命令が続く間も範囲が進みます。
最後に受け付けた歩を変わった歩だけで数えると、範囲が進まないうえに、同じ命令が続いたあとに
戻った歩も見逃します。animal-bomber では、Python 版の記録（input_log.py の `InputLog`）が、
何も足さなかったときも最後に頼まれた時刻を進める形にして、この見逃しを塞ぎました。
このリポジトリの `CommandLog` は、最初からこの形です。

中に持つ `CommandLog` は外に出しません。外から `record` を呼べると、順に受け取る約束を通らずに
歩を飛ばせるためです。届いた命令を保存するときは、`entries()` と届いた範囲を一緒に残します。
一覧だけでは、最後に変わった歩より先のどこまで届いていたかが分かりません。`CommandLog` の
`entries()` と最後に受け付けた歩を一緒に残すのと同じです。

animal-bomber の `ConfirmedInputs` は、通信で届いた命令を1つの記録（`InputLog`）にまとめて持ち、
届いた範囲は記録とは別に、プレイヤーごとに持っています。このリポジトリの `ArrivalLog` は1本の
命令の列を受け取るので、範囲も1つです。出どころが複数あり、それぞれ別々に届くなら、`ArrivalLog` を
出どころごとに1つ作ります。手元で出した命令も、遠くから届く命令と同じだけ遅らせて
`ArrivalLog` を通します。手元の命令だけを先に使うと、手元でだけ先に進んでずれます。

### Command の出どころを合わせる・途中で替える

出どころは、組み立てても1つの出どころのままです。処理の側は、組み立てたかどうかを知らず、
1行も変わりません。組み立てる部品は、記録と再生（`command.ts`・`command.py`）とはファイルを分け、
`command-sources.ts`・`command_sources.py` に置きました。記録と再生の約束と、出どころの組み立て方は、
別の理由で変わるためです。

`CombinedSource` は、いくつかの出どころの命令を、呼ぶ側が渡す合わせ方で1つにします。毎歩、並びの
順に全部の出どころに聞いてから合わせ、答えが途中で決まっても打ち切りません。前の歩を覚えている
出どころは、聞かれなかった歩のぶん覚えている内容が古くなり、次に聞かれたときにずれます。記録する
出どころ（`RecordingSource`）なら、その歩の記録が抜けます。空の並びは、作るときに止めます。
出どころを繋ぎ忘れたまま、空の並びを合わせた命令（真偽の組の OR なら全部が偽）で黙って進めない
ためです。同じ出どころを2度並べると、1歩に2度聞きます。重なりは見分けません。

`HandoverSource` は、途中から代わりの出どころに任せます。いつ替わるかは、出どころの中ではなく、
替わる歩を1度だけ決めて持つ記録（`Handover`）に置きました。前の出どころを最後に使う歩（`after`）を
決めると、その次の歩から「替わった」と答えます。届いた命令で進める側と、保存した記録を再生する側に、
同じ歩を決めた記録を渡すと、どちらも同じ判定（`replaced_at`・`replacedAt`）で同じ歩に替わります。
再生する側の記録は、保存した `after` から作り直します。そのため、保存するときは、命令の記録と一緒に
`after` を残します。代わりの出どころの命令は保存せず、再生する側も同じ作り方で作り直します。
代わりの命令まで記録して再生すると、替わる歩を渡さなくても結果が一致するので、2つの側が同じ歩に
替わることをテストで示せません。テストは、代わりの命令を保存しない形にしています。

採らなかった形が2つあります。1つは、替わる歩を出どころ自身に持たせる形です。保存した歩から再生する
側を作り直すのは今の形と同じで、保存した歩がずれたときに部品の中で見つけられないのも同じです
（テストは、今の形で再生する側だけ1歩ずらし、例外が出ずに命令の列だけが変わることを示しています）。
それでも今の形にしたのは、替わったかの判定を1つのクラスに置き、出どころはそれを読むだけにするため
です。替わる歩を決める側（命令がもう届かないと知る側）は記録だけを持てばよく、出どころがほかの
出どころに包まれていても、その出どころを持たずに決められます。もう1つは、替わったかを答える
関数を受け取る形です。一度「替わった」と答えたあとで「替わっていない」と答える関数も渡せるので、
その扱いを決める必要が出ます。1度しか決められない記録なら、判定は「決めた歩より後か」だけになり、
一度替わったら元に戻りません。

代わりは、初めて任せる歩で1度だけ作り、それより前には作りません。作り直すと、代わりの出どころが
覚えている内容（前の歩までの判断）を失います。処理の側が替わる歩でこの出どころに聞かなければ、
作るのはそれより後の歩になります。作るときに状態を読まない出どころなら、作る歩がずれても
同じ命令を返します。

部品の中で見つけられる誤りと、見つけられない誤りがあります。

- 2度目の決定は断ります。上書きを受け付けると、先に読んだ側と後で読んだ側で替わる歩が食い違います
- 前の出どころで答えた歩より前を替わる歩に決めると、次に替わったあとの歩を聞かれたときに止まります。
  同じ記録を再生する側は、その歩を代わりに任せるので、2つの側がずれるためです。決めた時点では
  止めません。記録は、どの歩をもう前の出どころで答えたかを知らないためです。前の出どころが命令を
  返さずに例外を出した歩（届いていない歩を読んだ、など）は、答えた歩に数えません
- 替わる歩を決め忘れると、届いた範囲を持つ記録（`ArrivalLog`）を読む進める側は、届いていない歩を
  読んだ所で止まります。ところが、替わる歩を保存し忘れた記録を再生する側は、`CommandLog` が最後の
  命令を返し続けるので、例外も出ずに別の結果になります。部品の中では見つけられないので、命令の記録と
  `after` を一緒に保存する約束で防ぎます（テストに、決め忘れたときの2つの側の振る舞いを並べています）
- 片方の側だけが決める誤り（再生する側に `after` を渡し忘れる）は、保存し忘れと同じ形になり、
  部品の中では見つけられません。保存した `after` が1歩ずれたときも同じで、例外は出ずに命令の列だけが
  変わります（テストに、再生する側だけ1歩ずらした場合を置いています）

どちらの部品も animal-bomber から持ってきました。animal-bomber では、同じプレイヤーをキーボードと
ゲームパッドのどちらでも動かせるように、2つの出どころをボタンごとの OR で合わせています。全部を毎回
読む理由（打ち切ると、読まれなかった機器が前の状態を覚えたままになる）は、TypeScript 版の
`CombinedInputSource` の注記にあります。Python 版の `EitherSource` は、ほかのプレイヤーの出どころが
混ざると作る時点で止めます。全員の出どころから1歩ぶんを集める `InputGatherer` は、出どころの無い
プレイヤーを何もしない入力で埋めず、どの出どころにも聞く前に止めます。埋めると繋ぎ忘れが黙って
通るためで、誰も操作していないプレイヤーには、何もしない出どころ（`IdleSource`）を明示して渡します。
どれもプレイヤーの区別があって初めて書ける検査なので、このリポジトリの `CommandSource` には
現れません。何もしない出どころも部品にはせず、テストの中で並びに明示して置く見本だけにしています。

途中で替わる出どころは、通信対戦の途中で抜けたプレイヤーを CPU に任せる所から持ってきました。
animal-bomber は、替わったかの判定を操作の記録の1か所（input_log.py の `InputLog.replaced_at`。
最後に使う時刻の次から真）に置き、通信で届いた操作を渡す出どころ（confirmed.py の
`NetworkInputSource`）と、記録を再生する出どころ（`ReplayInputSource`）が同じ判定を読みます。
通信で進める側（lockstep.py の `LockstepDriver`）も、届いた操作を待つかどうかを同じ判定で決めます。
替わる時刻は操作の記録の中にあり、記録を文字列にする `InputLog.encode` が操作と一緒に書くので、
替わる時刻だけを保存し忘れることがありません。このリポジトリは、替わる歩の記録（`Handover`）を
命令の記録（`CommandLog`・`ArrivalLog`）と別の物にしたので、`after` を一緒に残す約束が要ります。
代わりは `Replacement` が、初めて任せる時刻に1度だけ作ります。TypeScript 版は、通信で進める側
（`LockstepDriver`）が、試合に繋いだ出どころを代わりに差し替えます（記録を再生する出どころ
`ReplayInputSource` は、中で替えます）。Python 版は、どちらの側も出どころの中で替えます。
このリポジトリは Python 版の形にしました。処理の側に、出どころを差し替える仕組み（TypeScript 版の
`attach`）が要らないためです。

### 単位を型で分ける（ブランド型）

区間ごとに 0 へ戻る番号と、始めから通して数える番号は、どちらも整数で、最初の区間の間は値まで
同じです。片方を受け取る所へもう片方を渡しても型検査は止めず、最初の区間だけを使うテストも
通ります。違いが出るのは2つ目の区間からです。意味ごとに別の型にしておくと、区間の数によらず、
取り違えを型検査が止めます。TypeScript は、数に型の上だけの印を付けた型（ブランド型）を
`Brand<number, 'OverallIndex'>` と書きます。Python は標準ライブラリの `typing.NewType` で足ります。
どちらも実行時はただの数で、変換の手間はかかりません。

守られるのは片方向だけです。

- 印の付いた値は、ただの数を受け取る所へそのまま渡せます
- ただの数や別の印の値を、印の付いた値を受け取る所へ渡すと、型検査が止めます
- 印の付いた値どうしを足すと、ただの数に戻ります。次の番号も、もう一度印を付けて作ります
- 印を付ける書き方（TypeScript の `as`、Python の `NewType` の呼び出し）は、ただの数ならどれにも使え、
  型検査を通ります（TypeScript で別の印の値に付けるときは、ただの数を経れば通ります。下の「言語で形が
  変わったところ」）。区間の中で数えた値に、通しの番号の印を付けても止まりません。この穴は型では
  塞げないので、印を付ける場所を少なくして防ぎます

animal-bomber では、盤面の時刻（ラウンドごとに 0 へ戻る）と、試合を通して数える時刻が、この関係でした。
TypeScript 版は、操作の記録と再生に盤面の時刻を使っていたので、2ラウンド目の記録が「tick が戻っている」
として止まりました。1ラウンド目は2つの時刻が同じ値なので、型でもテストの値でも見つかりませんでした。
TypeScript 版は、記録と再生に試合の時計（InputLog.ts の `MatchClock`）を渡す形に改め、時刻の型は
分けていません。Python 版は、最初から2つを別の型（tick.py の `Tick` と `MatchTick`）にしました。
それでも、盤面の時刻を包む書き方（`MatchTick(world.now)`）は型検査を通ります。そこで、試合を通して
数える時刻を作ってよい場所を、時計のクラス（`MatchClock`）と、保存した文字列や通信で届いた文字列から
時刻を読み戻す2か所に限り、ほかで作るとテストが失敗するようにしました（test_match_tick.py が構文木を
読んで探します）。次の時刻を求める足し算も時計のクラスに置き、作る場所を増やさないようにしています。
名前を文字列で参照する書き方（`getattr` など）は、このテストでも見つけられません。このリポジトリには
印の付いた値を作る処理が無いので、この検査は置いていません。

TypeScript の形は、animal-bomber から変えています。animal-bomber は、型ごとに別の項目を持つ形
（`number & { readonly __tick: unique symbol }`。Tick.ts の `Tick`、EntityId.ts の `EntityId`）で書いています。
このリポジトリは、印を文字列で渡す総称型（`Brand<T, B>`）を1つ置きました。印を置く項目（`unique symbol`）は
部品の中に1つだけあり、型ごとには印の文字列を渡すだけで済みます。
取り違えたときの型エラーに印の文字列がそのまま出ます（`"SectionIndex"` を `"OverallIndex"` の所へ
渡せない、など）。その代わり、同じ文字列の印を別の名前で2度定義すると、同じ型になって区別できません
（テストに書いています）。型ごとに別の項目を持つ形なら、同じ名前の項目を書いても別の型になります。

### State で処理の結果を返す：起きたことの列

閉じた union は、状態のほかに、処理の結果にも使えます。1刻みの処理が音・画面・通知を自分で呼ばず、
起きたこと（置かれた・壊れた・拾われた…）を閉じた union の列にして、起きた順に返します。どう見せるかは、
受け取った側が決めます。受け取る側は種類ごとの扱いを State と同じ分岐で書くので、種類を足したときの
扱い忘れを型検査が見つけます。

animal-bomber の原型（ブラウザで動く最初の版）は、盤面を進める処理（`update()`）の中から、
効果音を 53 か所、画面の書き換えを 17 か所、通知の表示を 17 か所で直接呼んでいたので、画面を描かずに
ルールだけを動かす方法がありませんでした（TypeScript 版の SimEvent.ts の説明）。animal-bomber は、起きたことを返すだけの形にしました。検証のときは
受け取らなければよく、音を消す設定もテスト用のモードも要りません。CPU どうしの4体の試合（43,000 刻み）が、
画面なしで1秒かからずに動きます（TypeScript 版の
[02-CPUの判断.md](https://github.com/nakatama225/animal-bomber/blob/main/ts/docs/02-CPUの判断.md)）。

列に何を載せるかにも決まりがあります。

- 受け取る頃には状態から分からなくなるものは、載せます。プレイヤーの体力が尽きた知らせ（events.py の
  `PlayerDown`）は、尽きたときの位置を運びます。同じ刻みのうちに延長戦へ移ると、受け取る頃には
  開始位置へ移っているためです
- 見せてはいけないものは、載せません。技の途中で起きたことの知らせ（`TechniqueMoment`）はマスを
  運びません。掘り終えた穴の位置を描画の側に渡すと、見えないはずの穴が分かってしまうためです
- 受け取る側が列の中身の有無で判断するなら、意味の違う知らせを同じ列に混ぜません。技の結果
  （[results.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/abilities/results.py) の
  `Started`）は、技を出せなかった知らせを、技を出した瞬間に起きたことの列と別の項目に置いています。
  技を出す処理は、その列に1つでもあれば技が出たとみなすので、混ぜると技を出した音まで鳴ります
- 状態を丸ごと作り替える処理は、1刻みの処理の中に置きません。ラウンドの判定は、続ける・延長戦に入る・
  終わるの3つの union（round.py の `RoundVerdict`）を返すだけで、次の盤面は試合を進める側が作ります。
  1刻みの中で盤面が入れ替わると、「1回呼ぶと1刻み進む」の約束が崩れ、記録の再生が追えなくなります

### 言語で形が変わったところ

#### Command

- 命令の出どころの型引数：Python の `Protocol` は、型引数が「受け取るだけ」か
  「返すだけ」かを宣言しないと、型検査（mypy）が定義そのものを受け付けません。
  TypeScript は使われ方から推し量るので宣言は要りませんが、**メソッドの形で書いた引数は
  向きを検査しません**。そのままだと、より多くを知っている状態を前提にした出どころを
  渡しても型エラーにならず、実行して初めて落ちます。TypeScript 版は関数を持つ項目の形で
  書き、検査させています（両方の言語に、渡せないことを確認するテストがあります）。
  この形は静的検査（ESLint の `method-signature-style`）で強制しているので、新しく書く
  interface をメソッドの形で書くと、静的検査が止めます。Python の `Protocol` は、型検査（mypy）が
  向きを検査するので、この設定は要りません
- 静的検査の規則が働いていることの確認：`method-signature-style` は animal-bomber の設定
  （[eslint.config.js](https://github.com/nakatama225/animal-bomber/blob/main/ts/eslint.config.js)）から
  持ってきました。animal-bomber は、引数を狭めた実装が型エラーになることを1つのファイル
  （[variance.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/boundary/variance.test.ts)）に
  まとめていますが、このリポジトリでは型ごとのテスト（`command.test.ts`・`command-arrival.test.ts`・
  `chain-of-responsibility.test.ts`）に置いています。また animal-bomber は、規則が働いていることを、
  違反を書いたファイルで検査のコマンドを動かして確認しています。このリポジトリは、
  規則を外す注釈を付けた違反を1つテストのファイルに置き、
  注釈が何も外していなければ静的検査を失敗させる設定（`reportUnusedDisableDirectives` を
  `error`）にしています。規則が働かなくなると注釈が使われなくなり、静的検査が失敗します。
  この設定は animal-bomber には無く、このリポジトリで足しました。ESLint の既定は警告で、
  警告だけなら静的検査は成功で終わるので、エラーにしています。ただし注釈で分かるのは
  規則が外れたことだけで、規則を警告に下げても、当てる範囲を狭めても、注釈は使われたままです。
  規則がエラーであることと `src/` に当たることは、テスト（[lint-rules.test.ts](typescript/tests/lint-rules.test.ts)）で
  確認しています
- 命令が同じかの判定：TypeScript は比べ方を引数で受けます（既定は `Object.is`。
  オブジェクトどうしなら「同じものか」を比べる）。Python は比べ方を命令のクラスの側
  （`__eq__`）が決めるので、引数を設けていません。dataclass は項目ごとに比べる `__eq__` を
  作ります。`__eq__` を持たない普通のクラスは「同じものか」で比べます
- 歩の番号の確かめ方：TypeScript の `number` は整数と小数を区別しないので、
  整数かどうかを実行時に確かめます。Python は `int` があるので、型検査に任せます
- 記録の探索：Python は標準の `bisect`、TypeScript は `lib/` の二分探索（`bisectRight`）を使います
- 記録を読む口（`CommandLookup`）：`ReplaySource` は、歩の番号から命令を返す `at` を持つものを
  受け取ります。Python は `Protocol`、TypeScript は関数を持つ項目の interface で書いています。
  どちらも、`CommandLog` と `ArrivalLog` のクラスのメソッドが、継承せず、`implements` も書かずに
  そのまま当てはまります。`at` は状態を受け取りませんが、歩の番号の引数にも、上の出どころと同じ
  向きの問題があります。TypeScript でメソッドの形で書くと、歩の型を狭めた `at`
  （例：`(step: 0 | 1) => C`）を渡しても型エラーになりません。関数を持つ項目の形なら、型検査が
  止めます（両方の言語に、渡せないことを示すテストがあります）
- 届いていない歩を読んだときの例外：Python は `LookupError`（`IndexError` と `KeyError` の親）で、
  負の歩の `ValueError` と型で分かれます。JavaScript の組み込みの例外には、探す物が無いことを表す
  型が無いので、TypeScript 版はどちらも `RangeError` にして、文面で分けています
- 出どころを組み立てる部品の例外：合わせる出どころが無いときは、Python は `ValueError`、TypeScript は
  `RangeError` です。TypeScript は、`command.ts` のほかの止め方と、`lib/` の乱数の「空の列からは
  選べない」に揃えました。替わる歩の2度目の決定は、Python は `ValueError`、TypeScript は `Error` で、
  Strategy の2度目の登録と同じです。前の出どころで答えた歩より前を替わる歩に決めたと分かったときは、
  Python は `RuntimeError`、TypeScript は `Error` です。受け取った歩の番号が誤っているのではなく、
  記録と出どころの食い違いなので、Python は `ValueError` にしていません
- 合わせる出どころの並びの持ち方：Python は並びを tuple で受けます（list を渡すと型検査が止めます）。
  tuple は作ったあとで書き換えられません。TypeScript は配列を写して持ちます。渡した配列をあとで
  空にされても、空の検査をすり抜けません
- 型引数を書く場面：両方の言語に、状態の型を推し量れない場面があります。TypeScript は、状態を
  数で表した出どころから状態の型を推し量れません（`Readonly<S>` を数からたどると、数のメソッドを
  並べた型になります）。関数の引数の位置に書いても、型注釈つきの変数に代入しても同じで、型引数
  （`new HandoverSource<number, Move>(…)`）を書くと通ります。Python の型検査（mypy）は、状態を
  何でも受ける出どころ（`ReplaySource`）と、整数の状態を前提にした代わりを `HandoverSource` に渡すと、
  期待する型が無い所（型注釈の無い変数など）では状態の型を `object` と推し量り、代わりを
  受け付けません。関数の引数の位置や型注釈つきの変数のように、期待する型がある所なら通ります。
  型引数（`HandoverSource[int, Move](…)`）を書いても通ります

#### Strategy

- 登録の書き方：Python はデコレータ（`@registry.register("名前")`）で、定義と登録を
  同じ場所に書けます。関数にもクラスにも付けられます。TypeScript のデコレータは
  クラスとその中身にしか付けられないので、登録は `add` の呼び出しで書きます
- その代わり、Python のデコレータはモジュールが import されたときに走ります。
  どこからも import されないモジュールに書いた答え方は、登録されません。
  答え方を別々のモジュールに分けるなら、登録を集める1か所で、それらを並べて import します。
  TypeScript は登録を集める1か所で呼び出すので、読み込み方で登録の有無が変わりません。
  Python でも `add` を1か所で呼べば同じ性質になります。差が出るのはデコレータで書いたときだけです
- 答え方の型：どちらの言語でも、ただの関数を答え方にできます。ただし Python で
  `__call__` だけを持つ `Protocol` を答え方の型にすると、型検査（mypy）は引数の名前まで
  照らし合わせ、名前の違う関数を渡せません。名前を問わないなら、引数を位置専用（`/`）に
  します。TypeScript の関数の型は、引数の名前を照らし合わせません
- デコレータを付けたあとの型：Python の型検査の上では、デコレータを付けた関数は
  登録表の型として扱われ、元の関数だけが持っていた引数や属性が見えなくなります
  （実行時は元の関数のままです）。元の型のまま使いたい関数は `add` で登録します
- 答え方を、省ける関数の項目の組にする形：答え方がいくつかの点だけを差し替えるなら、
  関数1つでなく、省ける項目の組にできます。省いた点は既定の動きのままです。Python は
  項目を `None` を持てる型にして、既定値を `None` にします。TypeScript は省ける項目（`?`）に
  します。`exactOptionalPropertyTypes`（このリポジトリの設定でも有効）のもとでは、項目に
  `undefined` を明示すると型エラーになるので、省くときは項目そのものを書きません。
  animal-bomber の CPU の戦い方がこの形です（[AnimalTactic.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/tactics/AnimalTactic.ts)、
  [tactics.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/tactics.py) の `Tactic`）

#### Chain of Responsibility

- 規則の形：TypeScript は名前と関数を持つオブジェクト、Python はただの関数です。
  TypeScript の関数の名前（`.name`）は、並びの中にじかに書いた無名関数だと空文字になるので、
  名前を別に持たせています。Python の `def` は必ず名前（`__name__`）を持ちます。
  ただし Python でも、ラムダ式の名前は `<lambda>` で、記録には使えません
- 先頭から答えを探す書き方：Python は `next()` と生成式で1行に書けますが、for 文にしています。
  生成式の中から StopIteration が出ると、Python は RuntimeError に置き換えます（PEP 479）。
  規則の中で既定値なしの `next()` を空の並びに使う、というよくある書き間違いが、
  別の例外に化けて届きます
- 「次に譲る」を表す値：TypeScript は答えの型から null と undefined を外す制約
  （`R extends NonNullable<unknown>`）を書けるので、答えに null を使うと型エラーになります。Python の型変数では「`None` 以外」を
  表せないので、答えに `None` を使わないことは約束として書くしかありません
- 規則の状況の型の向きは、Command と同じ理由で、TypeScript では関数を持つ項目の形で宣言しています

#### State

- 扱い忘れを見つける部品：TypeScript は `assertNever`（引数の型が `never` の関数）を
  自分で書きます。Python は標準ライブラリに `typing.assert_never`（3.11 以降）があります。
  **Python 側には置く部品が無い**ので、`patterns/` にファイルを置かず、書き方の見本と
  それで守られることを、テスト（`python/tests/patterns/test_state.py`）に置いています
- 状態の見分け方：TypeScript は各状態に印の項目（`kind`）を持たせ、その値で見分けます。
  Python はクラスそのものが印になり、`match` の `case Connecting(attempt=n):` で、
  見分けるのと値を取り出すのを1行で書けます
- 書き換えの禁止：TypeScript の `readonly` は型検査だけの約束で、実行時には止まりません
  （止めるなら `Object.freeze`）。Python の frozen dataclass は、型検査でも実行時にも止まります
- 種類ごとの性質の表：TypeScript は、表を `Record<種類, 性質>` に `satisfies` で当てると、表の鍵の集合が
  union の種類から決まります。種類を1つ書き忘れると `satisfies` を書いた行が、無い種類の名前を書くと
  その行が、型エラーになります。Python の `dict` の型（`dict[Kind, Traits]`）は、鍵がすべてそろっているかを
  表さないので、書き忘れても mypy は通ります。そこで Python は、性質を返す関数を `match` と `assert_never` で
  書きます。列挙を鍵にした `dict` で持つなら、鍵の集合を列挙のすべてと比べるテストを置きます（どちらも
  `test_state_traits.py` に見本があります）。`TypedDict` なら鍵をすべて書かせられますが、鍵は名前を手で
  並べるので、種類を足しても鍵は増えず、足した種類の書き忘れは見つかりません。TypeScript で表を
  `Record` と `satisfies` で書く形は、animal-bomber の TypeScript 版に無く、このリポジトリで足しました
- 値を返さない分岐の書き忘れ：値を返す関数なら、どちらの言語の型検査も「値を返さずに抜ける道がある」
  として止めます。値を返さない関数で、最後に `assert_never`・`assertNever` を呼ぶ分岐を書かずにいると、
  型検査は止めず、扱っていない状態は黙って何もせずに通ります。Python は mypy の `exhaustive-match` を
  有効にしています（`pyproject.toml`）。`case _:` の無い `match` で、扱っていない種類が残っていれば
  `match` の行で止めます。strict にも含まれず、既定では切ってあります。`case _:` のある `match` は
  見ないので、`case _:` で残りをまとめて受けると、足した種類も黙ってそこで扱われます。Python で
  `case _:` を書くのは、`assert_never` を呼ぶときだけにします。TypeScript は静的検査の
  `switch-exhaustiveness-check` を `src/` と `tests/` の全部に当てています（`eslint.config.js`）。型の情報を
  使う規則で、`recommendedTypeChecked` には含まれていません。`default` があっても、書いていない種類が
  残っていれば止める設定にしました。`default` で残りをまとめて受けると、足した種類も黙ってそこで
  扱われるためです。どちらも、わざと書き忘れた見本をテスト（`test_state.py`・`state.test.ts`）に置き、
  注釈（`type: ignore[exhaustive-match]`・`eslint-disable-next-line`）で外しています。設定から外すと
  注釈が使われなくなり、検査が失敗します。TypeScript の規則の強さと当たる範囲と選択肢の働きは、
  `lint-rules.test.ts` が見ています。型の情報が要る規則なので、型の情報を使う設定のまま、実在するファイルの
  パスに書き忘れた `switch` の文字列を渡して、エラーとして止まることを見ます（ディスクに無いパスでは、
  規則を当てる前に止まります）。この規則は animal-bomber の TypeScript 版の設定に無く、このリポジトリで
  足しました
- mypy の版：`exhaustive-match` は mypy 1.17 からあります。それより古い mypy は、設定に書いても1行の
  警告を出すだけで、検査を切ったまま通ります（animal-bomber の Python 版の `pyproject.toml` の説明。
  このリポジトリでも 1.16.1 で同じ振る舞いになりました）。このリポジトリの `uv.lock` はもともと 2.3.1 を
  固定していたので、使う版は変わりませんが、`pyproject.toml` の下限を `>=1.17` と明記しました。
  古い mypy では、上の見本の `type: ignore[exhaustive-match]` が使われていない注釈として失敗するので、
  検査が切れたことにも気づけます

#### 単位を型で分ける

- 部品：TypeScript は印を付けた型（`Brand`）を自分で書きます。型だけで、実行時には何も残りません。
  Python は標準ライブラリの `typing.NewType` で足りるので、`patterns/` にファイルを置かず、書き方の
  見本をテスト（`python/tests/patterns/test_brand.py`）に置いています
- 型の見分け方：TypeScript の `Brand` は印の文字列で見分けるので、同じ文字列なら、別の名前で定義しても
  同じ型になります。mypy は `NewType` を定義した場所で見分けるので、同じ名前でも別のモジュール（や関数の
  中）に定義すれば、別の型になります
- 印を付ける書き方の穴の広さ：TypeScript は、別の印の値に `as` でそのまま印を付けると、2つの型が
  重ならないとして型エラーになります。ただの数（`number`）を経れば通ります。Python の `NewType` は `int`
  を受け取るので、`int` を元にした別の `NewType` の値にも、そのまま印を付けられます（animal-bomber の
  `MatchTick(world.now)` はこの形です）
- 実行時：どちらも実行時はただの数で、印で見分けることはできません。Python の
  `isinstance(x, OverallIndex)` は実行時に `TypeError` になり、mypy も止めます

### Strategy と State は逆の性質を持つ

Strategy は、答え方を後から足せる代わりに、どんな答え方があるかが型に現れません。
名前の書き間違いは、引くまで分かりません。State は、取りうる状態を型で閉じる代わりに、
状態を足すたびに、それを扱う分岐をすべて直します。直し忘れは型検査が見つけます。

どちらを選ぶかは、種類が後から増えていくのか（Strategy）、種類ごとの扱いを1つも
漏らせないのか（State）で決めます。

animal-bomber は、同じ問い（動物ごとの能力）に、2つの版で逆の答えを出しました。
TypeScript 版は Strategy で、動物を足すときに、既存の動物にも、移動や被弾の処理にも
手を入れません。Python 版は閉じた種類と `match` で、動物を足すと扱いを書く所が出てきて、
書き忘れは型検査が見つけます。増やしやすさと漏れの無さの交換で、どちらが正しいという
ことではありません。プレイヤーの状態は、どちらの版も State です。

State の手間（状態を足すたびに、それを扱う分岐のすべてに書き足す）は、種類で振り分ける所を1か所に
集めると小さくなります。種類ごとの性質（送れるか・受け取るか・後始末が要るか）を1つの表か関数で返し、
共通の処理はその性質だけを見て、種類を見ません。種類を足すときに書くのは表か関数の1か所で、書き忘れは
型検査が見つけます（TypeScript は表、Python は関数。上の「言語で形が変わったところ」）。似た性質は、
1つの真偽値にまとめません。見本の接続の状態では、閉じている途中だけが「送らないが受け取る」状態で、
送れるかと受け取るかを1つにまとめると、届いたものを捨てるか、閉じている途中に送るかのどちらかになります。

animal-bomber の Python 版は、プレイヤーを一時的に乗っ取る振る舞い（突進・穴掘り・舌）の性質をこの形に
しました（actions.py の `ActionTraits` と `traits_of`）。原型では突進の判定だけで 11 か所に散っていました。
いまは移動・爆弾・拾う・被弾の処理が見るのは性質だけです。突進は移動・ブロックの破壊・アイテムの取得・
被弾の4つに同時に割り込みますが、試合を進める処理に突進という言葉は出てきません。葱（体力が尽きたプレイヤーが
盤面の外周を回りながら撃つ飛び道具）が当たらないことと、爆風が当たらないことも、別の性質にしています。
突進は葱だけが当たらないので、1つにまとめると、どちらかの振る舞いが壊れます。
TypeScript 版は、同じ性質を振る舞いの共通の interface の項目に持たせています（ActiveAction.ts）。

性質は、種類そのものとの比較で決めません。animal-bomber の Python 版は、落とし穴に落ちないかを動物
そのものとの比較（掘る動物 = もぐら）で決めていました。この比較は `match` と `assert_never` を通らないので、
6匹目に穴掘りを割り当てると、その動物は自分の穴に落ち、型検査も何も言いません。そこで、技の割り当てから
決める形に改めました。技のボタンの長押しで出す技（とくぎ）が穴掘りの動物を、掘れる動物とします
（techniques.py の `digs_pits`）。
種類の名前との比較は、いまある種類だけを使うテストもすべて通ります。このリポジトリの見本でも、後始末が
要る接続を「切れた状態でないもの」で選ぶ形に置き換えると、テストは通ります。食い違うのは、性質の違う
種類を足したときです。

## 実際に使った例へのリンク

ここに置いた型は、抽象のまま置いておくだけでは「使えるのか」が分かりません。
実際の作品で使ったものは、そこへのリンクを型のそばに書きます。

| 型 | TypeScript | Python |
|---|---|---|
| Command | [animal-bomber](https://github.com/nakatama225/animal-bomber) の操作の出どころ（[InputSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/input/InputSource.ts)）と、操作の記録・再生（[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts)。替わったかの判定 `replacedAt` と、代わりを初めて任せるときに1度だけ作る `ReplayInputSource` は、このリポジトリの `Handover` と `HandoverSource` の元）。同じプレイヤーの出どころをいくつか、ボタンごとの OR で1つに合わせる所（[CombinedInputSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/platform/CombinedInputSource.ts)。このリポジトリの `CombinedSource` の元）。通信で届いた命令を、出どころとして試合に渡す所（[ConfirmedInputs.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/ConfirmedInputs.ts) の `ConfirmedInputs` と `NetworkInputSource`。どこまで届いたかを、記録とは別に持つ。`ConfirmedInputs` は、このリポジトリの `ArrivalLog` の元。`ArrivalLog` は範囲を別に持たず、中の記録が最後に受け付けた歩を使う） | animal-bomber の操作の出どころ（[sources.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/input/sources.py)。何も押さない `IdleSource`、いくつかを合わせる `EitherSource`、全員の出どころから1歩ぶんを集める `InputGatherer` を含む。`EitherSource` は、このリポジトリの `CombinedSource` の元。合わせる出どころと集める側の検査のテストは [test_sources.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/input/test_sources.py)）と、操作の記録・再生（[input_log.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/input_log.py)。途中で抜けたプレイヤーを代わりの出どころに任せる `Replacement` を含む。替わったかの判定 `InputLog.replaced_at` と `Replacement` は、このリポジトリの `Handover` と `HandoverSource` の元）。どこまで届いたかを持つ記録と、通信の出どころ（[confirmed.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/confirmed.py)。`ConfirmedInputs` が、このリポジトリの `ArrivalLog` の元） |
| Strategy | animal-bomber の動物ごとの能力。答え方の型と登録表（[Ability.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/Ability.ts)）、登録を集める1か所（[registry.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/registry.ts)）。CPU の戦い方の登録表（[AnimalTactic.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/tactics/AnimalTactic.ts)。登録を集める1か所は [registry.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/tactics/registry.ts)）。戦い方は、登録が無ければ既定の戦い方を返す。このリポジトリの `Registry.get` は既定に丸めずに止まるが、ここは「戦い方を書かなくても戦える」ことを意図した使い方で、動物の名前の誤りは能力の登録表が止める | 登録表は意図して使っていない。同じ問い（動物ごとの能力）に、閉じた種類で答えた。動物の閉じた列挙を `match` で振り分けて、技の関数（[techniques.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/abilities/techniques.py)）と CPU の戦い方（[tactics.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/tactics.py) の `Tactic` と `tactic_of`）を返す。理由は [06-動物の技と閉じた種類.md](https://github.com/nakatama225/animal-bomber/blob/main/py/docs/06-動物の技と閉じた種類.md)。登録表を使わない Strategy の例は、待ち方の関数を引数で渡す所（[loop.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/shell/loop.py) の `frames`）と、通信の手段を引数で渡す所（[data-science-portfolio](https://github.com/nakatama225/data-science-portfolio) の [api.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/src/spacex_capstone/collection/api.py) の `JsonFetcher`） |
| Chain of Responsibility | animal-bomber の CPU の判断。規則の型と先頭から試す関数（[CpuBehavior.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/CpuBehavior.ts)）、規則の並び（[DefaultChain.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/behaviors/DefaultChain.ts)）。以前に試して失敗した規則（袋小路では爆弾を置かずに待つ）を並びに1つ差し込み、爆弾を1個も置かなくなることを見るテスト（[cpu.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/ai/cpu.test.ts)） | animal-bomber の CPU の判断。規則の並びと先頭から試す `for` 文（[chain.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/chain.py)）、規則の関数（[behaviors.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/behaviors.py)）。1つの規則の中で、探し方の条件を厳しい順に緩めていく使い方もある（behaviors.py の逃げる規則。燃えかけているマスと踏むと損をするアイテムを避ける → アイテムは踏む → 燃えかけているマスも通る） |
| State | animal-bomber のプレイヤーの状態。状態の union（[Life.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/Life.ts)）と、`never` への代入で扱い忘れを型エラーにする分岐（[WorldState.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/WorldState.ts) の `hashLife`）。同じ仕掛けを `assertNever` の形で、イベントの union にも使っている（[SimEvent.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/events/SimEvent.ts)）。ラウンドの判定（[RoundSystem.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/systems/RoundSystem.ts) の `RoundVerdict`）と、通信対戦の局面（[LockstepClient.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/LockstepClient.ts) の `LanPhase`）も union で表している。中身を持たない状態の `ALIVE` と `OUT` は、全員で1つの値を使い回し、`Object.freeze` している（[state.ts](typescript/src/patterns/state.ts) の約束の2つ目）。プレイヤーを一時的に乗っ取る振る舞いは、移動や被弾の処理が見る性質を、共通の interface の項目に持たせている（[ActiveAction.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/ActiveAction.ts)） | animal-bomber のプレイヤーの状態。状態の union（[player.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/player.py) の `Alive`・`Negibon`・`Out` と `Life`）と、`match` と `assert_never` で扱い忘れを型エラーにする分岐（[world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/world.py) の `_hash_life`）。イベントの union（[events.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/events.py) の `SimEvent`。受け取る側は [presenter.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/presentation/presenter.py)）、ラウンドの判定（[round.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/round.py) の `RoundVerdict`）、通信対戦の局面（[client.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/client.py) の `LanPhase`）も union で表している。値を返さない `match` の書き忘れも見つけるよう、mypy の `exhaustive-match` を有効にしている（[pyproject.toml](https://github.com/nakatama225/animal-bomber/blob/main/py/pyproject.toml)）。プレイヤーを一時的に乗っ取る振る舞いの種類ごとの性質を、`match` と `assert_never` で1か所から返す（[actions.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/actions.py) の `ActionTraits` と `traits_of`。このリポジトリの性質の表の見本の元） |
| 単位を型で分ける | animal-bomber の時刻と識別子。数に印を付けた型（[Tick.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/Tick.ts) の `Tick`、[EntityId.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/core/EntityId.ts) の `EntityId`）。試合を通して数える時刻には型を分けず、操作の記録と再生に試合の時計（InputLog.ts の `MatchClock`）を渡している | animal-bomber の時刻と識別子。盤面の時刻と、試合を通して数える時刻（[tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/tick.py) の `Tick` と `MatchTick`、`MatchTick` の値を作る時計 `MatchClock`）、盤面の物の識別子（[entity_id.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/entity_id.py) の `EntityId`）。`MatchTick` の値を作ってよい場所を構文木で限るテスト（[test_match_tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/boundary/test_match_tick.py)。許す場所がいまも使われていることも見る） |

ここに置いた形は、使った先の形をそのまま写したものではありません。使ってみて分かった
直しを入れてあります。たとえば Command は、歩の番号を処理の側が数えて渡す形にしました。
animal-bomber では最初、状態の中の時刻で代用していて、状態を作り直すと 0 に戻るため、
記録と再生の番号がずれることが後から分かりました。いまは試合を通して数える時刻で記録しています。
Python 版が2つの時刻を別の型に分け、取り違えを型検査に見つけさせた話は、
上の「単位を型で分ける（ブランド型）」に書いています。
同じ歩を2度記録したときの扱いは違います。このリポジトリの `CommandLog` は2度目を断りますが、
animal-bomber の記録（`InputLog`）は同じ時刻の2度目を受け付けて、あとの値を使います。

命令の出どころが、見ている状態から作った控え（経路の記憶など）を持つ場合は、控えを捨てて
作り直すのを、状態そのものが作り直されたときだけにしています。比べるのは中身が等しいか
（`==`）ではなく、同じものか（`is`）です。知りたいのは作り直されたかどうかで、中身が
等しいかどうかではないからです。この判定が使えるのは、状態の側が作り直すときに新しいものを
作るからです。同じものをその場で書き換えて作り直す作りなら、版の番号を別に持たないと
見分けられません。animal-bomber の CPU の出どころ（[source.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/source.py)）は、
ラウンドの盤面が作り直されたときだけ記憶を捨てます。

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
