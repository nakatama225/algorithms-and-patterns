"""格子と幅優先の最短経路のうち、格子の入れ物（Grid）の検査。

幅優先の最短経路（find_path）は ``test_grid_path.py`` と ``test_grid_path_invalid.py``
が見る。探索は格子の入れ物を受けずに動き、変わる理由が違うので、ファイルを分けた。
"""

import pytest

from algorithms_and_patterns.lib.grid import Cell, Grid

# 外を読んだときの値。どのマスの値とも違う数にして、外を読んだのか、別のマスを
# 読んだのかを見分けられるようにする。
OUTSIDE = -1


def grid() -> Grid[int]:
    """3列2行で、左上から行ごとに 0 から 5 を並べた格子。

    0 1 2
    3 4 5
    """
    return Grid(3, 2, [0, 1, 2, 3, 4, 5], OUTSIDE)


class Test読み書き:
    def test_作った値を_マスの位置で読める(self) -> None:
        subject = grid()
        assert subject.at(Cell(0, 0)) == 0
        assert subject.at(Cell(2, 0)) == 2
        assert subject.at(Cell(0, 1)) == 3
        assert subject.at(Cell(2, 1)) == 5
        assert (subject.cols, subject.rows) == (3, 2)

    def test_書いたマスだけが変わる(self) -> None:
        subject = grid()
        subject.put(Cell(1, 1), 40)
        assert [value for _, value in subject.cells()] == [0, 1, 2, 3, 40, 5]

    def test_cellsは_左上から行ごとに_すべてのマスと値を返す(self) -> None:
        """列と行を取り違えると、2行目の先頭が (0, 1) でなく (1, 0) になる。"""
        assert list(grid().cells()) == [
            (Cell(0, 0), 0),
            (Cell(1, 0), 1),
            (Cell(2, 0), 2),
            (Cell(0, 1), 3),
            (Cell(1, 1), 4),
            (Cell(2, 1), 5),
        ]

    def test_作ったあとに元の列を書き換えても_格子は変わらない(self) -> None:
        """写さずに持つと、呼ぶ側が元の list を使い回したときに、格子が黙って変わる。"""
        values = [0, 1, 2, 3, 4, 5]
        subject = Grid(3, 2, values, OUTSIDE)
        values[0] = 99
        assert subject.at(Cell(0, 0)) == 0

    def test_1マスの格子(self) -> None:
        subject = Grid(1, 1, ["a"], "外")
        assert subject.at(Cell(0, 0)) == "a"
        assert subject.at(Cell(1, 0)) == "外"
        assert list(subject.cells()) == [(Cell(0, 0), "a")]


class Test外:
    @pytest.mark.parametrize(
        "cell",
        [Cell(-1, 0), Cell(3, 0), Cell(0, -1), Cell(0, 2), Cell(3, 1), Cell(-1, -1)],
        ids=repr,
    )
    def test_外を読むと_作るときに決めた値を返す(self, cell: Cell) -> None:
        """範囲を見ずに添字を計算すると、別のマスの値を返す。

        (3, 0) は次の行の先頭 (0, 1) に、(0, -1) は list の後ろから数えた添字になる。
        """
        subject = grid()
        assert not subject.contains(cell)
        assert subject.at(cell) == OUTSIDE

    @pytest.mark.parametrize("cell", [Cell(0, 0), Cell(2, 0), Cell(0, 1), Cell(2, 1)])
    def test_四隅のマスは中にある(self, cell: Cell) -> None:
        """上の確認が「どのマスも外とみなす」だけで通ってしまわないための対照。"""
        assert grid().contains(cell)

    @pytest.mark.parametrize("cell", [Cell(-1, 0), Cell(3, 0), Cell(0, -1), Cell(0, 2)])
    def test_外へ書くと止まり_どのマスも変わらない(self, cell: Cell) -> None:
        """外へ書こうとするのは呼ぶ側の誤り。黙って何もしないと、誤りに気づけない。

        添字で書くと、(3, 0) は (0, 1) を、(0, -1) は後ろから数えたマスを書き換える。
        """
        subject = grid()
        with pytest.raises(ValueError, match="格子の外は書き換えられない"):
            subject.put(cell, 99)
        assert [value for _, value in subject.cells()] == [0, 1, 2, 3, 4, 5]


class Test作り方:
    @pytest.mark.parametrize("count", [0, 5, 7])
    def test_値の数が列と行の積でなければ止まる(self, count: int) -> None:
        with pytest.raises(ValueError, match="値の数が合わない"):
            Grid(3, 2, list(range(count)), OUTSIDE)

    @pytest.mark.parametrize(
        ("cols", "rows", "count"), [(0, 3, 0), (3, 0, 0), (-2, -2, 4), (-1, -3, 3)]
    )
    def test_列か行の数が1未満なら_値の数が合っても止まる(
        self, cols: int, rows: int, count: int
    ) -> None:
        """負の数どうしの積は正なので、値の数を比べるだけでは通ってしまう。"""
        assert count == cols * rows
        with pytest.raises(ValueError, match="1 以上"):
            Grid(cols, rows, list(range(count)), OUTSIDE)
