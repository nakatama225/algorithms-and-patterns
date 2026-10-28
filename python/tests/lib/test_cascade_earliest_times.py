"""連鎖の一括処理と最も早い時刻のうち、最も早い時刻（earliest_times）の検査。

たどり方は ``test_cascade.py`` が、止める値は ``test_cascade_invalid.py`` が見る。
最も早い時刻は一括処理と同じたどり方を使うが、時刻の扱い（無限大・同じ時刻の順・
印を共有すること）は、たどり方とは別の理由で変わるので、ファイルを分けた。
"""

import itertools
import math

from algorithms_and_patterns.lib.cascade import earliest_times

from .fake_reaches import FakeReaches, all_relations

INF = math.inf


class Test時刻が伝わる:
    def test_届いた相手は起点と同じ時刻になる(self) -> None:
        assert earliest_times([1, 5], FakeReaches((0, 1))) == [1, 1]

    def test_何段でも伝わる(self) -> None:
        """添字の順に1回だけ見直す形では、1段しか伝わらない並び。"""
        reaches = FakeReaches((3, 2), (2, 1), (1, 0))
        assert earliest_times([9, 8, 7, 1], reaches) == [1, 1, 1, 1]

    def test_届かない要素は自分の時刻のまま(self) -> None:
        """全部の要素を最も小さい時刻にするだけの誤りとの対照。"""
        assert earliest_times([1, 5, 3], FakeReaches((0, 1))) == [1, 1, 3]

    def test_自分の時刻のほうが早ければ_届いても変わらない(self) -> None:
        assert earliest_times([4, 2], FakeReaches((0, 1))) == [4, 2]

    def test_遅い要素から早い要素へ届いても_早い時刻は書き換わらない(self) -> None:
        """時刻 5 の要素 0 が時刻 2 の要素 1 へ届き、どちらも要素 2 へ届く。

        起点ごとに新しい印でたどると、要素 0 の連鎖が要素 1 と 2 をたどり直し、
        どちらも 5 に書き換わる。
        """
        reaches = FakeReaches((0, 1), (1, 2), (0, 2))
        assert earliest_times([5, 2, 9], reaches) == [5, 2, 2]

    def test_ひし形と輪と自分自身でも止まる(self) -> None:
        reaches = FakeReaches((0, 1), (0, 2), (1, 3), (2, 3), (3, 0), (3, 3))
        assert earliest_times([3, INF, INF, INF], reaches) == [3, 3, 3, 3]

    def test_空なら空(self) -> None:
        assert earliest_times([], FakeReaches()) == []


class Test無限大と負の時刻:
    def test_無限大の要素は自分では発火せず_届かなければ無限大のまま(self) -> None:
        reaches = FakeReaches((0, 1), (1, 2))
        assert earliest_times([INF, 2, INF], reaches) == [INF, 2, 2]
        # 要素 0 は発火しないので、届く相手を尋ねない。
        assert reaches.asked == [1, 2]

    def test_すべて無限大なら_reachesを呼ばない(self) -> None:
        reaches = FakeReaches((0, 1), (1, 0))
        assert earliest_times([INF, INF], reaches) == [INF, INF]
        assert reaches.asked == []

    def test_負の時刻と負の無限大も受ける(self) -> None:
        reaches = FakeReaches((0, 2), (1, 3))
        assert earliest_times([-INF, -3, 0.5, 7], reaches) == [-INF, -3, -INF, -3]

    def test_floatの範囲を超えるintの時刻も受ける(self) -> None:
        """NaN の確認で float に変換すると、10**400 は OverflowError で止まる。"""
        late = 10**400
        assert earliest_times([late, 1], FakeReaches((1, 0))) == [1, 1]
        assert earliest_times([late, 1], FakeReaches((0, 1))) == [late, 1]

    def test_時刻は足し引きせず_渡した値をそのまま返す(self) -> None:
        """0.1 + 0.2 は 0.30000000000000004。丸めたり計算し直したりすると変わる。"""
        early = 0.1 + 0.2
        assert earliest_times([early, 1.0], FakeReaches((0, 1))) == [early, early]


class Testreachesを呼ぶ回数と順:
    def test_印を共有し_どの要素の届く相手も1度しか尋ねない(self) -> None:
        """起点ごとに新しい印でたどると、決まった要素の先を毎回たどり直す。

        どの要素からも全部の要素へ届くので、たどり直すと4回より多く尋ねる。
        """
        pairs = [(source, target) for source in range(4) for target in range(4)]
        reaches = FakeReaches(*pairs)
        assert earliest_times([4, 3, 2, 1], reaches) == [1, 1, 1, 1]
        assert reaches.asked == [3, 0, 1, 2]

    def test_同じ時刻なら添字の小さい要素から発火する(self) -> None:
        reaches = FakeReaches((1, 0), (0, 1))
        assert earliest_times([4, 4], reaches) == [4, 4]
        assert reaches.asked == [0, 1]

    def test_渡した時刻の並びを書き換えない(self) -> None:
        times = [5.0, 1.0]
        assert earliest_times(times, FakeReaches((1, 0))) == [1.0, 1.0]
        assert times == [5.0, 1.0]


def by_repeated_relaxing(
    times: tuple[float, ...], pairs: tuple[tuple[int, int], ...]
) -> list[float]:
    """全部の組を比べ、変化が無くなるまで繰り返す素朴な求め方。

    animal-bomber の見積もりと同じ形。早い要素が遅い要素へ届いていれば、遅いほうを
    早いほうに合わせる。値は小さくなる一方で、取りうる値は ``times`` の中だけなので、
    必ず止まる。
    """
    result = list(times)
    changed = True
    while changed:
        changed = False
        for source, target in pairs:
            if result[source] < result[target]:
                result[target] = result[source]
                changed = True
    return result


def test_3個の要素の全部の関係と時刻の組で_素朴な求め方と一致する() -> None:
    """名前を付けた例で見落とした形を、全部の場合で見る。

    期待値は、印も並べ替えも使わない別の求め方で作る。時刻は 1・2・無限大の3つから
    選び、同じ時刻と無限大の重なりも含める。
    """
    cases = 0
    for pairs in all_relations(3):
        for times in itertools.product((1.0, 2.0, INF), repeat=3):
            found = earliest_times(times, FakeReaches(*pairs))
            assert found == by_repeated_relaxing(times, pairs), (pairs, times)
            cases += 1
    # 並べた場合の数が減ると、見る形が黙って減る。
    assert cases == 512 * 27
