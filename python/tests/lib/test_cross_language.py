"""2つの言語で同じ値を約束する部品の、固定値の表の突き合わせ。

乱数のように、2つの言語で1ビットも違わない値を約束する部品は、両方の言語のテストに
同じ固定値の表を置いている。ただし、片方の言語の実装と表だけを書き換えても、その言語の
テストは通ってしまう。そこでここで TypeScript のテストのファイルを文字列として読み、
その表が Python のテストの表と等しいことを検証する。

TypeScript のテストは、表を次の形で書く。囲みの注釈は配列の最初の行と最後の行に置き、
その間には1行に1件だけを置く。

    const FIRST_VALUES = [
      // 言語をまたぐ固定値：FIRST_VALUES ここから
      [12345, 0.9797282677609473, 0.3067522644996643],
      [1, 0.6270739405881613, 0.002735721180215478],
      // 言語をまたぐ固定値：FIRST_VALUES ここまで
    ];

書き方に合わない行がある・囲みが無い・囲みの外に配列の行がある・中身が空、のどれでも、
読み飛ばさずに止まる。読み飛ばすと、食い違いがあってもこのテストは通る。TypeScript の
ファイルが無いときも、飛ばさずに失敗する。

このテストだけは、検査を言語ごとに完結させる約束（README の Design Choice 2）から外れ、
``python/`` の外のファイルを読む。読む側を Python にしたのは、TypeScript の型検査の
設定に Node.js の型を含めておらず（``types`` が空）、テストからファイルを読む
``node:fs`` の型が無いため。
"""

import re
from collections import Counter
from pathlib import Path

import pytest

from .test_rng import FIRST_VALUES, SHUFFLED
from .test_rng_derive_seed import DERIVED_SEEDS

TS_TESTS = Path(__file__).resolve().parents[3] / "typescript" / "tests"
RNG_TEST = TS_TESTS / "lib" / "rng.test.ts"
DERIVE_SEED_TEST = TS_TESTS / "lib" / "rng-derive-seed.test.ts"

MARK = "// 言語をまたぐ固定値："
# 囲みの始まりの注釈。名前を取り出す。
START = re.compile(rf"^ *{MARK}(\S+) ここから$", re.M)
# 表の1行。数を「, 」で区切って [ ] で囲み、末尾に , を置く。
_NUMBER = r"-?(?:0x[0-9A-Fa-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)"
_ROW = re.compile(rf" *\[({_NUMBER}(?:, {_NUMBER})*)\],")

Row = tuple[int | float, ...]

# 表の名前と、その表を置いた TypeScript のテスト、Python の表を行の並びにしたもの。
# 囲みを足したら、ここにも足す（足し忘れると下の
# test_TypeScriptのテストにある表は_どれもここで比べている が止まる）。
TABLES: dict[str, tuple[Path, list[Row]]] = {
    "FIRST_VALUES": (
        RNG_TEST,
        [(seed, *values) for seed, values in FIRST_VALUES.items()],
    ),
    "SHUFFLED": (RNG_TEST, [(seed, *order) for seed, order in SHUFFLED.items()]),
    "DERIVED_SEEDS": (
        DERIVE_SEED_TEST,
        [(seed, stream, derived) for (seed, stream), derived in DERIVED_SEEDS.items()],
    ),
}


