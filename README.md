# algorithms-and-patterns

[![状態：wip（作りかけ。安定して使える版はまだ無い）](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

アルゴリズムと設計パターンを、再利用できる部品として実装したものです。

**現在の状態（2026年10月）**：設計の型（`patterns/`）を4つ置いています。TypeScript は4つとも
部品とテストがあります。Python は3つに部品とテストがあり、残る State は標準ライブラリで
足りるので、書き方の見本をテストに置いています。共通部品（`lib/`）は置き始めたところで、
いまは TypeScript の二分探索だけです（Python は標準ライブラリの `bisect` で足ります）。
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
差は下の「言語で形が変わったところ」にまとめています。

### 3. すべての部品にテストを置く

`tests/` は `src/` と同じ構造にします。例外は2つで、Python の State は部品が無いので
見本だけをテストに置いています。層の向きと静的検査の設定を確認するテスト
（`test_layers.py`・`lint-rules.test.ts`）は、`src/` のどのファイルにも対応しません。
テストは、部品が正しく動くことの確認であると同時に、
**その部品が何を保証しているのかの記述**でもあります。エッジケース
（空、1件、重複、境界値、異常値）を通しておくと、読む人は仕様を読み取れます。

## 置いてある共通部品

| 部品 | 何をするか | TypeScript | Python |
|---|---|---|---|
| 二分探索 | 昇順に並んだ列で、値が入る位置を求める。同じ値が続くなら、その最初の位置（`bisectLeft`）か、最後の次の位置（`bisectRight`）を選べる | [bisect.ts](typescript/src/lib/bisect.ts) | 部品は無し（標準の `bisect`。3.10 から `key=`） |

二分探索は、同じものを2か所で手で書いていました。このリポジトリの Command の記録
（[command.ts](typescript/src/patterns/command.ts) の `at`）と、animal-bomber の操作の記録
（[InputLog.ts](https://github.com/nakatama225/animal-bomber/blob/main/ts/src/net/InputLog.ts) の `at`）です。
2か所目を共通化の合図と決めているので、`lib/` に引き上げ、Command はこれを使う形に
書き換えました（animal-bomber の側は、手で書いたままです）。答えは Python の `bisect_left`・
`bisect_right` と同じで、違うのは探す値が NaN のときに止まることだけです。Python は止まらずに、
先頭か末尾の位置を返します。中点は、手で書いていたときの `(low + high) >> 1` をやめ、割り算で
求めています。`>>` は値を 32 ビットの整数として読むので、和が 2**31 以上になると負になるためです。

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
