# algorithms-and-patterns

[![状態：wip（作りかけ。安定して使える版はまだ無い）](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

アルゴリズムと設計パターンを、再利用できる部品として実装したものです。

**現在の状態（2026年11月）**：設計の型（`patterns/`）を6つ置いています。TypeScript は6つとも
部品とテストがあります。Python は4つに部品とテストがあり、残る State と単位を型で分ける型は
標準ライブラリで足りるので、書き方の見本をテストに置いています。共通部品（`lib/`）は、
二分探索（TypeScript だけ。Python は標準ライブラリの `bisect` で足ります）と、
決定的な擬似乱数と、状態の要約と、固定刻みの時間（待つ部品は Python だけ）と、格子と、
幅優先の最短経路と、連鎖の一括処理（最も早く発火する時刻を求める関数を含みます）と、外から来た値の
読み取り（10 進の整数を書いた文字列の読み取りを含みます）と、毎回読む値の判定と、輪の上の位置と、
パーセンタイルと、禁則つきの行詰めと、大円距離と、最小ベイズリスクによる選択の14個です。どれも、実際の作品（animal-bomber と
data-science-portfolio）で使った処理を引き上げたものです。具体的な解答（`problems/`）はまだありません。
これからは、問題を解いて同じ処理を2度書いたときに、それを `lib/` へ引き上げます。

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
見つけることもテストで確認しています（TypeScript は [lint-lib-rules.test.ts](typescript/tests/lint-lib-rules.test.ts)）。
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
部品が無いので、見本だけをテストに置いています。層の向き・決定性を崩す書き方・静的検査と型検査の設定を確認するテスト
（`test_layers.py`・`test_determinism_guard.py`・`test_mypy_settings.py`・`lint-lib-rules.test.ts`・`lint-rules.test.ts`）と、2つの言語の固定値の表を突き合わせるテスト
（`test_cross_language.py`）と、テストが使う偽の物と補助（Python の偽の時計 `fake_time.py`、両方の言語の
偽の届く関係 `fake_reaches.py`・`fake-reaches.ts`、止めた文の頭を比べる `error_head.py`・`error-head.ts`、
静的検査に文字列を渡す `lint-probe.ts`）は、`src/` のどのファイルにも対応しません。
静的検査の設定を確認するテストは、`src/lib/` だけに当てる規則（層の向きと決定性）の `lint-lib-rules.test.ts` と、
リポジトリ全体に当てる規則の `lint-rules.test.ts` に分けています。`lib/` に部品を足すたびに、前のほうの `lib/` の
ファイルの一覧が伸びるためです。
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
毎回読む値の判定（`sampling`）も、揺れる値を分ける2つ（2つのしきい値と大きいほうの軸）と、押す・離すを扱う
2つ（押し始めと短い押し）のテストを分けています（`sampling.test.ts` と `sampling-press.test.ts`、Python は
`test_sampling.py` と `test_sampling_press.py`）。値の揺れの扱いと、押す・離すの扱いは、別の理由で変わります。
禁則つきの行詰め（`line_break`）も、単位の切り方と、行への詰め方のテストを分けています（`line-break.test.ts` と
`line-break-fill.test.ts`、Python は `test_line_break.py` と `test_line_break_fill.py`）。単位を詰める約束（測る回数と
空白の扱い）は、切り方とは別の理由で変わります。
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
| 毎回読む値の判定 | 決まった間隔で読む揺れる値を、ちらつかずにオンとオフに分ける。押している鍵の組を毎回読み、押し始めを前回との差で取り出し、読む間隔より短い押しも1回ぶん残す | [sampling.ts](typescript/src/lib/sampling.ts) | [sampling.py](python/src/algorithms_and_patterns/lib/sampling.py) |
| 輪の上の位置 | 端と端がつながった長さ L の線の上の位置を 0 以上 L 未満に巻き戻し、2点の近いほうの道のりを符号つきで求める。巻き戻しは、JavaScript の式と最後の桁まで同じ値を出す | [ring.ts](typescript/src/lib/ring.ts) | [ring.py](python/src/algorithms_and_patterns/lib/ring.py) |
| パーセンタイル | 測った値の列から p50・p99 などを、補間せずに列の中の値で返す。百分率は整数で受け、位置は整数の計算で切り上げる | [percentile.ts](typescript/src/lib/percentile.ts) | [percentile.py](python/src/algorithms_and_patterns/lib/percentile.py) |
| 禁則つきの行詰め | 文を折り返してよい単位に切り（閉じかっこと句読点は前の字に、開きかっこは後ろの字に付ける）、渡された測る関数で、幅に収まるよう前から詰める | [line-break.ts](typescript/src/lib/line-break.ts) | [line_break.py](python/src/algorithms_and_patterns/lib/line_break.py) |
| 大円距離 | 範囲を検査した緯度と経度の2点から、地表に沿った距離をハーサイン公式で求める（地球を球とみなす近似） | [geo.ts](typescript/src/lib/geo.ts) | [geo.py](python/src/algorithms_and_patterns/lib/geo.py) |
| 最小ベイズリスクによる選択 | 候補の中から、ほかの候補との似ている度合いの平均が最も高いものの位置を返す。似ている度合いを求める関数は呼ぶ側が渡し、同点は前の候補を選ぶ | [mbr.ts](typescript/src/lib/mbr.ts) | [mbr.py](python/src/algorithms_and_patterns/lib/mbr.py) |

`lib/` の部品は、同じ入力から、起動のたびに同じ結果を出します。固定値の表を持つ部品（乱数と
状態の要約と輪の上の位置）は、さらに環境と言語をまたいでも1ビットも違わない値を出します。前の約束を崩す書き方を
機械で止めていることと、後の約束を守るために使わない計算は、下の「決定性を崩す書き方の検査」に
書いています。

TypeScript の `lib/` には、表に無いファイルがもう1つあります。[safe-integer.ts](typescript/src/lib/safe-integer.ts) は、
表の部品が整数で受ける引数を、安全な整数（絶対値が 2**53 未満の整数）か、決めた値以上かを実行時に確認する
関数です。TypeScript の `number` は整数と小数を区別しないので、乱数・格子・幅優先の最短経路・連鎖・
固定刻みの時間・外から来た値の読み取りが、この確認を使います。Python は `int` の型で受けて型検査に
任せるので、同じものを置いていません（下限の確認は、各部品が `if` の1行で書いています）。

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

### 毎回読む値の判定

決まった間隔で読む値（読んだ瞬間の状態だけが分かり、変わったことの知らせは来ない値）から、オンとオフや
押し始めを取り出す部品です。4つあり、どれも `sampling.ts`・`sampling.py` に置いています。押す・離すものは、
それを見分ける値（鍵）で表します。

- 2つのしきい値（`Hysteresis`）：揺れる値を、入るしきい値（`on`）と切れるしきい値（`off`）でオンとオフに
  分けます。切れている間は `on` 以上で入り、入っている間は `off` 未満で切れます。しきい値が1つだと、境目の
  近くで揺れる値は、読むたびにオンとオフが入れ替わります。値はそのまま比べるので、符号つきの値の大きさで
  分けるときは、呼ぶ側が絶対値を渡します。`off` が `on` 以上のときと、しきい値が有限の数でないときは、作る
  所で止めます
- 大きいほうの軸（`dominantAxis`・`dominant_axis`）：縦と横の2つの値のうち、絶対値の大きいほうの軸の符号
  だけを残し、上下左右のどれか1つにします。絶対値が等しいときは横を残します。軸ごとにしきい値を当てると、
  片方の軸から少しずれた向きで、縦と横の両方がしきい値を超えます。縦横を合わせた長さが 1 の値をしきい値
  0.5 で見ると、全周の3分の1の向きで両方が超えます。大きさに2つのしきい値を、向きに大きいほうの軸を使うと、
  境目でちらつかず、いつも1つの向きになります（テストの「組み合わせ」）
- 押し始め（`EdgeDetector`）：押している鍵の組を毎回受け取り、前回に無く今回にある鍵を返します。始まりの
  前から押していた鍵（`heldAtStart`・`held_at_start`）は、作るときに必ず受け取り、既定を持ちません。何も
  押していない組で始めると、押したまま始まった鍵が、最初の回に押し始めに見えるためです。押しているかが
  分からないときは、押し始めだけを見たい鍵を全部渡します。押していなければ最初の回で離した扱いになり、
  見逃すのは、その最初の回に押し始めた鍵だけです。前回の組は `update` だけが書き換え、読む場面が替わっても
  消しません。全部を離した扱いにする `releaseAll`・`release_all` は、読む元が無くなったときにだけ呼びます。
  鍵の組の代わりに文字列を1つ渡すと（`update('enter')`）、文字ごとの鍵に分かれて黙って通り、どちらの言語の
  型検査も止めないので、作るときと `update` で `TypeError` を投げて止めます
- 短い押しの取りこぼし防止（`PressLatch`）：押したことと離したことを1つずつ受け取り、前に読み終えてから
  押した鍵を、印として別に覚えます。読みと読みの間に押して離した鍵も、その回は押していたことにします
  （`read`）。印は、読んだ値を使い終えた回だけに忘れます（`endStep`・`end_step`）。読んだのに使わなかった回
  に忘れると、その間の押しが使われないまま消えます。押している鍵と印の両方を忘れる `forgetAll`・
  `forget_all` は、離したことが届かなくなるとき（読む元から切り離されたとき）に呼びます。`press` は、
  押したままの鍵にも印を付けます。押したままの鍵の押下が届くのは、離したことが届かなかったあとに押し直した
  ときだからです。押したままのときに届く繰り返し（押し続けると届く、押したことの知らせ）は `press` に
  渡しません。渡すと、`forgetAll` で忘れた鍵が、押し直さなくても押したことに戻ります

押し始めは、1回の読みで1度だけ求め、その答えを、その回の処理の全部で使います。`update` は答えを返すのと
同時に前回の組を控えるので、同じ回に2度呼ぶと、2度目は押し始めを返しません。

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、起動のたびに
同じ結果を出す）だけです。計算は、大小の比べと、集まりの差と和だけです。

言語で形が変わったところは4つです。

- 押し始めの求め方：Python は `frozenset` の差（`now - previous`）の1行です。TypeScript の `Set` にも差
  （`difference`）はありますが、ES2025 で加わったもので、このリポジトリの型の設定（ES2022 だけ）には無く、
  型検査が止めます（実行する Node.js 26 には有ります）。そのため、繰り返しで求めます
- 鍵の型：Python は hash できる値なら何でもよく（文字列・数・Enum・tuple）、型変数の上限を `Hashable` に
  しています。TypeScript は文字列か数に限ります（`K extends string | number`）。`Set` はオブジェクトの鍵を、
  中身でなく同じものかで比べるので、同じ中身で別に作った鍵が別の鍵になるためです。この限り方のため、
  TypeScript は鍵の型を書かないと、渡した組から文字列そのもの（`'a'`）の型に決め、ほかの鍵を渡すと型エラーに
  なります。鍵の型を書いて作ります（`new EdgeDetector<string>([])`）
- 返す集まりの順：Python は `frozenset` を返します。文字列や Enum の鍵の `frozenset` を順に取り出すと、
  その順は起動のたびに変わります（hash の種を 0 から 4 に変えた5回で、6つの文字列の順は5回とも違い、整数の
  鍵は同じ順でした）。部品の中では順に取り出さず、順が要る呼ぶ側は `sorted` で決めてから取り出します。
  TypeScript の `Set` は入れた順を保つので、起動のたびに同じ順になりますが、2つの言語で揃わないので、
  順は約束しません
- 始まりの前の鍵を省いたとき：Python は引数が足りない `TypeError` で止まり、mypy も止めます。TypeScript は
  型検査が止めますが、実行時には見ません（`new Set(undefined)` は空の `Set` で、何も押していない組で始まり
  ます）

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 2つのしきい値と大きいほうの軸は、ゲームパッドのスティックの読み取り
  （[gamepad.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/shell/gamepad.py) の
  `StickReader`、[GamepadInput.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/platform/GamepadInput.ts) の
  `PadReader`）から持ってきました。しきい値は、倒したとみなす 0.5 と、戻ったとみなす 0.35 です
  （`STICK_ON`・`STICK_OFF`）。TypeScript 版の説明には、軸ごとにしきい値を当てると、真上から少し倒しただけで
  縦横の両方がしきい値を超え、移動の側が横を優先するため、全周のうち3分の1ほどが押した向きと違う方向になる、
  とあります。縦横を合わせた長さ 1・しきい値 0.5 で数えると、縦横の両方が超えるのが全周の3分の1で、押した
  向きと違う横へ動くのは、そのうち縦のほうが大きい半分（全周の6分の1）でした
- animal-bomber の比べ方は、倒れていれば 0.35、いなければ 0.5 を選び、絶対値がそれより小さいと戻った扱いに
  します。この形で NaN を受けると、どちらの言語でも比べた結果が偽になり、倒した扱いになります。この
  リポジトリは、入るときと切れるときで比べ方を分け（`on` 以上で入り、`off` 未満で切れる）、境目ちょうどの
  扱いは animal-bomber と同じにして、NaN は明示して止めます。しきい値の部品と向きの部品も分け、大きさの
  絶対値は呼ぶ側が取ります
- 押し始めは、パッドでメニューを動かす読み取り（gamepad.py と GamepadInput.ts の `PadMenuInput`）の形です。
  前回の状態との差で押し始めを作り、前回の状態を、画面が替わったときに消しません。TypeScript 版の説明には、
  消すと、A で次の画面へ移ったとき、押したままの A が新しい押下に見えて、次の画面の項目まで押してしまう、と
  あります。Python 版のテスト（[test_menu_input.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/shell/test_menu_input.py)）は、
  A を押したまま次の画面へ移っても押さないことと、読み取りを作り直すと押してしまう対照の両方を置いています
- 始まりの前の鍵を省けなくしたのは、前回の状態を「何も押していない」で始める穴が、animal-bomber で3か所に
  出たためです。1つ目は上の画面の移りです。2つ目は Enter で始める所で、メニューの決定のキー（Enter と
  Space）は1人で遊ぶときの爆弾のキーでもあるので、決定で始めると、押したまま試合が始まります
  （[keyboard.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/shell/keyboard.py) の
  `MENU_KEYS` の説明と、test_menu_input.py の Enter のテスト）。3つ目は通信対戦の最初の3刻みで、始まった時点で
  押している内容で埋めて送ります。何も押していない入力で埋めると、押したまま始まったプレイヤーが開始位置に
  爆弾を置きます（[lockstep.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/net/lockstep.py) と
  [LockstepDriver.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/LockstepDriver.ts) の `start`）。
  animal-bomber は、ラウンドの始まりの前回の入力を、爆弾と技のボタンを押していた扱いにしています
  （[world.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/world.py) と
  [WorldState.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/state/WorldState.ts) の
  `HELD_AT_ROUND_START`）。実際に押していたかは読まず、押し始めだけを見るボタンを押していた扱いにする形で、
  上の「押しているかが分からないとき」の使い方です
- 前回の値を控えるのは、1刻みの処理が全部終わったあとです。animal-bomber の
  [Simulation.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/systems/Simulation.ts) の説明には、
  途中で控えると、後ろの処理から見て「押した瞬間」が消える、とあります。このリポジトリの `update` は、
  押し始めを返すのと同時に控えるので、1回の読みで1度だけ呼び、答えを全部の処理で使います
- 短い押しの取りこぼし防止は、両方の版にあります。キーボードの読み取り（keyboard.py と
  [Keyboard.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/platform/Keyboard.ts) の
  `KeyboardWatcher`）と、TypeScript 版のパッドの読み取り（GamepadInput.ts の `PadChoice` の `tapped` と
  `forgetTaps`）です。押しているキーとは別に押した瞬間を覚え、爆弾と技のボタンは、離していても押していたことに
  します。パッドは押したことを知らせないので、読むたびに前回との差で押し始めを作り、それを印に足します。
  押し始めと短い押しの取りこぼし防止を、続けて使う形です
- 印をいつ忘れるかは、TypeScript 版の画面の流れ（[Shell.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/app/Shell.ts) の
  `tick` の説明と `#forgetTaps`）と、[06-画面と設定.md](https://github.com/nakatama225/animal-bomber/blob/main/ts/docs/06-画面と設定.md) の
  「押してすぐ離したキー」にあります。入力を刻みへ取り込んだあとにだけ忘れ、0.5 倍で進めなかった回には
  忘れず、止めている間は描くたびに忘れます。進めなかった回に忘れると、押したことが読まれないまま消えます。
  止めている間に忘れないと、ポーズ中に押してすぐ離した爆弾のキーで、再開した最初の刻みに爆弾を置きます
- 押した瞬間を覚えるのは、Python 版のキーボードでは押したことが届くたびで、TypeScript 版のキーボードでは
  押していなかったキーの、繰り返しでない押下だけです。`press` は Python 版の形で、押したままの鍵にも印を
  付けます。繰り返しを `press` に渡さないことは、TypeScript 版が繰り返しを数えない理由（捨てたキーが、
  もう一度押すまで爆弾と技に数えられないようにする）と同じです
- 窓から離れたとき、Python 版のキーボードは押しているキーと押した瞬間の両方を忘れ、TypeScript 版は押して
  いるキーを捨て、押した瞬間は残します。`forgetAll`・`forget_all` は Python 版の形です。TypeScript 版の
  キーボードが持つ、Option と Command を離したときにほかの押しているキーを捨てる仕組みは、キーボードの事情
  なので持ってきていません

### 輪の上の位置

端と端がつながった長さ L の線（輪）の上の位置を、1つの数で扱う部品です。

- 巻き戻し（`wrap`）：どんな位置も 0 以上 L 未満に巻き戻します。式は JavaScript の
  `((position % L) + L) % L` で、Python は `math.fmod` を2回使って同じ順に計算し、最後の桁まで同じ値を
  出します。答えは -0 になりません
- 符号つきの近いほうの差（`signedDelta`・`signed_delta`）：始点から終点へ輪を回る2つの道のうち、近いほうの
  道のりを、位置が増える向きを正にして返します。差（終点 − 始点）を求め、半周より長ければ1周ぶんを減らすか
  増やします
- 止める値：長さが 0 以下か NaN か無限大のとき、巻き戻す位置が NaN か無限大のとき、差を取る点が 0 以上
  L 未満でないとき。巻き戻しは、長さが数の最大値の半分（約 8.99e307）より大きいときも止めます。位置に
  よっては、L を足すときに無限大にあふれるためです。符号つきの差は、差が1周より短く、1周ぶんを足し引き
  してもあふれないので、この上限を持ちません。TypeScript は `RangeError`、Python は `ValueError` で止めます。
  止めなければ、TypeScript は黙って範囲の外か NaN を返します（長さ -72 では、5 を巻き戻すと -67 に
  なります）。Python も、負の長さと、NaN の長さと位置では、黙って範囲の外か NaN を返します。ほかは
  `math.fmod` が `ValueError`（math domain error）で止めますが、どの値が悪いのかが文から分かりません。
  長さの上限を超えたときは、あふれる位置でだけ NaN か math domain error になり、ほかの位置では範囲の内の
  値を返します。どちらの言語も、明示して止め、例外の種類と文を揃えます

範囲の内の値も、巻き戻すと最後の桁が変わることがあります。L を足すときに丸めるためで、長さ 72 では
3.091666666666667 が 3.0916666666666686 に、71.99999999999999 が 0 になります。変わらないのは、L を足した
和を小数でちょうど表せる値（5 など）だけです。足した和の最後の桁より細かい桁を持つ値は、ごく小さい値でも
変わります（2 の -50 乗は 0 になります）。巻き戻した値をもう一度巻き戻しても、同じ値に留まるとは限りません
（-81.57093076673938 を巻き戻した 62.42906923326062 は、もう一度巻き戻すと 62.429069233260634 になります）。
0 以上 72 未満から一様に選んだ値では、6 割余りの最後の桁が変わりました（10 万個ずつ3回数えて 62.5〜62.7%）。
2つの言語で同じ値を出すには、巻き戻しを通す回数も揃えます。

決めたことは2つです。

- ちょうど半周は、差（終点 − 始点）の符号のままにしました。長さ 72 で、2 から 38 は +36、38 から 2 は
  -36 です。こうすると、始点と終点を入れ替えたとき、どの値でも符号だけが変わります。ちょうど半周をいつも
  正にすると、この性質が半周の所だけで崩れます。animal-bomber も同じ形です
- 差を取る点は、範囲の外なら止め、中で巻き戻しません。中で巻き戻すと、範囲の内の値でも最後の桁が変わり、
  渡した2点の差と食い違うためです。animal-bomber も、巻き戻した位置を渡す前提で、中では巻き戻していません。
  呼ぶ側は `signedDelta(wrap(a, L), wrap(b, L), L)` の形で使います

この部品は固定値の表を持ちます。巻き戻しの 19 行と差の 12 行の表を両方の言語のテストに置き、Python の
テストが2つを突き合わせます（Design Choice の 2）。表の値は、JavaScript の式を Node.js で計算したもので、
Python のテストは `float.hex` で、TypeScript のテストは `toBe`（`Object.is`）で、最後の桁と 0・-0 の違いまで
比べます。計算は足し算・引き算・2 で割ることと割った余りだけで、累乗と三角関数を使いません（下の
「決定性を崩す書き方の検査」）。割った余り（JavaScript の `%` と `math.fmod`）は、真の値がそのまま小数で
表せるので丸めが入らず、四則演算と同じく、環境と言語をまたいでも同じ値になります。

言語で形が変わったところは2つです。

- 余りの符号：JavaScript の `%` は、割られる数と同じ符号の余りを返します（C の `fmod` と同じ）。Python の `%`
  は割る数と同じ符号の余りを返し、小数では範囲を外れることがあります。`-1e-20 % 72` は、72 より 1e-20
  小さい値が小数で表せず丸まり、72.0 になります。Python の公式文書の `math.fmod` の説明にも、同じ種類の例が
  あります（`-1e-100 % 1e100` の答えは小数で表せず、丸めて `1e100` になる。小数には `fmod` を、整数には
  `%` を使うのがよい、とあります）。そのため Python 版は `math.fmod` を2回使います。Python の `%` 1つでは、
  範囲の内の値がそのまま返るので、JavaScript の式とは最後の桁が違う値にもなります。JavaScript の式を
  Python の `%` のまま写す（`(position % L + L) % L`）と、-1e-20 は 0.0 になりますが、負の位置の一部で最後の
  桁が違います。1回目の `%` で正になった値に、もう一度 L を足して丸めるためで、-81.57093076673938 は
  62.429069233260634 になります（JavaScript の式は 62.42906923326062）
- NaN と無限大：Python の `math.fmod` は、割られる数に無限大を渡すと `ValueError` で止まりますが、NaN は
  止めずに NaN を返します。JavaScript の `%` は、どちらも黙って NaN を返します。どちらの言語も、範囲を明示して
  止めます

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 巻き戻しは、外周の帯の上の位置の巻き戻し
  （[lane.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/rules/lane.py) の
  `wrap_along`、[lane.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/negibon/lane.ts) の
  `wrapAlong`）から持ってきました。長さは帯の長さ 72 の定数でしたが、引数にしました。Python 版は
  `math.fmod` を2回使い、説明に `-1e-20` は 0.0 になる（Python の `%` なら 72.0）と書いています。REPL の例を
  [09-葱ボンと延長戦.md](https://github.com/nakatama225/animal-bomber/blob/main/py/docs/09-葱ボンと延長戦.md) の
  「外周の位置は、JavaScript と同じ道筋で巻き戻す」に置き、pytest がその例を実行します。値は、Node.js で
  計算した JavaScript の答えと突き合わせています
  （[test_negibon.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/systems/test_negibon.py)）
- 範囲の内の値も最後の桁が変わるので、animal-bomber は、外周のプレイヤーが止まっている刻みにも巻き戻しを
  通しています。TypeScript 版が毎刻み通すので、Python 版だけが止まっている刻みで通さないと、値が分かれます
  （lane.py の説明、09-葱ボンと延長戦.md）
- 符号つきの差は、外周にいる CPU の操縦
  （[pilot.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/ai/pilot.py) の
  `_shortest_way`）から持ってきました。長さを引数にし、範囲の外の位置を止めることを足しました

### パーセンタイル

測った値の列（処理にかかった時間など）から、p50・p99 などを求める部品です（`percentile.ts`・`percentile.py`）。
最近順位法（nearest-rank method）で、列を小さい順に並べ、百分率 p と列の長さ n から、`ceil(p × n / 100)` 番目
（1 から数える）の値を返します。2つの値の間を補間しないので、返すのはいつも渡した列の中の値です。100 個の列の
99 パーセンタイルは大きいほうから2番目、600 個なら7番目の値で、「100 回に1回ある遅さ」を、実際に測った値のまま
読めます。

- 百分率は 1 以上 100 以下の整数で受けます。小数の割合を掛けると誤るためです。`7 / 100 * 100` は
  7.000000000000001 で、切り上げると8番目を返します。1〜100 の百分率のうち、列の長さ 1〜2000 のどこかで
  こう食い違うものは 12 個（7・14・17・27・28・34・54・55・56・67・68・81）あり、7 は長さ 100・200・300 などで
  食い違います。よく使う 50・95・99 は、長さ 1〜100000 で1度も食い違いませんでした。Python は位置を整数の
  割り算で求めます。TypeScript は、整数のまま正確に求まる `p × n` を 100 で割って切り上げます（配列の長さは
  2 の 32 乗より小さいので、割った値の端数は丸めで消えません）
- 位置は切り上げます。150 個の列の 99 パーセンタイルは 148.5 番目で、Python の `round`（偶数への丸め）で
  決めると 148 番目を返し、本来より小さい値になります。TypeScript の `Math.round` は 148.5 を 149 にするので
  この例では切り上げと同じですが、160 個の列（158.4 番目）では 158 番目を返します。両方の言語のテストに、
  160 件の例も置いています
- 中で写してから並べます。測った順のまま渡してよく、渡した列は書き換えません
- 止める値：百分率が 1 以上 100 以下の整数でないとき、列が空のとき、列が NaN を含むとき。TypeScript は
  `RangeError`、Python は `ValueError` で止めます（Python の百分率が int でないときは、下の「言語で形が
  変わったところ」）。範囲の外を最小や最大に丸めると、呼び出しの誤りに気づけません。0 は位置が 0 番目になり、
  検査が無いと、Python は添字 -1 で最大を、TypeScript は undefined を返します。NaN はどの値と比べても偽なので、
  並べた順が崩れます（Python の `sorted([3.0, nan, 1.0, 2.0])` は、先頭が 3.0 のままです）

列の中の値を返すので、99 件までの列の 99 パーセンタイルは、最大と同じ値です（99 件では ceil(98.01) = 99 番目）。
p99 を合否の判定に使うなら、100 件より少ない列では合否を出さない、といった決まりは、使う側が持ちます。

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、起動のたびに
同じ結果を出す）だけです。計算は、整数の掛け算と割り算（TypeScript は切り上げも）と、大小の比べだけです。
両方の言語のテストに同じ例（100 件の 7、150 件と 160 件の 99、小数の形と食い違う 12 個の百分率など）を置いていますが、
表として突き合わせてはいません。

言語で形が変わったところは3つです。

- 百分率に整数でない値を渡したとき：Python は int と float を型で分けるので、int でない値（50.0 も）を
  `TypeError` で止めます。bool は int の子なので、型検査は `True` を止めず（1 として通ります）、実行時に
  止めます。TypeScript は数が1種類で、`50.0` は `50` と同じ値なので受け、`50.5` は整数でない値として
  `RangeError` で止めます。真偽値は型検査が止め、実行しても整数でないので止まります
- 並べ方：TypeScript の `sort` は、比べる関数を渡さないと数を文字列にして並べます（`[10, 9, 1]` は
  `[1, 10, 9]`）。比べる関数は、差（`a - b`）でなく大小の比べで書き、NaN の扱いに頼りません。`sort` は配列
  そのものを並べ替えるので、写してから当てます（写して並べる `toSorted` は ES2023 で、このリポジトリの型の
  設定〔ES2022 だけ〕に無く、型検査が止めます）。Python の `sorted` は、新しい列を数の大小で並べて返します
- 標準ライブラリ：Python の `statistics.quantiles` は補間します。1 から 100 までの列の 99 番目の区切りは、
  既定（`method='exclusive'`）で 99.99、`method='inclusive'` で 99.01 で、どちらも列の中の値ではありません。
  TypeScript には標準のものがありません。どちらの言語も自分で書きました

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- 描画の重さの測定の記録（[bench_result.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tools/bench_result.py) の
  `percentile` と `summarize`）から持ってきました。フレームの時間から p50・p95・p99 を出し、フレームの間の
  待ち方の決め方（[bench_pacing_rule.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tools/bench_pacing_rule.py)）も
  p50 と p99 を使います。テスト（[test_bench_result.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/tools/test_bench_result.py)）は、
  100 件の 0.99 が 99、600 件が 594、150 件が 149（偶数への丸めだと 148 番目）になることと、範囲の外と空の列で
  止まることと、測った順のまま `summarize` に渡してよいことを見ています。数え方は
  [py/README.md](https://github.com/nakatama225/animal-bomber/blob/main/py/README.md) にも「600 フレームなら
  遅いほうから 7 番目で、100 フレームに1回ある遅さ」と書いています
- animal-bomber の `percentile` は、速い順に並べた列と、0 より大きく 1 以下の割合 `q` を受けます。並べるのは
  呼ぶ側で、`summarize` が `sorted` してから渡します。このリポジトリは中で並べ、百分率を整数で受ける形に
  変えました。animal-bomber が使う 0.5・0.95・0.99 は、上のとおり小数の形でも食い違わないので、animal-bomber の
  結果に誤りはありません
- 使う側の決まりは、関数の外のものなので持ってきていません。合否の判定
  （[bench_gate.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tools/bench_gate.py)）は、100 フレームより
  少なく測ったときは p99 が最大と同じ値になるので、合否を出しません（`MIN_GATE_FRAMES = 100`）。記録のまとめ
  （bench_result.py の `Stats`）の説明には、実時間の p99 が CPU を使った時間の p99 よりずっと大きければ、遅い
  フレームの間、OS がプロセスを止めていた見込みが高い、とあります
- TypeScript 版に使う所はありません（animal-bomber の TypeScript 版に、パーセンタイルを求める所は無い）。
  TypeScript 版は、ブラウザで測った時間を同じ数え方でまとめるときに使います

### 禁則つきの行詰め

文を折り返してよい単位に切り、幅に収まるように前から詰めて行に分ける部品です（`line-break.ts`・`line_break.py`）。
描かず、幅は呼ぶ側が渡す測る関数で測るので、書体や描く仕組みを読み込まずに使え、テストでは文字数を数える
偽物で足ります。関数は3つです。

- 単位に切る（`breakUnits`・`break_units`）：ASCII の空白でない字（`!` から `~` まで。英数字と記号）の続きは
  1つにまとめ、ASCII の空白（U+0020）は1つずつ、ほかの字（日本語・絵文字など）は1字ずつ切ります。行の頭に
  置かない字（閉じかっこ・句読点・長音など）は前の単位に付けます。前の単位が空白なら、閉じかっこ・句読点・感嘆符と
  疑問符だけを、空白ごと空白の前の単位に付けます（「あ 。い」は「あ 。」「い」）。空白の前に単位が無ければ
  付けません。行の終わりに置かない字（開きかっこ）は、後ろの単位に付けます。開きかっこの直後の ASCII の空白も一緒に後ろに付けます
  （「あ（ い」は「あ」「（ い」）。文の終わりで控えに残った空白は、空白の単位に戻します。見え方を選ぶ印
  （U+FE0F）とつなぐ印（U+200D）は、前の字に付けます。印の付いた開きかっこも、単位の先頭の字で見て後ろに
  付けます。空白の直後の印は空白に付けず、印から新しい単位を始めます。単位をつなぐと、元の文に戻ります
- 詰める（`fillLines`・`fill_lines`）：単位の並びを、幅を超えないうちは同じ行に足していきます。単位の型を
  問わず、並べた単位の幅を測る関数と、空白かを答える関数を受け取ります。行の頭の空白は捨て、行の終わりの
  空白は除きます。1つで幅を超える単位は、その1つだけで1行にします（はみ出します）
- 文から行へ（`breakLines`・`break_lines`）：上の2つをつなぎ、文から行の文字列の並びを作ります。測る関数は、
  行に並べた単位をつないだ文字列を受け取ります

詰めるときは、単位ごとの幅の和が幅に収まるうちは行全体を測らず、和が幅を超えてから行全体を測って決めます。
そのために、測る関数に前提を1つ置いています。続けて並べた単位の幅は、別々に測った幅の和より広くなりません。
字詰め（隣り合う字の間を詰めること）で狭まり、幅を整数に切り上げる測り方でも、1つずつ切り上げた和のほうが
広いためです。和が収まるなら行も収まるので、長い文で、単位を足すたびに行全体を測る手間が要りません。
最後に和でなく行全体の幅で決めるのは、和が行全体より広く出るためです。1字ずつ測ると 12、3字を続けて測ると
30 になる測り方では、幅 30 に3字が収まります。和で決めると2字になります。

止める値：改行の字（`\n`・`\r`）を含む文、0 以下か NaN の幅、0 以上の数を返さない測る関数（負の数と NaN）。
TypeScript は `RangeError`、Python は `ValueError` で止めます。改行の字は、止めないと1字の単位になり、幅を
測られて行の中に並びます。段落の区切りは、呼ぶ側が先に分けます。NaN の幅は、比べるとどれも偽になり、黙って
1行にまとまります。

見ないものもあります。字は符号位置（コードポイント）ごとに読み、書記素（人が1字と見るまとまり）では
区切りません。2つの印のほかは別の単位になるので、つなぐ印でつないだ絵文字（家族の絵文字は3つに切れます）、
囲みの数字（1️⃣。数字に U+FE0F と、囲む印 U+20E3 を続けたもの）、肌の色を変えた絵文字、国旗、結合する濁点
（「か」と U+3099）は、行の境目で割れることがあります。TypeScript には書記素で区切る `Intl.Segmenter` があり
（このリポジトリの型の設定〔ES2022〕にも含まれます）、家族の絵文字を1つにまとめますが、Python の標準
ライブラリには同じものがありません。2つの言語で同じ単位にするため、どちらも2つの印だけを前の字に付けます。

禁則にも、扱わない所があります。

- 行の頭に置かない字は、日本語の主な約物（句読点やかっこなどの記号）の `、。，．）」』】〕〉》！？：；ー…‥・％` に
  限ります。小さい仮名（ぁ・っ など）は含めていません。日本語の直後の ASCII の記号（`!`・`)` など）も表に無いので、
  前の字に付かずに別の単位になり、行の頭に来ることがあります。animal-bomber の版も同じ切り方です
- ASCII の空白のほかの空白（全角の空白・タブ）は、空白として扱わず、1字の単位にします。行の頭でも捨てません
- 空白のあとのコロン・長音・三点リーダー・中黒・％（`：；ー…‥・％`）は、前の単位に付けません。UAX #14 でも
  空白のあとでは折り返せます（LB18）が、閉じかっこ・句読点と空白のあとの、コロン・セミコロン・中黒・長音
  （分類が NS。長音は CJ で、既定では NS として扱う）の前では折り返しません（LB16）。この部品はその区別を
  せず、`」 ・` や `。 ；` の中黒・セミコロンも行の頭に来ることがあります

テストの「禁則で扱わないもの」と「全角の空白とタブは空白として扱わず、行の頭でも残す」に、この切り方を置いています。

開きかっこの直後の ASCII の空白を一緒に後ろに付けるのは、Unicode の行分けの規則（UAX #14）の LB14
「開きかっこのあとは、空白をはさんでも折り返さない」に合わせたものです。空白で切ると、開きかっこと空白が
1つの単位（「（ 」）になり、空白として捨てられないので、行の終わりに開きかっこが残ります。文の終わりでは、控えに
残った空白を空白の単位に戻します。控えのまま1つの単位にすると、空白として除かれず、最後の行が空白で終わります。

空白の直後の印を空白に付けないのは、同じ規則の LB9（空白には印を付けない）に合わせたものです。空白に付けると、
空白と印が1つの単位になり、空白として捨てられないので、行の頭に空白が残ります。印の後ろで折るかは合わせて
いません。UAX #14 は残った印をふつうの字（分類 AL）として扱う（LB10）ので、後ろが英字なら折りませんが、
この部品は印の後ろで折ることがあります。

空白のあとの閉じかっこ・句読点・感嘆符と疑問符（`、。，．）」』】〕〉》！？`）を空白ごと前に付けるのは、同じ規則の
LB13（閉じかっこ・感嘆符・斜線の前では、空白をはさんでも折り返さない）に合わせたものです。UAX #14 の行分けの
分類で、句読点と閉じかっこは CL、感嘆符と疑問符は EX です。斜線（分類 SY）は ASCII の `/` で、この部品は ASCII の
記号を行の頭に置かない字として扱いません（上の「扱わない所」）。字だけを空白に付けると、空白と字が1つの単位
（「 。」）になり、行の頭に来ます。行の頭に置かない字のうち、残りの字（`：；ー…‥・％`）は、分類が NS・CJ・IN・PO で、
LB13 に当たりません。

この部品は固定値の表を持たず、約束は「決定性を崩す書き方の検査」の1つ目だけです。

言語で形が変わったところは2つです。

- 字の読み方：TypeScript の文字列は UTF-16 の単位で持つので、添字で1つずつ進めると、絵文字（😀 など）が
  サロゲート（2つで1字を表す単位）の片割れ2つに切れます。`Array.from` で符号位置ごとに読み、Python（文字列を
  符号位置ごとに読みます）と同じ単位にします。テストの偽の測る関数も、TypeScript は `[...text].length` で字を
  数えます（`.length` だと絵文字が2字になります）
- 単位の型：詰める関数は単位の型を問いません。Python は型変数（`TypeVar`。3.11 で動く書き方）で、TypeScript は
  型引数で書きます

animal-bomber から持ってきたものと、変えた点は次のとおりです。

- Python 版の画面の文の折り返し
  （[linebreak.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/presentation/render/ui/linebreak.py) の
  `break_units` と `fill_lines`）から持ってきました。呼ぶ側は文を描く部品
  （[typeset.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/presentation/render/ui/typeset.py)）の、
  文をそのまま折り返す `wrap` と、区切りのある文（太字やキーの形など）を折り返す `rich_lines` の2か所です。
  テスト（[test_linebreak.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/presentation/test_linebreak.py)）は、
  単位の切り方と、1字ずつ測ると広く出る測り方でも行のまま測って詰めることを見て、折り返しが pygame を
  読み込まないことも見ています
- animal-bomber の説明は、まとめる単位を「英数字の続き（ASCII の空白でない字）」と書いていますが、比べている
  のは `!` から `~` までで、記号も含みます。このリポジトリも記号を含め、説明を「ASCII の空白でない字」に
  しました
- 詰める関数の形は変えていません。単位の並びを測る関数と、空白かを答える関数を受け取る形です。`rich_lines` は、
  枠を描くキーを1つの単位にし、ほかの区切りが続く所は文をつないで `break_units` で切り、切った単位を区切りの
  境目で（文, 種類）の組に分けます。種類で幅（キーの枠の余白）と空白の扱いを変えて詰めます。このリポジトリの
  `fillLines`・`fill_lines` でも、同じように書けます（テストの「文と種類の組も詰められる」）。文字列を受ける
  `breakLines`・`break_lines` は、`wrap` と同じく、単位をつないだ文字列で測ります
- `rich_lines` は、前は区切りごとに `break_units` で切っていたので、区切りの境目に禁則が当たらず、マニュアルの
  「使える（」「Shift」「）」で、開きかっこが行の終わりに、閉じかっこが行の頭に来ることがありました。原型の
  マニュアルのキー（`kbd`）は inline で、ブラウザは区切りをまたいで禁則を当てるので、枠の無い区切りが続く所は
  文をつないで切る形に修正しました。原型のキーの案内の枠（`.k`）は inline-block で、CSS Text Level 3（5.5 節）は
  その前後を、禁則の字が隣にあっても折り返せる所にするので、枠を描くキーの前後は今までどおり切ります（規格は、隣が
  分類 GL・WJ・ZWJ の字のときを除きますが、animal-bomber の版は除かずに切ります。画面の文に、この並びはありません）
- 開きかっこを控えている間に閉じかっこが来ると、animal-bomber の版は、閉じかっこを控えより前の単位に付けて
  いました。「あ（）い」は「あ）」「（い」になり、つなぐと「あ）（い」と字の順が入れ替わっていました（中の無い
  かっこで起きていました）。このリポジトリは、控えがあるときは前の単位に付けず、控えとつなぎます（「あ」「（）」
  「い」）。単位をつなぐと元の文に戻ることを、表のテストにしています。animal-bomber の版も、この形に修正しました
- 開きかっこの直後の ASCII の空白は、animal-bomber の版もこのリポジトリも、開きかっこと1つの単位（「（ 」）に
  していました。上の LB14 に合わせて、両方を、空白も控えと一緒に後ろに付ける切り方に修正しました
- 開きかっこの直後に見え方を選ぶ印かつなぐ印が来ると、印が開きかっこに付いて単位が「（」と印の2字になり、
  単位そのものを開きかっこの表と比べていたので当たらず、開きかっこが行の終わりに残っていました（animal-bomber の
  版も、このリポジトリも）。両方を、単位の先頭の字で見る形に修正しました
- 空白の直後の行頭禁則の字は、animal-bomber の版もこのリポジトリも、前の単位に付けず、空白で折り返して行の頭に
  置くことがありました（「あ 。」は「あ」「 」「。」）。上の LB13 に合わせて、両方を、閉じかっこ・句読点・感嘆符と
  疑問符だけを空白ごと前に付ける切り方に修正しました。animal-bomber の画面の文には、空白の直後にこれらの字が来る
  並びが無いので、画面の折り返しは変わりません
- 空白の直後に見え方を選ぶ印かつなぐ印が来ると、印が空白に付いて単位が空白と印の2字になり、空白として捨てられず、
  行の頭に空白が残っていました。文の終わりが開きかっこと空白のときは、控えが「（ 」のまま1つの単位になり、最後の
  行が空白で終わっていました（animal-bomber の版も、このリポジトリも）。上の LB9 と文の終わりの扱いに合わせて、
  両方を修正しました
- 改行の字を止めることと、幅と測った値の検査は、このリポジトリで足しました
- TypeScript 版に使う所はありません。animal-bomber の TypeScript 版は、文をブラウザの画面に置き、折り返しは
  CSS が決めます（[style.css](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/style.css) の通信対戦の
  案内の帯）。canvas に文を描くときは、ブラウザが折り返さないので、この部品が要ります

### 大円距離

緯度と経度の2点から、地表に沿った距離を求める部品です（`geo.ts`・`geo.py`）。地球を球とみなす近似で、
楕円体の上の精密な距離には向きません。

- 緯度と経度の組（`LatLon`）：作るときに範囲（緯度は -90 以上 90 以下、経度は -180 以上 180 以下）を検査し、
  作ったあとは書き換えられません。境界の 90 と 180 は受けます（経度の 180 と -180 は同じ経線です）。4つの数を
  位置で渡すと、緯度と経度の順を取り違えても気づけないので、組にして名前で読みます
- 大円距離（`greatCircleKm`・`great_circle_km`）：2点の間の、球の表面に沿った最短の道のり（大円の弧の長さ）を、
  ハーサイン公式（haversine formula）で求めます。半径は既定値を置かず、呼ぶ側が渡します。地球の平均の半径なら
  6371 km がよく使われます
- 止める値：範囲の外の緯度と経度（NaN と無限大を含む）と、0 以下か NaN か無限大の半径。TypeScript は
  `RangeError`、Python は `ValueError` で止めます

ハーサイン公式は、2点の緯度 φ1・φ2 と経度の差 Δλ から、中心角 θ の半正矢（haversine。hav θ = sin²(θ/2)）を
`h = sin²((φ2 − φ1) / 2) + cos φ1 · cos φ2 · sin²(Δλ / 2)` で求め、`θ = 2 · atan2(√h, √(1 − h))` に戻します。
h は真の値では 0 以上 1 以下ですが、対蹠点（地球の反対側の点）の近くでは、丸めで 1 をわずかに超えます。
(−87.5, −180) と (87.5, 0) では 1.0000000000000002 で、同じ Mac の Python 3.14・3.11 と Node.js 26 の3つとも
超えました。緯度 0.5 度・経度 2.5 度の刻みで選んだ対蹠点の組 52345 組では、Python で 3190 組、Node.js で
2900 組が超え、両方で超えたのは 2320 組でした。どの組で超えるかは、環境の数学の関数しだいです。そのまま
√(1 − h) を取ると、Python は `ValueError` で止まり、TypeScript は NaN になり、`Math.atan2` も NaN を返して、
例外を出さずに進みます。そこで、どちらの言語も、1 を超えた h を 1 に収めてから平方根を取ります。h は 0 より
小さくはなりません。範囲の内の緯度では cos φ が 0 以上（緯度 90 度でも 6.1e-17）で、どの項も 0 以上です。

テストの期待値は、式と独立に分かっている値から出しています。経線に沿った緯度1度は、半径に1度の弧度
（ラジアン。角の大きさを、半径1の円の弧の長さで表したもの）を掛けた長さです（半径 6371 km で
111.19492664455873 km。π × 6371 / 180 と同じ値）。赤道の対蹠点は半周（π × 6371 = 20015.086796020572 km）
です。(0, 0) と (45, 90) の中心角はちょうど 90 度で、4分の1周（π × 6371 / 2）です。2点の緯度が違う組なので、
cos φ1 · cos φ2 の片方を取り違える式の誤りが見えます。赤道の (0, 10) と (0, 20) は、経度 10 度ぶんの長さです。
起点の経度が 0 でない組なので、経度の差でなく和を使う式の誤りが見えます。北緯 60 度の経度1度は、緯線に沿えば
赤道の半分ですが、大円は緯線より短いので、半分より少し短くなります（赤道の経度1度との比は 0.49999524 で、
半分の 0.5 より少し小さい）。この
期待値は、同じ緯度の2点の中心角 2 · asin(cos φ · sin(Δλ / 2)) から出しています。asin の式で出した期待値は
55.59693407114086 km で、部品が返す値とは最後の桁が違います（部品の値も、下のとおり Python と Node.js で
違います）。

この部品は固定値の表を持ちません。三角関数（sin・cos・atan2）は、最後の桁が環境と言語で違うことがあるためです
（下の「決定性を崩す書き方の検査」）。同じ環境なら起動のたびに同じ値ですが、環境と言語をまたぐと最後の桁が
違いえます。同じ Mac でも、北緯 60 度の経度1度は、Python が 55.596934071140865、Node.js が 55.59693407114088
でした。テストは相対の差 1e-12 まで許して比べます（同じ点の 0 だけは等号で比べます）。2乗は `**` でなく
掛け算で書きます。度から弧度への換え方は、TypeScript も Python の `math.radians` と同じく、度に π / 180 を
掛けます。

言語で形が変わったところは3つです。

- 範囲の検査を通さない値を渡せるか：Python の型検査（mypy）は、クラスの型を名前で比べるので、`LatLon` を受ける
  所には `LatLon` で作った値しか渡せません。TypeScript は型を形で比べるので、公開の項目だけのクラスだと、
  同じ形のオブジェクト（`{ lat: 91, lon: 0 }`）を、範囲の検査を通さずに `LatLon` として渡せます。そこで
  TypeScript の `LatLon` に private の項目を持たせました。private の項目を持つクラスの型には、そのクラスで
  作った値しか合いません。この項目は `declare` を付けた型の上だけのもので、実行時の値には作らないので、
  `JSON.stringify` や `Object.keys` には出ません。`#` で始まる項目でも同じ働きになりますが、`#` の項目は実行時にも
  作られ、どこからも読まないと、静的検査の規則（`no-unused-private-class-members`）が止めます
- 書き換えの止め方：Python は frozen の dataclass で、型検査と実行時（`FrozenInstanceError`）の両方で
  止まります。TypeScript の `readonly` は型検査だけの約束なので、コンストラクタの終わりで `Object.freeze` します
- NaN の止め方：どちらの言語でも、NaN との大小の比べはすべて偽です。Python は「範囲の内でなければ止める」形
  （`not -90 <= lat <= 90`）で書き、NaN はこの比べで止まります。TypeScript は、範囲の外を「下限より小さいか
  上限より大きい」で見る形に `Number.isNaN` を足して、NaN を止める意図を書いています。下限と上限の比べだけ
  では、NaN が通るためです

data-science-portfolio から持ってきたものと、変えた点は次のとおりです。

- 発射場から海岸などまでの距離を測る所
  （[geo.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/src/spacex_capstone/analysis/geo.py) の
  `Coordinate` と `haversine_distance_km`）から持ってきました。テストは
  [test_analysis.py](https://github.com/nakatama225/data-science-portfolio/blob/main/ibm-capstone-spacex/tests/test_analysis.py)
  にあります。範囲の検査は Python と同じ形で、NaN は比べで止まります。使ったのはこの Python の1か所で、
  TypeScript に使う所はありません。TypeScript 版は、ブラウザで2点の間の距離を出すとき（地図の上で選んだ2点など）
  に使います
- 中間の値の変数の名前 `chord`（弦）を、`hav` に改めました。値はハーサイン公式の h（中心角の半正矢）で、弦の
  長さではありません
- 1 に収める処理を足しました。data-science-portfolio の版は √(1 − h) を収めずに取っていたので、上の (−87.5, −180) と
  (87.5, 0) では `ValueError` で止まっていました。data-science-portfolio の版にも、1 に収める処理を足しました
- 半径の既定値を置かず、呼ぶ側に決めさせます。data-science-portfolio は 6373.0 km を「中緯度に合う値を1つ
  選んで固定」としていますが、よく使われる地球の平均の半径は 6371 km です
- data-science-portfolio のテストのうち、海岸までの距離を「地図上で読み取れる約 7.7km」と比べるもの（差は
  0.2 km まで許す）は、手本にしていません。期待値が地図の読み取りで、式の誤りを見つけるには粗いためです。
  緯度1度を「約 111 km」と比べるもの（差は 1 km まで許す）と、北緯 60 度を「赤道の半分」と比べるもの（相対の
  差 1% まで許す）の代わりに、このリポジトリのテストは、上のとおり独立の式から出した値と相対の差 1e-12 で
  比べ、北緯 60 度は半分より短いことも見ます

### 最小ベイズリスクによる選択

候補の中から、ほかの候補と最も似ているものを選ぶ部品です（`mbr.ts` の `mbrSelect`・`mbr.py` の `mbr_select`）。
最小ベイズリスク（Minimum Bayes Risk、MBR）による選択で、機械翻訳や要約で、モデルが出した複数の候補のどれを
答えにするかを決めるのに使います。候補ごとに、ほかのすべての候補との似ている度合いの平均を求め、最も高い候補の
位置を返します。ほかの多くの候補と似ている候補は、候補の集まりが共通して支持する答えとみなせます。モデルが最も
高い確率を付けた候補（ビームサーチの1位）をそのまま採ると、確率は高いが、ほかの候補とかけ離れた答えを選ぶことが
あります。

- 似ている度合いを求める関数は、呼ぶ側が渡します。翻訳なら chrF++ や BLEU（文字や語の n-gram の一致）です。
  候補は文字列に限りません。距離に負の符号を付けた関数を渡すと、ほかの点との距離の和が最も小さい点を選び、
  数直線の上なら中央値の点になります（テストに例があります）
- 関数は「候補、相手」の向きで、自分以外の相手と1回ずつ、計 n × (n − 1) 回呼びます。chrF++ や BLEU のように
  向きで値の変わる物差しは、候補を訳、相手を正解とみなして測る形になります
- 平均が同じ候補が並んだら、前にあるほうを返します。候補が1つなら、関数を呼ばずに 0 を返します
- 同じ値の候補は別々に数えます。同じ答えが2回出たことを、支持が多いしるしとして扱うためです。数えたくなければ、
  呼ぶ側が先に除きます
- 止める値：空の列と、関数が有限の数でない値（NaN・無限大）を返したとき。TypeScript は `RangeError`、Python は
  `ValueError` で止め、止める文に、どの候補と相手で発生したかを書きます。NaN はどの値と比べても偽なので、最も高い
  ものを選ぶ結果が、比べ方と並び順で変わります（Python の組み込みの `max` は、`[nan, 1.0]` では nan を、
  `[1.0, nan]` では 1.0 を返します）。無限大は、平均をほかの相手の値によらないものにします

返すのは値ではなく位置です。同じ値の候補が複数あっても、どれを選んだかが分かり、候補に付けたほかの情報（どの
モデルの、どの出し方の候補か）を位置で取り出せます。

テストの多くは、似ている度合いを表（候補の番号 × 相手の番号）で与え、平均を手で計算できる形にしています。
1つの相手と最も似ている候補（0.9）より、平均の高い候補（0.5）を選ぶ例で、平均ではなく最大で比べる誤りが
見えます。翻訳らしい例として、銀の話3つとロバの話1つの候補から、文字の 2-gram の重なりで「the silver was sent」を
選ぶものも置いています。部品を5通りに壊した写し（同点で後ろを選ぶ・自分とも比べる・有限の数かの確認を外す・
向きを逆にする・平均でなく最大で比べる）では、両方の言語で、どれもテストが失敗することを確認しました。

この部品は固定値の表を持たず、約束は下の「決定性を崩す書き方の検査」の1つ目（同じ入力から、起動のたびに
同じ結果を出す）だけです。渡す関数がそうであることが前提です。平均は位置の小さい相手から順に足すので、足す順も
毎回同じです。

言語で形が変わったところは1つです。

- NaN の見本：TypeScript の静的検査の規則（`use-isnan`）は、NaN と直に比べる式を止めます。そこで TypeScript の
  テストは、大きいほうを残す畳み込みに NaN を先頭に置いた列と後ろに置いた列を渡し、並び順で結果が変わることを
  示しています。Python のテストは、組み込みの `max` で同じことを示しています

data-science-portfolio から持ってきたものと、変えた点は次のとおりです。

- Kaggle のアッカド語の翻訳コンペのノートブック
  （[01_ensemble-mbr-inference.ipynb](https://github.com/nakatama225/data-science-portfolio/blob/main/kaggle/deep-past-initiative-machine-translation/notebooks/01_ensemble-mbr-inference.ipynb)
  の `MBRSelector`）の選び方を、関数1つにしました。このノートブックのコードは公開ノートブックと同じもので
  （出典はノートブックのフォルダの README）、ここではコードを写さずに書きました
- ノートブックは、似ている度合いを chrF++・BLEU・Jaccard の重み付きの平均で求め、それとは別に、候補の語数が
  中央値から離れるほど下がる長さの点を足しています。長さの点は候補ごとの値で、2つの候補の似ている度合いの平均には
  含まれないので、この部品では表せません。表すには、候補ごとの点を足す引数が必要です（使う所が2つ目に出たら足します）
- ノートブックは、候補の前後の空白を除いてから重複を消し、最初の 32 個までを比べます。この部品は、渡された候補を
  そのまま比べます。重複を消すか、何個までにするかは、呼ぶ側が決めます
- ノートブックは `numpy.argmax` で最も高い候補を選びます。同点で前の候補を選ぶのは、この部品と同じです
- TypeScript 版に使う所はありません（ノートブックは Python）。TypeScript 版は、ブラウザで複数の候補から1つを
  選ぶときに使います

### 決定性を崩す書き方の検査

`lib/` の部品の約束は2段です。

- すべての部品：同じ入力から、起動のたびに同じ結果を出します。乱数と時刻は、引数で受け取ります
- 固定値の表を持つ部品（乱数と状態の要約と輪の上の位置）：さらに、実行環境と言語をまたいでも、1ビットも違わない
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
（[lint-lib-rules.test.ts](typescript/tests/lint-lib-rules.test.ts)）で確認しています。

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
  `hash` であるため）。Enum は決まった値に見えるので、気づきにくい所です。いまの `lib/` では、
  毎回読む値の判定が `frozenset` を返しますが、部品の中では順に取り出さないので、検査を置いて
  いません。返した集まりを順に取り出すかは呼ぶ側が決め、順が要るなら `sorted` で順を決めてから
  取り出します。`lib/` に順に取り出す部品を置くときも同じです。TypeScript の `Set` と `Map` は
  入れた順を保つので、この問題はありません

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
| Strategy（答え方を差し替える）と登録表 | 同じ問いへの答え方を、名前で取り出せるように並べる。答え方を足すときに、使う側と既存の答え方を触らない | [strategy.ts](typescript/src/patterns/strategy.ts) | [strategy.py](python/src/algorithms_and_patterns/patterns/strategy.py) |
| Chain of Responsibility（規則を優先順に試す） | 1つの長い if の連なりを、独立した規則の並びにする。規則を足す・外す・入れ替えるのが、並びの1行の操作になる | [chain-of-responsibility.ts](typescript/src/patterns/chain-of-responsibility.ts) | [chain_of_responsibility.py](python/src/algorithms_and_patterns/patterns/chain_of_responsibility.py) |
| State（状態を閉じた union で表す） | 取りうる状態を型で閉じ、状態ごとに持つ値を分ける。状態を足したときの扱い忘れを、型検査が見つける。値を返さない分岐の書き忘れも、型検査と静的検査の設定で見つける。種類ごとの性質を1か所にまとめると、共通の処理は種類を見ずに性質だけで書ける | [state.ts](typescript/src/patterns/state.ts)（性質の表の見本は [state-traits.test.ts](typescript/tests/patterns/state-traits.test.ts)） | 部品は無し（標準ライブラリで足りる）。書き方の見本は [test_state.py](python/tests/patterns/test_state.py) と [test_state_traits.py](python/tests/patterns/test_state_traits.py) |
| 単位を型で分ける（ブランド型） | 実行時は同じ数でも意味の違う値（区間ごとに 0 へ戻る番号と通しの番号、メートルと秒など）を別の型にし、取り違えを型検査に見つけさせる | [brand.ts](typescript/src/patterns/brand.ts) | 部品は無し（`typing.NewType` で足りる）。書き方の見本は [test_brand.py](python/tests/patterns/test_brand.py) |
| 二段の更新（同じ番のものをすべて進めてから後の処理を呼ぶ） | たくさんのものを1刻みずつ進め、後の処理（ぶつかったかを見る、など）とほかのものの進める処理が互いの結果を読むとき、同じ番のものをすべて進めてから、後の処理を呼ぶ。進める順は呼ぶ側が渡す鍵で決め、返す並びは元の順のまま | [phased-update.ts](typescript/src/patterns/phased-update.ts) | [phased_update.py](python/src/algorithms_and_patterns/patterns/phased_update.py) |

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

### 二段の更新：進める順と並びの順を分ける

たくさんのものを1刻みずつ進め、進めたあとに後の処理（ぶつかったかを見る、など）を呼ぶとき、1つずつ
「進めてすぐ後の処理」を呼ぶと、先に後の処理を呼んだものが、まだ進んでいないものの古い状態を読みます。
逆に、あとから進むものの進める処理が、先に呼んだ後の処理の結果を読むこともあります。どちらも、結果が
並びの順に左右されます。`advance_in_phases`・`advanceInPhases` は、1回の呼び出しを番（まとめて進める段）に
分け、番ごとに、その番のものをすべて進めてから、役目を終えなかったものの後の処理（`settle`）を呼び、
次の番へ移ります。

進める順と、返す並びの順を分けています。進める順は、呼ぶ側が渡す関数（`order`）が1つずつ返す鍵
（番, 番の中の順）で決めます。番の小さい順に進め、同じ番の中は2つ目の小さい順です。新しく並んだものから
進めるなら、2つ目に位置の符号を反転した値を返します。返す並びは、呼んだ時点の並びの順のままです。
並びの順を状態の要約に混ぜていても、混ぜる並びの順は進める順に左右されません。

約束は次のとおりです。

- 後の処理は、番ごとに、その番のものをすべて進めたあとで、役目を終えなかったものにだけ、並びの順
  （古いものから）に呼びます。番の中を新しいものから進めても、後の処理は古いものから呼びます
- 進める処理（`advance`）は、役目を終えたかを真偽値で返します。真なら終えたものとして、返す並びから外し、
  後の処理も呼びません
- 鍵は、何も進める前に、1つにつき1度ずつ求めます（下の選ぶ関数も、何も進める前に1度ずつ呼びます）。
  進める処理が鍵の元の値を変えても、その刻みの順は変わりません
- 鍵がまったく同じものどうしは、並びの順に進めます。Python の `sorted` と、JavaScript の
  `Array.prototype.sort`（ES2019 から）が安定な並べ替え（等しいものの順を保つ）であることに頼っています
- 並びは呼んだ時点で写し、写した並びの位置（添字）で扱います。同じものかを比べないので、等しい値が
  2つ並んでも別々に進み、片方だけが役目を終えても、もう片方は残ります
- 進めている間に呼ぶ側が自分の並びへ足したものは、進めず、後の処理も呼ばず、返す並びにも含めません。
  呼ぶ側が、呼ぶ前の長さ `n` を覚えておき、返った並びの後ろに `items[n:]`（TypeScript は `items.slice(n)`）を
  付けます。この付け方は、呼んでいる間、呼ぶ側の並びの後ろに足すだけのときに合います。外したり途中に
  差し込んだりすると、`items[n:]` が増えたものと合わなくなります
- 呼んだ並びは書き換えず、新しい並びを返します
- 選ぶ関数（`picks`）を渡すと、選ばなかったものは進めず、後の処理も呼ばず、返す並びの元の位置に残します

進める処理や後の処理が起きたことを返したいときは、呼ぶ側が関数で包み、自分の列に足します。部品が返すのは
並びだけです。

この部品のどこまでが要るかは、進める処理と後の処理が何を読むかで決まります。

- 後の処理が無く、進める処理が並びのほかのものの進めた結果を読まず、起きたことも返さないなら、どの順に
  進めても結果は同じです。この部品は要らず、ふつうの for 文で足ります
- 後の処理が並びのほかのものの進めた結果を読むか、後の処理が変えた値を、並びのほかのものの進める処理が
  読むなら、進める処理どうしが互いを読まなくても、二段に分けることは要ります（下の追いかける炎は後者です）
- 番の中の順（新しいものから進めるか）は、同じ番の進める処理が互いの進めた結果を読まず、起きたことも
  返さないなら、結果に影響しません

animal-bomber では、盤面に出て自分の規則で動き続けるもの（落とし穴・追いかける炎・跳ねる爆弾など。以下、
盤面の物）を進める1か所で使っています（Python 版の actors.py の `_advance`、TypeScript 版の ActorSystem.ts の
`#advance`）。

- 追いかける炎は、最初は1つずつ動いてすぐ当たりを見ていました。古い炎の当たりで相手の体力が尽きると、
  相手は盤面を離れるので、同じ刻みに動く新しい炎は、その相手を追いませんでした。原型（ブラウザで動く最初の版）は、
  すべての炎を動かす輪のあとに別の輪で当たりを見るので、新しい炎も相手のほうへ一歩進んでいます。
  動くのと当たりを見るのを分けて、この形にしました（Python 版のコミット fa19537。TypeScript 版から移した修正）
- 原型は、種類によって配列を後ろから走査します。後ろから走査すると、同じ刻みに2つが同じマスを取り合えば
  新しいほうが取り、乱数も新しいほうが先に取り出します。animal-bomber は、新しく出たものから進めるかを
  種類ごとの性質（Python 版の state/actors.py の `newest_first`、TypeScript 版の WorldActor.ts の `newestFirst`）として
  持ち、進める処理は種類を見ずに、番と、この性質だけで並べています（Python 版のコミット db851a8）。下の
  「Strategy と State は逆の性質を持つ」の、種類ごとの性質を1か所にまとめる形と同じ考えです。このリポジトリの
  `order` は、その性質を鍵に換える所に当たります
- 追いかける炎には、新しいものから進める性質を付けていません。原型は炎を動かす輪を後ろから走査しますが、
  炎の動きはほかの炎を読まず、起きたことも返さないので、動かす順は結果に影響しません。動く間に起きたことを
  返すようにしたら付ける、と fa19537 の本文に書いています（上の、番の中の順が結果に影響しない場合に
  当たります。二段に分けることは、当たりを見る後の処理のために要ります）

animal-bomber から変えた点が4つあります。

- 増えたものの見分け方：animal-bomber は、進めている間に増えたものを「盤面の物の並びにあり、写した並びに
  無いもの」（`actor not in current`）として探し、後ろに付けます。盤面の物は項目で比べない（`eq=False`）ので、
  `in` は同じ実体かを見ます。このリポジトリの部品は写した並びの位置で扱い、同じものかを比べません。増えた
  ものは呼ぶ側が、呼ぶ前の長さから後ろを切り出して付けます。そのため、等しいと比べられる値（数や、項目ごとに
  比べる dataclass）を並べても取り違えません。その代わり、この付け方は、呼んでいる間に呼ぶ側の並びの後ろに
  足すだけのときに合います（上の約束の箇条）。animal-bomber の実体の比べは、外したり途中に差し込んだりしても
  増えたものを見つけます。animal-bomber の進める処理は盤面の物の並びの後ろに足すだけなので、どちらの付け方
  でも同じになります
- 返す値：animal-bomber の進める処理は、役目を終えたかと、起きたことの列を1つの値（Python 版の results.py の
  `Progress`。`done` が真なら終えた）で返します。このリポジトリは真偽値だけを返し、向きは同じ（真なら終えた）です。
  起きたことは、上のとおり呼ぶ側が包んで集めます
- 番の中を新しいものから進める並べ方：animal-bomber の2つの版で書き方が違います。Python 版は1つずつ位置の
  符号を反転し、TypeScript 版は比べる2つがどちらも新しいものから進めるときだけ逆にします。同じ番に向きの違う
  ものが混ざると2つの版で順が変わりますが、animal-bomber は「同じ番のものには同じ値を付ける」と約束して
  避けています（state/actors.py の `newest_first` の説明）。このリポジトリの `order` は鍵の組を返すので、2つの
  言語で同じ順になります
- 鍵の求め方：animal-bomber の TypeScript 版は、並べ替えの比べる関数の中で、位置を `indexOf` で毎回探します。
  このリポジトリは、鍵を先に1度ずつ求めてから並べます

選ぶ関数は animal-bomber の形のまま残しました。animal-bomber の2つの呼び出し（Python 版の `step_actors` と
`step_owned_actors`、TypeScript 版の `step` と `stepOwnedBy`）は、このリポジトリの形なら、どちらも同じ `order`
（番と、新しいものから進めるなら位置の符号を反転した値、でなければ位置）を渡し、選ぶ関数だけを変えて書けます
（TypeScript 版の番 `'owner'` は、animal-bomber の `turnOrder` と同じく数の 0 に換えます）。
プレイヤーが動いたあとに進めるほうは「持ち主の番に進めるもの（Python 版の `OWNER_TURN`、TypeScript 版の
`'owner'`）でない」を、持ち主の番に進めるほうは「持ち主の番に進めるもので、持ち主がそのプレイヤー」を渡します。
`advance` と `settle` は、起きたことを呼ぶ側の列に足す関数で包みます。TypeScript 版の `settle` は盤面の物
ごとの省ける項目なので、包む関数は `settle` を持つものにだけ呼びます（`actor.settle?.(world)` の形）。
呼んだあとは、返った並びの後ろに、進める間に増えた盤面の物を付けて戻します。
選ぶ関数を部品に持たせたのは、選ばなかったものを元の位置に残すためです。呼ぶ側が先に選んで渡すと、返った
並びと選ばなかったものを合わせて元の順に戻す手間が呼ぶ側に移り、戻すには位置か、同じものかの比べが要ります。

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
- 歩の番号の検査：TypeScript の `number` は整数と小数を区別しないので、
  整数かどうかを実行時に検査します。Python は `int` があるので、型検査に任せます
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

#### 二段の更新

- 並べて区切る書き方：Python は鍵の tuple で `sorted` し、`itertools.groupby` で番ごとに区切ります。`groupby` は
  隣り合うものしかまとめないので、先に番で並べます。TypeScript は比べる関数を渡して写しに `sort` を当て、番ごとに
  区切るのは for 文で書いています。並べた写しを返す `toSorted`（ES2023）と、区切る `Map.groupBy`・
  `Object.groupBy`（ES2024）は、このリポジトリの型の設定（ES2022 だけ）に無く、型検査が止めます
- 鍵を集める書き方：Python は、`sorted` に渡す鍵の列を生成式でなくリスト内包で作っています。
  Chain of Responsibility と同じく、生成式の中から StopIteration が出ると RuntimeError に置き換わり
  （PEP 479）、呼ぶ側の `order` や `picks` が出したものが別の例外に化けて届くためです。TypeScript に同じ
  置き換えはありません
- 鍵が整数であること：Python は鍵を `int` の組と型で書き、整数でない鍵（`0.5` など）は型検査（mypy）が止めます。
  実行時には見ません。TypeScript の `number` は整数と小数を区別しないので、鍵を求めた所で整数かを見て、整数で
  なければ何も進める前に `RangeError` で止めます。NaN を受け付けると、比べる関数が大小を答えられず、並べる順が
  実装任せになるためです。Command の歩の番号と同じ分け方です
- 後の処理の型：Python は値を返さない関数の型（`Callable[[T], None]`）で、値を返す関数を渡すと型検査が止めます。
  animal-bomber の後の処理のように起きたことの列を返す関数をそのまま渡すと、返した列が黙って捨てられるので、
  止まるほうが安全です。TypeScript の `(item: T) => void` は、値を返す関数も受け付け、型検査は止めません。
  起きたことを返す後の処理は、どちらの言語でも呼ぶ側で包んで集めます（両方の言語に、この違いを示すテストが
  あります）

### Strategy と State は逆の性質を持つ

Strategy は、答え方を後から足せる代わりに、どんな答え方があるかが型に現れません。
名前の書き間違いは、その名前で取り出すまで分かりません。State は、取りうる状態を型で閉じる代わりに、
状態を足すたびに、それを扱う分岐をすべて書き足します。書き足し忘れは型検査が見つけます。

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
| 二段の更新 | animal-bomber の盤面に出て自分の規則で動き続けるもの（落とし穴・追いかける炎・跳ねる爆弾など）を進める所（[ActorSystem.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/systems/ActorSystem.ts) の `#advance`。呼び出しは `step` と `stepOwnedBy`）。進める番と、新しく出たものから進めるかの性質（[WorldActor.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/domain/abilities/WorldActor.ts) の `turn` と `newestFirst`）。偽の盤面の物で、進める順と `settle` を呼ぶ順だけを見るテスト（[tick-order.test.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/tests/systems/tick-order.test.ts)） | animal-bomber の同じ所（[actors.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/systems/actors.py) の `_advance`。呼び出しは `step_actors` と `step_owned_actors`）。進める番と、新しく出たものから進めるかの性質（[state/actors.py](https://github.com/nakatama225/animal-bomber/blob/main/py/src/animal_bomber/domain/state/actors.py) の `actor_turn` と `newest_first`）。進め方と `settle` を偽物に差し替え、順だけを見るテスト（[test_tick_order.py](https://github.com/nakatama225/animal-bomber/blob/main/py/tests/systems/test_tick_order.py)） |

ここに置いた形は、使った先の形をそのまま写したものではありません。使ってみて分かった
ことを反映して、手を加えてあります。たとえば Command は、歩の番号を処理の側が数えて渡す形にしました。
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