def read_ts_table(path: Path, name: str) -> list[tuple[str, ...]]:
    """TypeScript のテストから、``name`` の囲みの中の表を1行1件で読む。

    囲みを探し、囲みが配列の最初の行と最後の行にあることを確認し、中の行を1行ずつ
    書き方と照らし、合わない行で止まる。

    Returns:
        行ごとの、セルの文字列の組。数に変換するのは呼ぶ側（``number``）。
    """
    assert path.is_file(), f"TypeScript のテストのファイルが無い: {path}"
    text = path.read_text(encoding="utf-8")
    start = rf"^ *{re.escape(MARK + name)} ここから$"
    count = len(re.findall(start, text, re.M))
    assert count > 0, f"{path.name} に {name} の囲みが見つからない"
    # 2つあると、あとの方を書き換えても比べられない。
    assert count == 1, f"{path.name} に {name} の囲みが {count} 個ある"
    end = rf"^ *{re.escape(MARK + name)} ここまで$"
    assert re.search(rf"{start}\n.*?{end}", text, re.S | re.M), (
        f"{path.name} に {name} の囲みの終わりが見つからない"
    )
    # 囲みの外に置いた配列の行は、TypeScript のテストは使うのに、ここでは比べられない。
    # そこで、囲みの直前の行が「= [」で終わり、直後の行が「];」であることを求める。
    match = re.search(rf"^[^\n]*= \[\n{start}\n(.*?){end}\n\];$", text, re.S | re.M)
    assert match, f"{path.name} の {name} の囲みが、配列の最初の行と最後の行に無い"
    rows: list[tuple[str, ...]] = []
    for line in match.group(1).splitlines():
        entry = _ROW.fullmatch(line)
        assert entry, f"{name} の行の書き方が約束と違う: {line!r}"
        rows.append(tuple(entry.group(1).split(", ")))
    assert rows, f"{name} の表が空"
    return rows


def number(cell: str) -> int | float:
    """表のセルの文字列を数に変換する。16進と10進の整数は int、ほかは float。

    16進は e を含みうるので、e の有無では小数かを判断しない。
    """
    if re.fullmatch(r"-?(?:0x[0-9A-Fa-f]+|\d+)", cell):
        return int(cell, 0)
    return float(cell)


def mismatches(ts_rows: list[Row], py_rows: list[Row]) -> tuple[list[Row], list[Row]]:
    """TypeScript の側にだけある行と、Python の側にだけある行を返す。

    並びの順は問わない。同じ行の数は比べる（片方で2回書いた行は、1回ぶんを片方に
    だけある行として返す）。整数と、それと等しい小数は同じとみなす。
    """
    ts, py = Counter(ts_rows), Counter(py_rows)
    return list((ts - py).elements()), list((py - ts).elements())


@pytest.mark.parametrize("name", list(TABLES))
def test_TypeScriptのテストの表と_Pythonのテストの表が等しい(name: str) -> None:
    """片方の言語の実装と表だけを書き換えると、その言語のテストは通るので、ここで止める。

    片方にだけある行も食い違いとして止める。片方向にしか見ないと、もう片方にだけ
    足した行を見逃す。
    """
    path, py_rows = TABLES[name]
    ts_rows: list[Row] = [
        tuple(number(cell) for cell in row) for row in read_ts_table(path, name)
    ]
    assert mismatches(ts_rows, py_rows) == ([], [])


def test_TypeScriptのテストにある表は_どれもここで比べている() -> None:
    """TypeScript に囲みを足しても、``TABLES`` に足し忘れると、その表は比べられない。

    TypeScript のテストの置き場が見つからないときも、名前を1つも読めずに止まる。
    """
    names = [
        name
        for path in sorted(TS_TESTS.rglob("*.ts"))
        for name in START.findall(path.read_text(encoding="utf-8"))
    ]
    assert sorted(names) == sorted(TABLES)


def write(tmp_path: Path, *lines: str) -> Path:
    """``lines`` を1行ずつ書いた TypeScript のテストのファイルを作る。"""
    path = tmp_path / "table.test.ts"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


GOOD = (
    "const T = [",
    f"  {MARK}T ここから",
    "  [12345, 0.5, -1, 0xffffffff, 2.5e-10],",
    "  [1, 2],",
    f"  {MARK}T ここまで",
    "];",
)
GOOD_ROWS = [("12345", "0.5", "-1", "0xffffffff", "2.5e-10"), ("1", "2")]


