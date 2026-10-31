"""``lib`` の決定性を崩す書き方の検査。

``lib`` の部品は、同じ入力から、起動のたびに同じ結果を出す。乱数と時刻は引数で
受け取る。この約束を崩す書き方のうち、表のテストでは見つけにくいものを、``lib`` の
下のすべての ``.py`` の構文木（標準ライブラリの ``ast``）から探す。

- 乱数と実時間の主な出どころの import（``random``・``secrets``・``uuid``・``time``・
  ``datetime``）。見るのは、この5つのモジュールの import だけ
- 組み込みの ``hash`` と ``id``。呼び出しも、``sorted(xs, key=id)`` のような渡し方も
  見る。文字列の ``hash`` とオブジェクトの ``id`` は、起動のたびに変わる

どれも、結果が起動ごとや時刻ごとに変わる。固定値の表のテストは、たまたま同じ値が出た
起動では通ってしまうので、書き方そのものを止める。

``round`` は禁じない。同じ入力なら、起動や端末をまたいでも同じ値を返す。崩すのは
TypeScript の ``Math.round`` との一致（``round(2.5)`` は 2、``Math.round(2.5)`` は
3）で、それは2つの言語の固定値の表が見つける（README の「決定性を崩す書き方の
検査」）。

見ないものもある。``importlib`` や ``__import__`` に名前を文字列で渡して読み込むもの、
``builtins`` を別の名前で読み込んでから呼ぶもの、``os`` の乱数と実時間
（``os.urandom``・``os.getrandom``・``os.times``）、``hash`` をメソッドとして呼ぶもの
（``"a".__hash__()``）は見つけない。

禁じる名前は、このファイルの一覧が正。一覧を書き誤っても通り続けないよう、一覧の名前が
実在すること、その名前を使う書き方を実際に見つけることも、ここで確認する。
"""

import ast
import builtins
import importlib.util
from pathlib import Path

import pytest

from ..test_layers import SRC, TOP, case, lib_modules

# 乱数と実時間の出どころ。import そのものを禁じる。
BANNED_MODULES = ("random", "secrets", "uuid", "time", "datetime")
# 起動のたびに値が変わる組み込みの関数。
BANNED_BUILTINS = ("hash", "id")


def _is_banned_module(name: str) -> bool:
    """``name`` が禁じたモジュールか、その下のモジュールか。"""
    return name.split(".")[0] in BANNED_MODULES


def find_banned(source: str) -> list[str]:
    """``source`` の中の、禁じたモジュールの import と組み込みの関数の名前を返す。

    相対の import（``from .rng import Rng``）は、このパッケージの中のモジュールなので
    見ない。
    """
    found: list[str] = []
    # 関数の中や ``if TYPE_CHECKING:`` の中も読むよう、木のすべてをたどる。
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            found += [
                alias.name for alias in node.names if _is_banned_module(alias.name)
            ]
        elif isinstance(node, ast.ImportFrom) and node.level == 0 and node.module:
            if _is_banned_module(node.module):
                found.append(node.module)
            elif node.module == "builtins":
                # ``from builtins import id as ident`` と別の名前にして呼ぶ書き方。
                found += [
                    f"builtins.{alias.name}"
                    for alias in node.names
                    if alias.name in BANNED_BUILTINS
                ]
        elif isinstance(node, ast.Name) and node.id in BANNED_BUILTINS:
            # 呼び出しだけでなく、``key=id`` のように関数を渡す書き方も、名前を読む所で
            # 見つける。代入する所（``id = 1``）は読む所ではないので除く。
            if isinstance(node.ctx, ast.Load):
                found.append(node.id)
        elif (
            isinstance(node, ast.Attribute)
            and isinstance(node.value, ast.Name)
            and node.value.id == "builtins"
            and node.attr in BANNED_BUILTINS
        ):
            found.append(f"builtins.{node.attr}")
    return found


def scan(src: Path) -> dict[str, list[str]]:
    """``src`` の下の ``lib`` で読んだすべてのファイルと、それぞれで見つけた名前。

    禁じた書き方の無いファイルも、空の並びで持つ。どのファイルを読んだかを、結果から
    確認できるようにするため。
    """
    return {
        path.relative_to(src).as_posix(): find_banned(path.read_text(encoding="utf-8"))
        for path, _ in lib_modules(src)
    }


