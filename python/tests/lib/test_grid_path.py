"""格子と幅優先の最短経路のうち、幅優先の最短経路（find_path）の探し方の検査。

止める値（格子の外の出発点・負の歩数）は ``test_grid_path_invalid.py`` が、格子の
入れ物（Grid）は ``test_grid.py`` が見る。

どのテストも、格子を小さくし、探す歩数（``max_distance``）を 8 以下にしている。訪れた
印を付けない誤った実装でも、探す数が歩数で抑えられ、テストが終わる。
"""

from collections.abc import Callable, Sequence

import pytest

from algorithms_and_patterns.lib.grid import FOUR_NEIGHBOURS, Cell, Grid, find_path

Passable = Callable[[Cell], bool]
Goal = Callable[[Cell, int], bool]

# 5列3行の格子。"#" は通れないマス。外も通れないマスとして読む。
#
#   . . . . .
#   . # . # .
#   . . . . .
LINES = (".....", ".#.#.", ".....")
COLS, ROWS = 5, 3
CORNER = Cell(0, 0)
# 左上の角から各マスまでの歩数。None は通れないマス。
DISTANCES = ((0, 1, 2, 3, 4), (1, None, 3, None, 5), (2, 3, 4, 5, 6))


def maze() -> Grid[str]:
    """上の5列3行の格子。"""
    return Grid(COLS, ROWS, list("".join(LINES)), "#")


def open_cells(grid: Grid[str]) -> Passable:
    """``grid`` の "." のマスを通れるとする関数。"""
    return lambda cell: grid.at(cell) == "."


def at(target: Cell) -> Goal:
    """そのマスに着いたら目的地、という条件。"""
    return lambda cell, _distance: cell == target


def anywhere(_cell: Cell, _distance: int = 0) -> bool:
    """どのマスも通れる、どのマスも目的地、のどちらにも使う。"""
    return True


def search(
    start: Cell,
    goal: Goal = anywhere,
    *,
    passable: Passable | None = None,
    max_distance: int = 8,
    order: Sequence[tuple[int, int]] = FOUR_NEIGHBOURS,
    size: tuple[int, int] = (COLS, ROWS),
) -> list[Cell] | None:
    """``find_path`` を呼ぶ。既定は5列3行の格子で、"." のマスを通れるとする。"""
    cols, rows = size
    if passable is None:
        passable = open_cells(maze())
    return find_path(
        cols,
        rows,
        start,
        passable=passable,
        goal=goal,
        max_distance=max_distance,
        order=order,
    )


def pairs(path: list[Cell] | None) -> list[tuple[int, int]] | None:
    """マスの位置を、並びに書きやすい (列, 行) の組にする。"""
    return None if path is None else [(cell.col, cell.row) for cell in path]


class Test最短の経路:
    def test_出発点の次のマスから目的地までを返す(self) -> None:
        assert pairs(search(Cell(0, 1), at(Cell(0, 2)))) == [(0, 2)]

    def test_通れないマスを避けて回り道する(self) -> None:
        """(1, 0) から (1, 2) は縦に2マスだが、間の (1, 1) が通れないので4歩。"""
        path = search(Cell(1, 0), at(Cell(1, 2)))
        assert pairs(path) == [(2, 0), (2, 1), (2, 2), (1, 2)]

    def test_届かなければNone(self) -> None:
        assert search(CORNER, at(Cell(1, 1))) is None

    def test_格子の入れ物を使わずに_関数だけで探せる(self) -> None:
        """通れるかを答える関数があれば、Grid を作らなくてよい。

        3列目の上の2マスを塞ぐと、上の行から右の端へ行くには3行目まで下りて回る。
        (3, 2) からは右を上より先に試すので、右の端の列を上る。
        """
        path = search(
            CORNER, at(Cell(4, 0)), passable=lambda c: c.col != 2 or c.row == 2
        )
        expected = [(1, 0), (1, 1), (1, 2), (2, 2), (3, 2), (4, 2), (4, 1), (4, 0)]
        assert pairs(path) == expected

    def test_まだ置いていない障害も_passableに足して表せる(self) -> None:
        """格子を書き換えずに「ここが塞がったら」を試せる。

        (2, 0) から (2, 2) へは、間の (2, 1) が塞がると6歩。右を左より先に試すので、
        右から回る。
        """
        grid = maze()
        planned = {Cell(2, 1)}
        path = search(
            Cell(2, 0),
            at(Cell(2, 2)),
            passable=lambda cell: grid.at(cell) == "." and cell not in planned,
        )
        assert pairs(path) == [(3, 0), (4, 0), (4, 1), (4, 2), (3, 2), (2, 2)]
        # 格子そのものは書き換わっていない。
        assert grid.at(Cell(2, 1)) == "."