class Test表の読み方:
    def test_囲みの中の行を_セルの文字列の組にして読む(self, tmp_path: Path) -> None:
        assert read_ts_table(write(tmp_path, *GOOD), "T") == GOOD_ROWS

    def test_名前で表を選び_ほかの表の行は読まない(self, tmp_path: Path) -> None:
        other = ("const U = [", f"  {MARK}U ここから", "  [7],", f"  {MARK}U ここまで")
        path = write(tmp_path, *GOOD, *other, "];")
        assert read_ts_table(path, "U") == [("7",)]
        assert read_ts_table(path, "T") == GOOD_ROWS

    @pytest.mark.parametrize(
        "line",
        [
            "  [12345 0.5],",
            "  [12345, 0.5]",
            "  [12345, '0.5'],",
            "  [12345, NaN],",
            "  [],",
            "  [1, 2], [3, 4],",
            "  //",
            "",
        ],
        ids=repr,
    )
    def test_書き方に合わない行があると_読み飛ばさずに止まる(
        self, tmp_path: Path, line: str
    ) -> None:
        """読み飛ばすと、その行の食い違いを見ないまま、比べるテストが通る。"""
        lines = [*GOOD[:3], line, *GOOD[3:]]
        with pytest.raises(AssertionError, match="書き方が約束と違う"):
            read_ts_table(write(tmp_path, *lines), "T")

    def test_囲みが無いと止まる(self, tmp_path: Path) -> None:
        with pytest.raises(AssertionError, match="U の囲みが見つからない"):
            read_ts_table(write(tmp_path, *GOOD), "U")

    def test_囲みの終わりが無いと止まる(self, tmp_path: Path) -> None:
        lines = [line for line in GOOD if "ここまで" not in line]
        with pytest.raises(AssertionError, match="囲みの終わりが見つからない"):
            read_ts_table(write(tmp_path, *lines), "T")

    def test_同じ名前の囲みが2つあると止まる(self, tmp_path: Path) -> None:
        with pytest.raises(AssertionError, match="囲みが 2 個ある"):
            read_ts_table(write(tmp_path, *GOOD, *GOOD), "T")

    @pytest.mark.parametrize("where", [1, 5])
    def test_囲みの外に配列の行があると止まる(self, tmp_path: Path, where: int) -> None:
        """囲みの外の行は、TypeScript のテストは使うのに、ここでは比べられない。

        1 は「= [」の行と囲みの始まりの間、5 は囲みの終わりと「];」の間。
        """
        lines = [*GOOD[:where], "  [7, 8],", *GOOD[where:]]
        with pytest.raises(AssertionError, match="配列の最初の行と最後の行に無い"):
            read_ts_table(write(tmp_path, *lines), "T")

    def test_囲みの中が空だと止まる(self, tmp_path: Path) -> None:
        lines = ("const T = [", f"  {MARK}T ここから", f"  {MARK}T ここまで", "];")
        with pytest.raises(AssertionError, match="表が空"):
            read_ts_table(write(tmp_path, *lines), "T")

    def test_ファイルが無いと_飛ばさずに止まる(self, tmp_path: Path) -> None:
        """データが無いと検査ごと飛ばす形は、検査が無くなったことに気づきにくい。"""
        with pytest.raises(AssertionError, match="ファイルが無い"):
            read_ts_table(tmp_path / "missing.test.ts", "T")

    def test_セルを数に変換する_16進は_eを含んでも整数(self) -> None:
        cells = ["12345", "-1", "0xffffffff", "0x9e3779b1", "0.5", "2.5e-10"]
        values = [number(cell) for cell in cells]
        assert values == [12345, -1, 0xFFFFFFFF, 0x9E3779B1, 0.5, 2.5e-10]
        assert [type(value) for value in values] == [int] * 4 + [float] * 2


class Test食い違いの見つけ方:
    def test_片方にだけある行を_両方向に見つける(self) -> None:
        """片方向にしか見ないと、もう片方にだけ足した行を見逃す。"""
        ts: list[Row] = [(1, 0.5), (2, 0.25)]
        py: list[Row] = [(1, 0.5), (3, 0.125)]
        assert mismatches(ts, py) == ([(2, 0.25)], [(3, 0.125)])

    def test_同じ行の数の違いも見つける(self) -> None:
        assert mismatches([(1,), (1,)], [(1,)]) == ([(1,)], [])
        assert mismatches([(1,)], [(1,), (1,)]) == ([], [(1,)])

    def test_並びの順は問わず_整数と等しい小数は同じとみなす(self) -> None:
        assert mismatches([(1, 2), (3, 4)], [(3, 4.0), (1, 2)]) == ([], [])
