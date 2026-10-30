# Python 実装

**現在の状態（2026年10月）**：`src/algorithms_and_patterns/patterns/` に設計の型が3つあります。
4つ目の State は標準ライブラリ（`typing.assert_never` と `match`）で足りるので、部品を置かず、
書き方の見本を `tests/patterns/test_state.py` に置いています。`lib/`（共通部品）には
決定的な擬似乱数（`rng.py`）と、状態の要約（`state_hash.py`）と、固定刻みの時間（`fixed_step.py`）と、
格子と幅優先の最短経路（`grid.py`）と、連鎖の一括処理と最も早い時刻（`cascade.py`）と、外から来た値の
読み取り（`strict_read.py` と、10 進の整数を書いた文字列を読む `decimal_text.py`）があります。
固定刻みの時間の待つ部品（締め切りまで眠る関数とフレームの輪）は、Python だけに置いています。TypeScript 版が `lib/` に置いた二分探索は、
標準ライブラリの `bisect` で足りるので置いていません。`problems/` はまだありません。

```text
python/
  pyproject.toml     依存と、静的検査（ruff）・型検査（mypy）・テスト（pytest）の設定
  uv.lock            依存の版を固定したもの。手で編集しない
  src/
    algorithms_and_patterns/
      py.typed       型注釈つきのパッケージであることの印。これが無いと、ほかのプロジェクトから
                     import したときに型検査が型注釈を読まない
      lib/           共通部品。patterns/ と problems/ を読み込まない
      patterns/      設計の型（抽象定義）
  tests/             src と同じ構造。State だけは部品が無く、書き方の見本をテストに置いている
    test_layers.py   lib/ が patterns/ と problems/ を読み込んでいないことの検査。src には対応しない
    lib/
      test_rng_derive_seed.py  rng.py の種を導く関数（derive_seed）のテスト。test_rng.py から分けた
      test_cross_language.py   TypeScript のテストの固定値の表を読み、Python のテストの表と比べる。
                               python/ の外のファイルを読む、ただ1つのテスト。src には対応しない
      test_determinism_guard.py  lib/ が乱数・時刻・起動ごとに変わる値（hash・id）を使っていないことの
                                 検査。禁じる名前の一覧はここが正。src には対応しない
      test_fixed_step.py         fixed_step.py の経過時間を刻みの数に換える部品（StepAccumulator）のテスト
      test_fixed_step_rate.py    fixed_step.py の倍率の部品（RateScaler）のテスト
      test_fixed_step_frames.py  fixed_step.py の締め切りまで眠る関数とフレームの輪のテスト
      fake_time.py               上のテストが使う偽の時計と偽の待ち方。テストの補助で、src には対応しない
      test_grid.py               grid.py の格子の入れ物（Grid）のテスト
      test_grid_path.py          grid.py の幅優先の最短経路（find_path）の探し方のテスト
      test_grid_path_invalid.py  grid.py の幅優先の最短経路（find_path）が止める値のテスト
      test_cascade.py            cascade.py の一括処理（cascade）のたどり方のテスト
      test_cascade_earliest_times.py  cascade.py の最も早い時刻（earliest_times）のテスト
      test_cascade_invalid.py    cascade.py の2つの関数が止める値のテスト
      fake_reaches.py            上のテストが使う偽の届く関係。テストの補助で、src には対応しない
      test_strict_read.py        strict_read.py の項目を1つ取り出す関数（read_int・read_list など）のテスト
      test_strict_read_json.py   strict_read.py の JSON の文字列を読み込む関数（load_json_object）のテスト
      test_strict_read_enum.py   strict_read.py の閉じた種類への読み替え（read_enum）のテスト
      error_head.py              上のテストと test_decimal_text.py が使う、止めた文の頭の比べ方。
                                 テストの補助で、src には対応しない
    patterns/
      test_command_arrival.py    command.py の届いた範囲を持つ記録（ArrivalLog）のテスト。
                                 test_command.py から分けた
      test_command_sources.py    command_sources.py の出どころを合わせる部品（CombinedSource）のテスト
      test_command_handover.py   command_sources.py の途中で替わる出どころ（Handover・HandoverSource）の
                                 テスト。test_command_sources.py から分けた
      test_command_handover_replay.py  command_sources.py の途中で替わる出どころを、届いた命令で進める側と
                                       保存したものを再生する側で比べるテスト。test_command_handover.py から分けた
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
