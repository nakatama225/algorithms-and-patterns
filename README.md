# algorithms-and-patterns

[![状態：wip（作りかけ。安定して使える版はまだ無い）](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

アルゴリズムと設計パターンを、再利用できる部品として実装したものです。

**現在の状態（2026年10月）**：設計の型（`patterns/`）を4つ置いています。TypeScript は4つとも
部品とテストがあります。Python は3つに部品とテストがあり、残る State は標準ライブラリで
足りるので、書き方の見本をテストに置いています。共通部品（`lib/`）は置き始めたところで、
いまは二分探索（TypeScript だけ。Python は標準ライブラリの `bisect` で足ります）と、
決定的な擬似乱数と、状態の要約の3つです。
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

`tests/` は `src/` と同じ構造にします。例外は3つで、Python の State は部品が無いので
見本だけをテストに置いています。層の向き・決定性を崩す書き方・静的検査の設定を確認するテスト
（`test_layers.py`・`test_determinism_guard.py`・`lint-rules.test.ts`）と、2つの言語の固定値の表を突き合わせるテスト
（`test_cross_language.py`）は、`src/` のどのファイルにも対応しません。
反対に、乱数の部品（`rng`）はテストを2つのファイルに分けています。乱数を生成する本体と、
種を導く関数は変わる理由が違うためです（`rng.test.ts` と `rng-derive-seed.test.ts`、
Python は `test_rng.py` と `test_rng_derive_seed.py`）。
テストは、部品が正しく動くことの確認であると同時に、
**その部品が何を保証しているのかの記述**でもあります。エッジケース
（空、1件、重複、境界値、異常値）を通しておくと、読む人は仕様を読み取れます。

## 置いてある共通部品

| 部品 | 何をするか | TypeScript | Python |
|---|---|---|---|
| 二分探索 | 昇順に並んだ列で、値が入る位置を求める。同じ値が続くなら、その最初の位置（`bisectLeft`）か、最後の次の位置（`bisectRight`）を選べる | [bisect.ts](typescript/src/lib/bisect.ts) | 部品は無し（標準の `bisect`。3.10 から `key=`） |
| 決定的な擬似乱数 | 種を1つ与えれば、言語と版をまたいで同じ並びが出る。生成した回数を外から読め、元を進めずに先を試算する写しを作れる。種と番号から、用途ごとに分けた乱数の種を導ける | [rng.ts](typescript/src/lib/rng.ts) | [rng.py](python/src/algorithms_and_patterns/lib/rng.py) |
| 状態の要約 | 状態を、比べられる 32 ビットの数1つにまとめる。何をどの順で混ぜるかは呼ぶ側が決め、同じ値を同じ順で混ぜれば、起動・環境・言語をまたいで同じ要約になる | [state-hash.ts](typescript/src/lib/state-hash.ts) | [state_hash.py](python/src/algorithms_and_patterns/lib/state_hash.py) |

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
| Command（命令を値として渡す） | 1歩ずつ進む処理と、「その歩で何をするか」を決める側を切り離す。記録と再生が、部品を1つ挟むだけで作れる | [command.ts](typescript/src/patterns/command.ts) | [command.py](python/src/algorithms_and_patterns/patterns/command.py) |
| Strategy（答え方を差し替える）と登録表 | 同じ問いへの答え方を名前で引けるように並べる。答え方を足すときに、使う側と既存の答え方を触らない | [strategy.ts](typescript/src/patterns/strategy.ts) | [strategy.py](python/src/algorithms_and_patterns/patterns/strategy.py) |
| Chain of Responsibility（規則を優先順に試す） | 1つの長い if の連なりを、独立した規則の並びにする。規則を足す・外す・入れ替えるのが、並びの1行の操作になる | [chain-of-responsibility.ts](typescript/src/patterns/chain-of-responsibility.ts) | [chain_of_responsibility.py](python/src/algorithms_and_patterns/patterns/chain_of_responsibility.py) |
| State（状態を閉じた union で表す） | 取りうる状態を型で閉じ、状態ごとに持つ値を分ける。状態を足したときの扱い忘れを、型検査が見つける | [state.ts](typescript/src/patterns/state.ts) | 部品は無し（標準ライブラリで足りる）。書き方の見本は [test_state.py](python/tests/patterns/test_state.py) |

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
  まとめていますが、このリポジトリでは型ごとのテスト（`command.test.ts` と
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

## 実際に使った例へのリンク

ここに置いた型は、抽象のまま置いておくだけでは「使えるのか」が分かりません。
実際の作品で使ったものは、そこへのリンクを型のそばに書きます。

| 型 | TypeScript | Python |
|---|---|---|
| Command | [animal-bomber](https://github.com/nakatama225/animal-bomber) の操作の出どころ（[InputSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/input/InputSource.ts)）と、操作の記録・再生（[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts)）。同じプレイヤーの出どころをいくつか、ボタンごとの OR で1つに合わせる所（[CombinedInputSource.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/platform/CombinedInputSource.ts)）。通信で届いた命令を、出どころとして試合に渡す所（[ConfirmedInputs.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/ConfirmedInputs.ts) の `ConfirmedInputs` と `NetworkInputSource`。どこまで届いたかを、記録とは別に持つ） | animal-bomber の操作の出どころ（[sources.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/input/sources.py)。何も押さない `IdleSource`、いくつかを合わせる `EitherSource`、全員の出どころから1歩ぶんを集める `InputGatherer` を含む）と、操作の記録・再生（[input_log.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/input_log.py)。途中で抜けたプレイヤーを代わりの出どころに任せる `Replacement` を含む）。どこまで届いたかを持つ記録と、通信の出どころ（[confirmed.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/confirmed.py)） |
| Strategy | animal-bomber の動物ごとの能力。答え方の型と登録表（[Ability.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/Ability.ts)）、登録を集める1か所（[registry.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/registry.ts)）。CPU の戦い方の登録表（[AnimalTactic.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/tactics/AnimalTactic.ts)。登録を集める1か所は [registry.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/tactics/registry.ts)）。戦い方は、登録が無ければ既定の戦い方を返す。このリポジトリの `Registry.get` は既定に丸めずに止まるが、ここは「戦い方を書かなくても戦える」ことを意図した使い方で、動物の名前の誤りは能力の登録表が止める | 登録表は意図して使っていない。同じ問い（動物ごとの能力）に、閉じた種類で答えた。動物の閉じた列挙を `match` で振り分けて、技の関数（[techniques.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/abilities/techniques.py)）と CPU の戦い方（[tactics.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/tactics.py) の `Tactic` と `tactic_of`）を返す。理由は [06-動物の技と閉じた種類.md](https://github.com/nakatama225/animal-bomber/blob/main/py/docs/06-動物の技と閉じた種類.md)。登録表を使わない Strategy の例は、待ち方の関数を引数で渡す所（[loop.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/shell/loop.py) の `frames`）と、通信の手段を引数で渡す所（[data-science-portfolio](https://github.com/nakatama225/data-science-portfolio) の [api.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/src/spacex_capstone/collection/api.py) の `JsonFetcher`） |
| Chain of Responsibility | animal-bomber の CPU の判断。規則の型と先頭から試す関数（[CpuBehavior.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/CpuBehavior.ts)）、規則の並び（[DefaultChain.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/ai/behaviors/DefaultChain.ts)）。以前に試して失敗した規則（袋小路では爆弾を置かずに待つ）を並びに1つ差し込み、爆弾を1個も置かなくなることを見るテスト（[cpu.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/ai/cpu.test.ts)） | animal-bomber の CPU の判断。規則の並びと先頭から試す `for` 文（[chain.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/chain.py)）、規則の関数（[behaviors.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/behaviors.py)）。1つの規則の中で、探し方の条件を厳しい順に緩めていく使い方もある（behaviors.py の逃げる規則。燃えかけているマスと踏むと損をするアイテムを避ける → アイテムは踏む → 燃えかけているマスも通る） |
| State | animal-bomber のプレイヤーの状態。状態の union（[Life.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/Life.ts)）と、`never` への代入で扱い忘れを型エラーにする分岐（[WorldState.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/WorldState.ts) の `hashLife`）。同じ仕掛けを `assertNever` の形で、イベントの union にも使っている（[SimEvent.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/events/SimEvent.ts)）。ラウンドの判定（[RoundSystem.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/systems/RoundSystem.ts) の `RoundVerdict`）と、通信対戦の局面（[LockstepClient.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/LockstepClient.ts) の `LanPhase`）も union で表している。中身を持たない状態の `ALIVE` と `OUT` は、全員で1つの値を使い回し、`Object.freeze` している（[state.ts](typescript/src/patterns/state.ts) の約束の2つ目） | animal-bomber のプレイヤーの状態。状態の union（[player.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/player.py) の `Alive`・`Negibon`・`Out` と `Life`）と、`match` と `assert_never` で扱い忘れを型エラーにする分岐（[world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/world.py) の `_hash_life`）。イベントの union（[events.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/events.py) の `SimEvent`。受け取る側は [presenter.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/presentation/presenter.py)）、ラウンドの判定（[round.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/round.py) の `RoundVerdict`）、通信対戦の局面（[client.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/client.py) の `LanPhase`）も union で表している。値を返さない `match` の書き忘れも見つけるよう、mypy の `exhaustive-match` を有効にしている（[pyproject.toml](https://github.com/nakatama225/animal-bomber/blob/main/py/pyproject.toml)） |

ここに置いた形は、使った先の形をそのまま写したものではありません。使ってみて分かった
直しを入れてあります。たとえば Command は、歩の番号を処理の側が数えて渡す形にしました。
animal-bomber では最初、状態の中の時刻で代用していて、状態を作り直すと 0 に戻るため、
記録と再生の番号がずれることが後から分かりました。いまは試合を通して数える時刻で記録しています。
Python 版は、盤面の時刻と試合を通して数える時刻を別の型にして、取り違えると型検査が失敗するようにしました。
ただし、盤面の時刻を包み直す書き方（`MatchTick(world.now)`）は型検査を通ります。そこで、
その型の値を作ってよい場所を構文木で限るテストも置いています（[tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/core/tick.py) の
`MatchTick` と `MatchClock`、[test_match_tick.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/boundary/test_match_tick.py)）。
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
