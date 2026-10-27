"""層の向きの検査。``lib`` は ``patterns`` と ``problems`` を読み込まない。

共通部品が特定の型や問題を知っている状態にしないための約束（AGENTS.md）。
逆の向き（``patterns`` から ``lib``）はよい。

``lib`` の下のすべての ``.py`` を構文木（標準ライブラリの ``ast``）で読み、
``import`` 文と ``from … import`` 文の読み込み先を見る。相対の import
（``from ..patterns import x``）は、そのファイルが属するパッケージをもとに
絶対の名前に変換してから比べる。

見るのは ``import`` 文と ``from … import`` 文だけ。``importlib.import_module`` などに
モジュールの名前を文字列で渡して読み込むものは見ない。

検査を書いただけでは、働いているかは分からない。探す場所を誤ると、何も読まずに通る。
そのため、読んだファイルの一覧に既知のファイルが入っていることと、上の層を読む書き方を
実際に見つけることも、ここで確認する。
"""

import ast
from importlib.util import resolve_name
from pathlib import Path

import pytest

SRC = Path(__file__).resolve().parents[1] / "src"
TOP = "algorithms_and_patterns"
LIB = f"{TOP}.lib"
PATTERNS = f"{TOP}.patterns"
PROBLEMS = f"{TOP}.problems"


def lib_modules(src: Path) -> list[tuple[Path, str]]:
    """``src`` の下の ``lib`` にある ``.py`` と、それぞれが属するパッケージの名前。

    パッケージの名前は、相対の import を絶対の名前に変換するのに使う。``__init__.py`` は
    そのフォルダのパッケージに、ほかのファイルも置いたフォルダのパッケージに属する。
    """
    return [
        (path, ".".join(path.relative_to(src).parent.parts))
        for path in sorted((src / TOP / "lib").rglob("*.py"))
    ]


def _is_upper(name: str) -> bool:
    """``name`` が ``patterns`` か ``problems``、またはその下のモジュールか。"""
    return any(
        name == layer or name.startswith(f"{layer}.") for layer in (PATTERNS, PROBLEMS)
    )


def upward_imports(source: str, package: str) -> list[str]:
    """``source`` の中で、``patterns`` か ``problems`` を読み込む先の名前を返す。

    Args:
        source: 検査する Python のソース。
        package: そのソースが属するパッケージの名前（``algorithms_and_patterns.lib``
            など）。相対の import を、このパッケージをもとに絶対の名前に変換する。

    Raises:
        ImportError: 相対の import が、最上位のパッケージより上を指すとき。
    """
    found: list[str] = []
    # 関数の中や ``if TYPE_CHECKING:`` の中の import も読むよう、木のすべてをたどる。
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, ast.Import):
            found += [alias.name for alias in node.names if _is_upper(alias.name)]
        elif isinstance(node, ast.ImportFrom):
            target = resolve_name("." * node.level + (node.module or ""), package)
            if _is_upper(target):
                found.append(target)
                continue
            # ``from .. import patterns`` のように、読む名前がモジュールのこともある。
            names = [f"{target}.{alias.name}" for alias in node.names]
            found += [name for name in names if _is_upper(name)]
    return found


def test_libの下のどのファイルも_patternsとproblemsを読み込まない() -> None:
    """共通部品が特定の型や問題を知っていると、それを変えるたびに共通部品も変わる。"""
    offenders = {
        str(path.relative_to(SRC)): found
        for path, package in lib_modules(SRC)
        if (found := upward_imports(path.read_text(encoding="utf-8"), package))
    }
    assert offenders == {}


def test_読むファイルの一覧に_libの既知のファイルが入っている() -> None:
    """上の検査の前提。探す場所を誤ると、一覧が空のまま何も読まずに通る。"""
    modules = lib_modules(SRC)
    assert (SRC / TOP / "lib" / "__init__.py", LIB) in modules
    assert (SRC / TOP / "lib" / "rng.py", LIB) in modules


