"""格子と幅優先の最短経路 — 1本の list で持つ格子と、最初の目的地までの最短経路。

- ``Grid``：格子の入れ物。左上から行ごとに並べた1本の list で持つ。外を読むと、作る
  ときに決めた値（``outside``）を返し、外へ書くと止まる
- ``find_path``：重みの無い格子で、条件を満たす最初のマスまでの最短経路を、幅優先で
  求める。``Grid`` を受けず、列と行の数と、通れるかを答える関数だけで動く。格子の
  入れ物を使わない呼ぶ側でも使える

計算は、整数の足し算・掛け算と、余りと切り捨ての割り算だけで書く。固定値の表は持たず、
約束は「同じ入力から、起動のたびに同じ結果を出す」だけ（README の「決定性を崩す書き方の
検査」）。TypeScript 版（``typescript/src/lib/grid.ts``）も同じ形。
"""

from collections import deque
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from typing import Final, Generic, TypeVar

T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class Cell:
    """格子のマスの位置。左上が (0, 0)。

    列（``col``）は右へ、行（``row``）は下へ増える。
    """

    col: int
    row: int


# 上下左右の隣への差分（列, 行）を、右・左・下・上の順に並べたもの。``find_path`` の
# 既定の順。同じ長さの経路がいくつもあるとき、どれを返すかは隣を試す順で決まる。
FOUR_NEIGHBOURS: Final = ((1, 0), (-1, 0), (0, 1), (0, -1))


def _inside(cols: int, rows: int, cell: Cell) -> bool:
    """``cell`` が ``cols × rows`` の格子の中にあるか。"""
    return 0 <= cell.col < cols and 0 <= cell.row < rows


