"""格子と幅優先の最短経路のうち、幅優先の最短経路（find_path）が止める値の検査。

探し方は ``test_grid_path.py`` が、格子の入れ物（Grid）は ``test_grid.py`` が見る。
受け取る値の約束は、探し方とは別の理由で変わるので、ファイルを分けた。
"""

import pytest

from algorithms_and_patterns.lib.grid import Cell, find_path

CORNER = Cell(0, 0)


def search(
    start: Cell, *, size: tuple[int, int] = (5, 3), max_distance: int = 8
) -> list[Cell] | None:
    """どのマスも通れて、どのマスも目的地として、``find_path`` を呼ぶ。"""
    cols, rows = size
    return find_path(
        cols,
        rows,
        start,
        passable=lambda _cell: True,
        goal=lambda _cell, _distance: True,
        max_distance=max_distance,
    )


class Test出発点:
    @pytest.mark.parametrize(
        "start", [Cell(-1, 0), Cell(5, 0), Cell(0, -1), Cell(0, 3)], ids=repr
    )
    def test_格子の外の出発点は止まる(self, start: Cell) -> None:
        """外の出発点を添字にすると、別のマスか、list の外を指す。"""
        with pytest.raises(ValueError, match="出発点が格子の外"):
            search(start)

    @pytest.mark.parametrize("size", [(0, 3), (3, 0), (-2, -2)])
    def test_列か行の数が0以下なら_どの出発点も外として止まる(
        self, size: tuple[int, int]
    ) -> None:
        with pytest.raises(ValueError, match="出発点が格子の外"):
            search(CORNER, size=size)


class Test歩数:
    def test_負のmax_distanceは止まる(self) -> None:
        """0 に丸めると、呼ぶ側の誤り（引き算の取り違えなど）に気づけない。"""
        with pytest.raises(ValueError, match="0 以上"):
            search(CORNER, max_distance=-1)
