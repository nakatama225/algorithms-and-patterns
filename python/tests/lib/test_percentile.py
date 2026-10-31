"""パーセンタイル（``percentile.py``）のテスト。

多くのテストは 1 から n までの値の列を使う。返った値が、そのまま小さいほうから数えた
位置（1 から数える）になる。
"""

import math

import pytest

from algorithms_and_patterns.lib.percentile import percentile

# 小数の割合を掛けて切り上げる形（ceil(percent / 100 * n)）が、列の長さ 1〜2000 の
# どこかで整数の形と食い違う百分率。
FLOAT_MISMATCHED = [7, 14, 17, 27, 28, 34, 54, 55, 56, 67, 68, 81]


def one_to(n: int) -> list[float]:
    """1 から n までの値の列。"""
    return [float(value) for value in range(1, n + 1)]


def exact_rank(percent: int, n: int) -> int:
    """整数だけで求めた ceil(percent × n / 100)。"""
    return (percent * n + 99) // 100


class Test位置:
    @pytest.mark.parametrize(
        ("n", "percent", "expected"),
        [
            (100, 99, 99),
            (600, 99, 594),
            (100, 100, 100),
            (100, 50, 50),
            (100, 1, 1),
            (3, 50, 2),
            (1, 1, 1),
            (1, 100, 1),
        ],
    )
    def test_列の中の値をそのまま返し_補間しない(
        self, n: int, percent: int, expected: float
    ) -> None:
        """100 件の 99 は大きいほうから2番目、600 件なら7番目。

        位置の数え方がずれると、1つ上や1つ下の値を返し、合否の判定が甘くなる。
        """
        assert percentile(one_to(n), percent) == expected

    def test_150件の99は_切り上げた149番目(self) -> None:
        """148.5 番目。偶数への丸めの ``round`` だと 148 番目を返す。

        本来より小さい値を返すので、合否の判定が甘くなる。
        """
        assert percentile(one_to(150), 99) == 149
        assert round(0.99 * 150) == 148

    def test_160件の99は_切り上げた159番目(self) -> None:
        """158.4 番目。最も近い整数に丸めると 158 番目を返す。

        TypeScript 版の ``Math.round`` は 148.5 を 149 にするので、150 件の例では
        丸めとの違いが見えない。両方の言語に同じ例を置く。
        """
        assert percentile(one_to(160), 99) == 159
        assert round(99 * 160 / 100) == 158

    def test_100件の7は7番目で_小数の割合を掛ける形とは違う(self) -> None:
        """小数の割合を掛けると 7.000000000000001 になり、切り上げて8番目を返す。"""
        assert percentile(one_to(100), 7) == 7
        assert 7 / 100 * 100 == 7.000000000000001
        assert math.ceil(7 / 100 * 100) == 8

    @pytest.mark.parametrize("percent", FLOAT_MISMATCHED)
    def test_小数の割合を掛けると食い違う長さでも_整数で求めた位置を返す(
        self, percent: int
    ) -> None:
        mismatched = [
            n
            for n in range(1, 2001)
            if math.ceil(percent / 100 * n) != exact_rank(percent, n)
        ]
        assert mismatched, "この百分率は、小数の形と食い違う長さを持つ"
        for n in mismatched[:3]:
            assert percentile(one_to(n), percent) == exact_rank(percent, n)

    def test_小数の割合を掛けて食い違うのは_1から100のうち12個(self) -> None:
        """百分率を整数で受ける理由。よく使う 50・95・99 は、この 12 個に含まれない。"""
        found = [
            percent
            for percent in range(1, 101)
            if any(
                math.ceil(percent / 100 * n) != exact_rank(percent, n)
                for n in range(1, 2001)
            )
        ]
        assert found == FLOAT_MISMATCHED

    def test_99件までは_99パーセンタイルが最大と同じ(self) -> None:
        """99 件の 99 は ceil(98.01) = 99 番目。100 件で初めて最大より1つ下を返す。

        p99 を合否に使う側は、100 件より少ない列では合否を出さない。
        """
        assert percentile(one_to(99), 99) == 99
        assert percentile(one_to(100), 99) == 99
        assert percentile(one_to(100), 100) == 100


class Test並べ方:
    def test_測った順のまま渡しても_小さい順に並べてから位置を取る(self) -> None:
        """並べずに位置を取ると、測った順の3番目（17.0）を返す。"""
        values = [30.0, 1.0, 17.0, 2.0, 16.0]
        assert percentile(values, 50) == 16.0
        assert percentile(values, 1) == 1.0
        assert percentile(values, 100) == 30.0

    def test_渡した列は書き換えない(self) -> None:
        """呼んだあとに同じ列で別の計算をすると、並べ替わっていれば結果が変わる。"""
        values = [3.0, 1.0, 2.0]
        assert percentile(values, 50) == 2.0
        assert values == [3.0, 1.0, 2.0]

    def test_タプルも整数の列も受ける(self) -> None:
        assert percentile((3, 1, 2), 100) == 3

    def test_同じ値が続く列でも位置で選ぶ(self) -> None:
        assert percentile([5.0, 5.0, 5.0, 5.0], 1) == 5.0
        assert percentile([2.0, 1.0, 2.0, 3.0, 2.0], 50) == 2.0
        assert percentile([2.0, 1.0, 2.0, 3.0, 2.0], 20) == 1.0

    def test_無限大は並べて端に置く(self) -> None:
        values = [math.inf, 1.0, -math.inf]
        assert percentile(values, 100) == math.inf
        assert percentile(values, 1) == -math.inf


class Test止める値:
    @pytest.mark.parametrize("percent", [0, 101, -1, 1000])
    def test_百分率が1から100の外なら止まる(self, percent: int) -> None:
        """端に丸めると、呼び出しの誤りに気づけない。

        0 は位置が 0 番目になり、検査が無いと添字 -1 で最大を返す。
        """
        with pytest.raises(ValueError, match="1 以上 100 以下"):
            percentile(one_to(10), percent)

    @pytest.mark.parametrize("percent", [50.0, 50.5, True])
    def test_百分率がintでないと止まる(self, percent: object) -> None:
        """50.0 も止める。小数を受けると、小数の割合を掛けた形と同じ誤りが起きうる。

        True は int の子なので、型検査は止めない（1 として通る）。
        """
        with pytest.raises(TypeError, match="百分率は int で渡す"):
            percentile(one_to(10), percent)  # type: ignore[arg-type]

    def test_空の列は止まる(self) -> None:
        with pytest.raises(ValueError, match="空の列"):
            percentile([], 50)

    @pytest.mark.parametrize(
        "values", [[1.0, math.nan], [math.nan], [3.0, math.nan, 1.0, 2.0]]
    )
    def test_NaNを含む列は止まる(self, values: list[float]) -> None:
        """NaN はどの値と比べても偽なので、並べた順が崩れる。"""
        with pytest.raises(ValueError, match="NaN"):
            percentile(values, 50)

    def test_NaNがあると_並べても小さい順にならない(self) -> None:
        """検査を外すと、崩れた順のまま位置を取り、気づかないまま誤った値を返す。"""
        ordered = sorted([3.0, math.nan, 1.0, 2.0])
        assert ordered[0] == 3.0
