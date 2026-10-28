"""連鎖の一括処理と最も早い時刻のうち、一括処理（cascade）のたどり方の検査。

最も早い時刻（earliest_times）は ``test_cascade_earliest_times.py`` が、止める値は
``test_cascade_invalid.py`` が見る。

届く関係はどれも ``FakeReaches`` で渡す。尋ねられた回数に上限があるので、印を
付けない誤った実装でも、輪で回り続けずにテストが終わる。
"""

import itertools

from algorithms_and_patterns.lib.cascade import cascade

from .fake_reaches import FakeReaches, all_relations


class Test届く範囲:
    def test_何段でも届く(self) -> None:
        assert cascade(5, [0], FakeReaches((0, 1), (1, 2), (2, 3), (3, 4))) == [
            0,
            1,
            2,
            3,
            4,
        ]

    def test_届かない要素は発火しない(self) -> None:
        """全部の要素を返すだけの誤りとの対照。"""
        reaches = FakeReaches((0, 1), (2, 3))
        assert cascade(4, [0], reaches) == [0, 1]

    def test_届く向きは逆にたどらない(self) -> None:
        """1 から 0 へは届くが、0 から 1 へは届かない。"""
        assert cascade(2, [0], FakeReaches((1, 0))) == [0]

    def test_起点が空なら空で_reachesを呼ばない(self) -> None:
        reaches = FakeReaches((0, 1))
        assert cascade(2, [], reaches) == []
        assert reaches.asked == []

    def test_要素の数が0で起点も空なら空(self) -> None:
        assert cascade(0, [], FakeReaches()) == []

    def test_起点は一度だけ読める並びでもよい(self) -> None:
        """範囲を見るために読み切ってから、たどる。"""
        assert cascade(3, iter([2, 0]), FakeReaches((0, 1))) == [2, 0, 1]


class Test1度だけ発火する:
    def test_ひし形で2つの経路から届いても1度だけ(self) -> None:
        """取り出すときに印を付けると、3 を2度積み、2度返す。"""
        reaches = FakeReaches((0, 1), (0, 2), (1, 3), (2, 3))
        assert cascade(4, [0], reaches) == [0, 1, 2, 3]
        assert reaches.asked == [0, 1, 2, 3]

    def test_重なった起点も1度だけ(self) -> None:
        assert cascade(2, [1, 1, 0, 1], FakeReaches((0, 1))) == [1, 0]

    def test_起点どうしが届き合っても1度だけ(self) -> None:
        assert cascade(2, [0, 1], FakeReaches((0, 1), (1, 0))) == [0, 1]

    def test_輪でも止まる(self) -> None:
        reaches = FakeReaches((0, 1), (1, 2), (2, 0))
        assert cascade(3, [1], reaches) == [1, 2, 0]
        assert reaches.asked == [1, 2, 0]

    def test_自分自身へ届いても止まる(self) -> None:
        assert cascade(2, [0], FakeReaches((0, 0), (0, 1), (1, 1))) == [0, 1]


class Test発火する順:
    def test_起点をすべて先に積み_段の小さい順に返す(self) -> None:
        """起点ごとに連鎖を尽くす形だと [0, 1, 2, 3, 4] になる。"""
        reaches = FakeReaches((0, 1), (1, 2), (3, 4))
        assert cascade(5, [0, 3], reaches) == [0, 3, 1, 4, 2]

    def test_同じ段の中は_reachesが返した順(self) -> None:
        """添字の順に並べ直す誤りとの対照に、大きい添字を先に返す。"""
        assert cascade(4, [0], FakeReaches((0, 3), (0, 1), (0, 2))) == [0, 3, 1, 2]

    def test_reachesは発火した要素にだけ_発火する順に1度ずつ呼ぶ(self) -> None:
        reaches = FakeReaches((0, 2), (2, 1), (2, 0), (1, 2), (3, 0))
        assert cascade(4, [0], reaches) == [0, 2, 1]
        assert reaches.asked == [0, 2, 1]


Pairs = tuple[tuple[int, int], ...]


def reachable(count: int, starts: tuple[int, ...], pairs: Pairs) -> list[int]:
    """起点から届く要素を、変化が無くなるまで組を全部見直す素朴な形で求める。

    待ち行列を使わず、たどる順にもよらない。添字の小さい順に返す。
    """
    found = [False] * count
    for start in starts:
        found[start] = True
    changed = True
    while changed:
        changed = False
        for source, target in pairs:
            if found[source] and not found[target]:
                found[target] = True
                changed = True
    return [index for index in range(count) if found[index]]


def test_3個の要素の全部の関係と起点で_素朴な求め方と同じ要素を1度ずつ返す() -> None:
    """名前を付けた例で見落とした形（輪と枝の組み合わせなど）を、全部の場合で見る。

    期待値は、待ち行列を使わず組を全部見直す別の求め方で作る。実装と同じ手順で
    期待値を作ると、両方が同じ誤りを持ち、テストが通ってしまう。
    """
    cases = 0
    for pairs in all_relations(3):
        for size in range(4):
            for starts in itertools.combinations(range(3), size):
                fired = cascade(3, starts, FakeReaches(*pairs))
                assert sorted(fired) == reachable(3, starts, pairs), (pairs, starts)
                cases += 1
    # 起点の組は空を含めて8通り。並べた場合の数が減ると、見る形が黙って減る。
    assert cases == 512 * 8