def test_libの下のどのファイルにも_禁じた書き方が無い() -> None:
    """乱数・時刻・起動ごとに変わる値を使うと、同じ入力でも結果が変わる。

    読んだファイルに既知のファイルが入っていることも、読んだ結果で確認する。探す場所を
    誤ると、何も読まずに通る。読む前の一覧で確認すると、読む所だけが別の場所を
    指したときに気づけない。
    """
    results = scan(SRC)
    assert f"{TOP}/lib/rng.py" in results
    assert f"{TOP}/lib/state_hash.py" in results
    assert f"{TOP}/lib/fixed_step.py" in results
    assert f"{TOP}/lib/grid.py" in results
    assert f"{TOP}/lib/cascade.py" in results
    assert f"{TOP}/lib/strict_read.py" in results
    assert f"{TOP}/lib/decimal_text.py" in results
    assert f"{TOP}/lib/sampling.py" in results
    assert f"{TOP}/lib/ring.py" in results
    assert {path: found for path, found in results.items() if found} == {}


def test_libの下のフォルダの奥まで読み_libの外は読まない(tmp_path: Path) -> None:
    """読む所が中身を見ずに空の並びを返しても、上の本物の検査は通ってしまう。"""
    lib = tmp_path / TOP / "lib"
    (lib / "sub").mkdir(parents=True)
    (lib / "__init__.py").write_text("", encoding="utf-8")
    (lib / "sub" / "deep.py").write_text("import time\n", encoding="utf-8")
    (tmp_path / TOP / "patterns").mkdir()
    outside = tmp_path / TOP / "patterns" / "outside.py"
    outside.write_text("import time\n", encoding="utf-8")
    assert scan(tmp_path) == {
        f"{TOP}/lib/__init__.py": [],
        f"{TOP}/lib/sub/deep.py": ["time"],
    }


def test_禁じる名前は_実在するモジュールと組み込みの関数() -> None:
    """一覧の名前を書き誤る（``randomx``）と、その名前は何も禁じないまま通り続ける。"""
    assert [
        name for name in BANNED_MODULES if importlib.util.find_spec(name) is None
    ] == []
    assert [
        name for name in BANNED_BUILTINS if not callable(getattr(builtins, name, None))
    ] == []


# 禁じた書き方と、見つけるはずの名前。一覧の書き誤りに気づけるよう、一覧から
# 作らずに手で書く。
FOUND: list[tuple[str, list[str]]] = [
    ("import random", ["random"]),
    ("import secrets", ["secrets"]),
    ("import uuid", ["uuid"]),
    ("import time", ["time"]),
    ("import datetime", ["datetime"]),
    ("import random as r", ["random"]),
    ("import math, time", ["time"]),
    ("import random.extra", ["random.extra"]),
    ("from random import Random", ["random"]),
    ("from datetime import datetime", ["datetime"]),
    # 関数の中と、型検査のときだけ読む import も見る。
    ("def now() -> None:\n    import time\n", ["time"]),
    ("if TYPE_CHECKING:\n    from uuid import UUID\n", ["uuid"]),
    ("key = hash('a')", ["hash"]),
    ("key = id(object())", ["id"]),
    ("ordered = sorted(items, key=id)", ["id"]),
    ("keys = list(map(hash, items))", ["hash"]),
    ("key = builtins.hash('a')", ["builtins.hash"]),
    ("from builtins import id as ident", ["builtins.id"]),
]


@pytest.mark.parametrize(("source", "expected"), [case(*row) for row in FOUND])
def test_禁じた書き方を見つける(source: str, expected: list[str]) -> None:
    """見つけられない書き方があると、その書き方で書いた違反は検査を通る。"""
    assert find_banned(source) == expected


def test_一覧のどの名前にも_見つけることを確認した書き方がある() -> None:
    """一覧に足した名前を、上の表で一度も確認していない、を防ぐ。"""
    covered = {
        name.removeprefix("builtins.").split(".")[0]
        for _, names in FOUND
        for name in names
    }
    assert covered == {*BANNED_MODULES, *BANNED_BUILTINS}


@pytest.mark.parametrize(
    "source",
    [
        case("import math"),
        case("import struct"),
        case("from collections.abc import Sequence"),
        # 名前が random で始まるだけの、別のモジュール。
        case("import randomx"),
        # このパッケージの中の、同じ名前のモジュール。
        case("from .random import Random"),
        case("from . import time"),
        # 同じ名前の属性・引数の名前・文字列。
        case("value = rng.random()"),
        case("value = item.id"),
        case("class Item:\n    id = 1\n"),
        case("value = make(id=1)"),
        case("name = 'random'"),
        case("from builtins import len"),
    ],
)
def test_禁じた書き方でないものは見つけない(source: str) -> None:
    """上の確認が「どの書き方も見つける」だけで通ってしまわないための対照。"""
    assert find_banned(source) == []