class Test同じ長さの経路の選び方:
    def test_隣を右左下上の順に試し_先に届いた経路を返す(self) -> None:
        """左上の角から右下の角へは6歩で、同じ長さの経路がいくつもある。

        右を下より先に試すので、上の行を右の端まで進んでから下りる経路になる。
        """
        path = search(CORNER, at(Cell(4, 2)))
        assert pairs(path) == [(1, 0), (2, 0), (3, 0), (4, 0), (4, 1), (4, 2)]

    def test_試す順を変えると_同じ長さの別の経路を返す(self) -> None:
        """上の確認が、順を見ずにたまたま同じ経路になっただけでないことの対照。

        上・下・左・右の順にすると、下を右より先に試すので、左の列を下りてから右へ進む。
        """
        order = ((0, -1), (0, 1), (-1, 0), (1, 0))
        path = search(CORNER, at(Cell(4, 2)), order=order)
        assert pairs(path) == [(0, 1), (0, 2), (1, 2), (2, 2), (3, 2), (4, 2)]

    def test_既定の順は右左下上(self) -> None:
        assert FOUR_NEIGHBOURS == ((1, 0), (-1, 0), (0, 1), (0, -1))

    def test_試す順に無い向きへは進まない(self) -> None:
        """右と下だけにすると、右下の角から左上の角へは戻れない。

        空の順なら、どこへも進まない。空の順を既定の順に置き換えると、隣へ進む。
        """
        path = search(Cell(4, 2), at(CORNER), passable=anywhere, order=((1, 0), (0, 1)))
        assert path is None
        assert search(CORNER, passable=anywhere, order=()) is None


class Test出発点:
    def test_出発点は目的地として見ない(self) -> None:
        """どのマスも目的地なら、出発点でなく隣のマスまでの1歩を返す。"""
        start = Cell(2, 1)
        assert pairs(search(start, anywhere)) == [(2, 2)]
        assert search(start, at(start)) is None

    def test_出発点が通れないマスでも探せる(self) -> None:
        """いま立っているマスが通れないマスになっていても、そこから出る道を探せる。"""
        grid = maze()
        grid.put(CORNER, "#")
        path = search(CORNER, at(Cell(2, 0)), passable=open_cells(grid))
        assert pairs(path) == [(1, 0), (2, 0)]

    def test_出発点は_passableにもgoalにも渡さない(self) -> None:
        asked: list[Cell] = []
        judged: list[Cell] = []

        def passable(cell: Cell) -> bool:
            asked.append(cell)
            return True

        def goal(cell: Cell, _distance: int) -> bool:
            judged.append(cell)
            return False

        search(Cell(1, 1), goal, passable=passable, max_distance=4, size=(3, 3))
        assert len(judged) == 8
        assert Cell(1, 1) not in asked
        assert Cell(1, 1) not in judged


