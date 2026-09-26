# Python 実装

**現在の状態（2026年9月）**：`src/algorithms_and_patterns/patterns/` に設計の型が2つあります。
`lib/` と `problems/` はまだありません。

```text
python/
  pyproject.toml     依存と、静的検査（ruff）・型検査（mypy）・テスト（pytest）の設定
  uv.lock            依存の版を固定したもの。手で編集しない
  src/
    algorithms_and_patterns/
      py.typed       型注釈つきのパッケージであることの印。これが無いと、ほかのプロジェクトから
                     import したときに型検査が型注釈を読まない
      patterns/      設計の型（抽象定義）
  tests/             src と同じ構造
```

標準ライブラリだけで書いているので、実行に要る依存はありません。
開発用の依存（ruff・mypy・pytest）だけを入れています。

置いてある型の一覧と、TypeScript 版との違いは[リポジトリ全体の README](../README.md) にあります。

## 検査

```sh
uv sync --frozen
uv run ruff check .          # 静的検査
uv run ruff format --check . # 書式
uv run mypy                  # 型検査（--strict 相当）
uv run pytest                # テスト
```

`requires-python` は 3.11 以降です。3.12 から入った型引数の書き方（`class CommandLog[C]:`）は
3.11 では構文エラーになるので、`TypeVar` で書いています。