class Grid(Generic[T]):
    """格子の入れ物。左上から行ごとに並べた1本の list で持つ。

    添字の計算（行 × 列の数 + 列）をこのクラスの中だけに閉じ込め、外からはマスの位置
    （``Cell``）でしか触れない。

    外を読むと、作るときに決めた値（``outside``）を返す。通れないものを表す値を外の値に
    すれば、使う側は読むたびに範囲を確認しなくてよい。外へ書くのは止める。
    """

    __slots__ = ("_cells", "_cols", "_outside", "_rows")

    def __init__(self, cols: int, rows: int, cells: Sequence[T], outside: T) -> None:
        """左上から行ごとに並べた値から格子を作る。``cells`` は写して持つ。

        Args:
            cols: 列の数。1 以上。
            rows: 行の数。1 以上。
            cells: 左上から行ごとに並べた、``cols × rows`` 個の値。
            outside: 外を読んだときに返す値。

        Raises:
            ValueError: 列か行の数が 1 未満のとき、または ``cells`` の数が
                ``cols × rows`` でないとき。負の数どうしの積は正になるので、数が合っても
                列と行の数を見る。
        """
        if cols < 1 or rows < 1:
            raise ValueError(f"列と行の数は 1 以上にする: {cols}×{rows}")
        if len(cells) != cols * rows:
            raise ValueError(f"値の数が合わない: {len(cells)} != {cols}×{rows}")
        self._cols = cols
        self._rows = rows
        self._cells = list(cells)
        self._outside = outside

    @property
    def cols(self) -> int:
        """列の数。"""
        return self._cols

    @property
    def rows(self) -> int:
        """行の数。"""
        return self._rows

    def contains(self, cell: Cell) -> bool:
        """マスが格子の中にあるか。"""
        return _inside(self._cols, self._rows, cell)

    def at(self, cell: Cell) -> T:
        """そのマスの値。外なら ``outside``。

        範囲を見ずに添字を計算すると、右の端の外は次の行の先頭に、上の外は list の
        後ろから数えた添字になり、別のマスの値を返す。
        """
        if not self.contains(cell):
            return self._outside
        return self._cells[cell.row * self._cols + cell.col]

    def put(self, cell: Cell, value: T) -> None:
        """そのマスの値を書き換える。

        名前を ``set`` にしないのは、クラスの中でこのメソッドより後に書いた型注釈の
        ``set[...]`` が、このメソッドを指してしまうため。型検査が止め、3.13 までは、
        クラスを作る所で TypeError になる。

        Raises:
            ValueError: 外を指したとき。外は読むと ``outside`` を返すだけの場所で、
                書き換えようとするのは呼ぶ側の誤り。黙って何もしないと、誤りに気づけない。
        """
        if not self.contains(cell):
            raise ValueError(f"格子の外は書き換えられない: {cell}")
        self._cells[cell.row * self._cols + cell.col] = value

    def cells(self) -> Iterator[tuple[Cell, T]]:
        """すべてのマスと、その値を、左上から行ごとに返す。"""
        for index, value in enumerate(self._cells):
            yield Cell(index % self._cols, index // self._cols), value


def find_path(
    cols: int,
    rows: int,
    start: Cell,
    *,
    passable: Callable[[Cell], bool],
    goal: Callable[[Cell, int], bool],
    max_distance: int,
    order: Sequence[tuple[int, int]] = FOUR_NEIGHBOURS,
) -> list[Cell] | None:
    """``start`` から、``goal`` を満たす最初のマスまでの最短経路を、幅優先で求める。

    どのマスへ進む手間も同じ（重みの無い格子）なので、幅優先で最初に見つかった経路が
    最短になる。重みを扱う探し方（ダイクストラ法や A*）は要らない。

    - 出発点は目的地として見ない。出発点が目的地かは、呼ぶ側が先に見る
    - 出発点が通れるかは尋ねない。ほかのマスは、通れる（``passable`` が真の）マスに
      だけ進む。目的地も、通れるマスの中から探す
    - ``goal`` は、届いたマスに、出発点に近い順に1回ずつ呼ぶ。2つ目の引数の歩数で、
      「3マス以上離れた所」のような条件も書ける
    - 同じ長さの経路がいくつもあるときは、隣を試す順（``order``）で先に届いたものを返す

    Args:
        cols: 列の数。
        rows: 行の数。
        start: 出発点。格子の中のマス。
        passable: そのマスへ進めるか。格子の中のマスだけを渡す。
        goal: そのマスが目的地か。2つ目の引数は出発点からの歩数（1 以上）。
        max_distance: 何歩先まで探すか。0 以上。ちょうどこの歩数のマスまでを見る。
        order: 隣への差分（列, 行）を、試す順に並べたもの。ここに無い向きへは進まない。

    Returns:
        出発点の次のマスから目的地までの list（長さが歩数）。見つからなければ None。

    Raises:
        ValueError: ``start`` が格子の外のとき（列か行の数が 0 以下なら、どの
            マスも外）、または ``max_distance`` が負のとき。
    """
    if not _inside(cols, rows, start):
        raise ValueError(f"出発点が格子の外: {start}（{cols}×{rows}）")
    if max_distance < 0:
        raise ValueError(f"探す歩数は 0 以上にする: {max_distance}")
    # 訪れた印と、どのマスから来たかを、マスの添字で読み書きする list で持つ。マスを
    # set や dict に入れないので、取り出す順を気にしなくてよい（README の「決定性を
    # 崩す書き方の検査」）。
    size = cols * rows
    seen = [False] * size
    came_from = [-1] * size
    seen[start.row * cols + start.col] = True
    queue: deque[tuple[Cell, int]] = deque([(start, 0)])
    while queue:
        cell, distance = queue.popleft()
        if distance > 0 and goal(cell, distance):
            return _rebuild(cell, distance, came_from, cols)
        if distance >= max_distance:
            continue
        for d_col, d_row in order:
            following = Cell(cell.col + d_col, cell.row + d_row)
            # 添字にする前に、格子の中かを見る。見ないと、右の端の外が次の行の先頭に、
            # 上の外が list の後ろから数えた添字になる。
            if not _inside(cols, rows, following):
                continue
            index = following.row * cols + following.col
            if seen[index] or not passable(following):
                continue
            seen[index] = True
            came_from[index] = cell.row * cols + cell.col
            queue.append((following, distance + 1))
    return None


def _rebuild(goal: Cell, distance: int, came_from: list[int], cols: int) -> list[Cell]:
    """来た所をたどって、出発点の次から目的地までの list にする。

    たどる回数を歩数で決めるので、来た所が壊れていても終わる。
    """
    path: list[Cell] = []
    index = goal.row * cols + goal.col
    for _ in range(distance):
        path.append(Cell(index % cols, index // cols))
        index = came_from[index]
    path.reverse()
    return path