class Test歩数:
    def test_goalは_届いたマスに出発点に近い順に1回ずつ_歩数つきで呼ぶ(self) -> None:
        """歩数を渡し誤ると、「3マス以上離れた所」のような条件が誤って当たる。

        同じマスに2回呼ぶのは、訪れた印を付け忘れて、同じマスをまた並べたとき。
        """
        calls: list[tuple[int, int, int]] = []

        def goal(cell: Cell, distance: int) -> bool:
            calls.append((cell.col, cell.row, distance))
            return False

        assert search(CORNER, goal) is None
        expected = [
            (col, row, distance)
            for row, line in enumerate(DISTANCES)
            for col, distance in enumerate(line)
            if distance is not None and distance > 0
        ]
        assert sorted(calls, key=lambda c: (c[1], c[0])) == expected
        distances = [distance for _, _, distance in calls]
        assert distances == sorted(distances)

    def test_歩数を条件にした目的地(self) -> None:
        """3行目のマスのうち、3歩以上離れた最初のマス。(0, 2) は2歩なので当たらない。"""
        path = search(CORNER, lambda cell, distance: cell.row == 2 and distance >= 3)
        assert pairs(path) == [(0, 1), (0, 2), (1, 2)]

    @pytest.mark.parametrize(
        ("start", "target", "distance"),
        [
            # まっすぐ進める経路と、通れないマスを回る経路（縦に2マスで4歩）。
            (CORNER, Cell(4, 2), 6),
            (Cell(1, 0), Cell(1, 2), 4),
        ],
    )
    def test_ちょうどmax_distanceの歩数の目的地には届き_1つ短いとNone(
        self, start: Cell, target: Cell, distance: int
    ) -> None:
        """打ち切りの比べを「より大きい」と「以上」で取り違えると、どちらかで食い違う。"""
        found = search(start, at(target), max_distance=distance)
        assert found is not None
        assert len(found) == distance
        assert found[-1] == target
        assert search(start, at(target), max_distance=distance - 1) is None

    def test_max_distanceより遠いマスにはgoalもpassableも呼ばない(self) -> None:
        """打ち切りを取り出したときに見ると、1歩遠いマスにまで passable を呼ぶ。

        返す経路と goal の呼ばれ方は変わらないので、passable の側でも見る。
        """
        asked: list[Cell] = []
        judged: list[int] = []
        is_open = open_cells(maze())

        def passable(cell: Cell) -> bool:
            asked.append(cell)
            return is_open(cell)

        def goal(_cell: Cell, distance: int) -> bool:
            judged.append(distance)
            return False

        search(CORNER, goal, passable=passable, max_distance=3)
        within = [
            d for line in DISTANCES for d in line if d is not None and 1 <= d <= 3
        ]
        assert sorted(judged) == sorted(within)
        # 通れないマス（歩数が None）には、3歩以内のマスの隣として尋ねてよい。
        assert [c for c in asked if (DISTANCES[c.row][c.col] or 0) > 3] == []

    def test_max_distanceが0なら_隣が目的地でもNone(self) -> None:
        assert search(CORNER, anywhere, max_distance=0) is None

    def test_1マスの格子では_進む先が無くNone(self) -> None:
        assert search(CORNER, passable=anywhere, size=(1, 1)) is None


class Test格子の端:
    """添字は 行 × 列の数 + 列 なので、端の外を添字にすると、別のマスを指す。"""

    @pytest.mark.parametrize(
        ("start", "offset"),
        [
            # 右の端の外 (3, 0) は、添字では次の行の先頭 (0, 1)。
            (Cell(2, 0), (1, 0)),
            # 左の端の外 (-1, 1) は、添字では前の行の末尾 (2, 0)。
            (Cell(0, 1), (-1, 0)),
            # 上の外 (0, -1) は、添字では list の後ろから数えたマス。
            (Cell(0, 0), (0, -1)),
            # 下の外 (0, 2) は、添字では list の長さを超える。
            (Cell(0, 1), (0, 1)),
        ],
        ids=repr,
    )
    def test_端から外へは進まず_別のマスへ回り込まない(
        self, start: Cell, offset: tuple[int, int]
    ) -> None:
        path = search(start, passable=anywhere, order=(offset,), size=(3, 2))
        assert path is None

    def test_passableには_格子の中のマスだけを渡す(self) -> None:
        asked: list[Cell] = []

        def passable(cell: Cell) -> bool:
            asked.append(cell)
            return True

        search(CORNER, lambda _cell, _distance: False, passable=passable, size=(3, 2))
        assert asked
        assert [c for c in asked if not (0 <= c.col < 3 and 0 <= c.row < 2)] == []