def test_下のフォルダのファイルも読み_属するパッケージの名前を付ける(
    tmp_path: Path,
) -> None:
    """``lib`` の下にフォルダを作ったときに、そこが検査から漏れないこと。

    属するパッケージの名前を誤ると、相対の import を別の名前に変換して見逃す。
    ``lib`` の外のファイルは読まないことも見る。``patterns`` の中どうしの import を
    読むと、よい向きの import で検査が失敗する。
    """
    lib = tmp_path / TOP / "lib"
    (lib / "sub").mkdir(parents=True)
    files = [lib / "__init__.py", lib / "sub" / "__init__.py", lib / "sub" / "deep.py"]
    for path in files:
        path.write_text("", encoding="utf-8")
    (tmp_path / TOP / "patterns").mkdir()
    (tmp_path / TOP / "patterns" / "outside.py").write_text("", encoding="utf-8")
    assert lib_modules(tmp_path) == [
        (files[0], LIB),
        (files[1], f"{LIB}.sub"),
        (files[2], f"{LIB}.sub"),
    ]


def case(source: str, *rest: object) -> object:
    """表の1行。テストの名前には、ソースを1行に詰めたものを使う。

    日本語の名前を付けると、pytest は ``\\u`` の形に置き換えて表示し、読めなくなる。
    """
    return pytest.param(source, *rest, id=" ".join(source.split()))


@pytest.mark.parametrize(
    ("source", "package", "expected"),
    [
        case(f"import {PATTERNS}.command", LIB, [f"{PATTERNS}.command"]),
        case(f"from {PATTERNS} import command", LIB, [PATTERNS]),
        case(f"from {TOP} import patterns", LIB, [PATTERNS]),
        case("from ..patterns import command", LIB, [PATTERNS]),
        case("from .. import patterns", LIB, [PATTERNS]),
        case("from ..problems.example import solve", LIB, [f"{PROBLEMS}.example"]),
        case("from .. import lib, patterns, problems", LIB, [PATTERNS, PROBLEMS]),
        # lib の下のフォルダからは、点が1つ多くなる。
        case("from ...patterns import command", f"{LIB}.sub", [PATTERNS]),
        # 関数の中と、型検査のときだけ読む import も見る。
        case(
            "def load() -> None:\n    from ..patterns import command\n",
            LIB,
            [PATTERNS],
        ),
        case(
            "if TYPE_CHECKING:\n    from ..patterns.command import CommandLog\n",
            LIB,
            [f"{PATTERNS}.command"],
        ),
    ],
)
def test_上の層を読む書き方を見つける(
    source: str, package: str, expected: list[str]
) -> None:
    """見つけられない書き方があると、その書き方で書いた違反は検査を通る。"""
    assert upward_imports(source, package) == expected


@pytest.mark.parametrize(
    ("source", "package"),
    [
        case("from . import rng", LIB),
        case("from .rng import Random", LIB),
        case(f"import {LIB}.rng", LIB),
        case(f"from {TOP} import lib", LIB),
        case("import bisect", LIB),
        case("from collections.abc import Sequence", LIB),
        # このパッケージの外の、同じ名前のパッケージ。
        case("import patterns", LIB),
        # 名前が patterns で始まるだけの、別のモジュール。
        case(f"import {PATTERNS}_extra", LIB),
        # patterns から lib を読むのはよい向き。
        case("from ..lib import rng", PATTERNS),
    ],
)
def test_上の層でない読み込みは見つけない(source: str, package: str) -> None:
    """上の確認が「どの import も見つける」だけで通ってしまわないための対照。"""
    assert upward_imports(source, package) == []


def test_最上位のパッケージより上を指す相対の_import_は止める() -> None:
    """黙って読み飛ばすと、その行が何を読むのかを見ないまま通る。"""
    with pytest.raises(ImportError):
        upward_imports("from ... import patterns", LIB)
