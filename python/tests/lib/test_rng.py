"""決定的な擬似乱数（rng）の検査。

種を導く関数（derive_seed）の検査と、その固定値の表は test_rng_derive_seed.py にある。
"""

import math
from collections.abc import Callable

import pytest

from algorithms_and_patterns.lib.rng import Rng

# 言語をまたぐ固定値。TypeScript のテスト（typescript/tests/lib/rng.test.ts）にも同じ
# 名前の表があり、2つが等しいことを test_cross_language.py が検証する。値は2つの言語の
# 実装で別々に出し、一致を確認してから貼った。

# 種と、その種で最初に生成した5つの値。
FIRST_VALUES: dict[int, tuple[float, ...]] = {
    12345: (
        0.9797282677609473,
        0.3067522644996643,
        0.484205421525985,
        0.817934412509203,
        0.5094283693470061,
    ),
    1: (
        0.6270739405881613,
        0.002735721180215478,
        0.5274470399599522,
        0.9810509674716741,
        0.9683778982143849,
    ),
    0: (
        0.26642920868471265,
        0.0003297457005828619,
        0.2232720274478197,
        0.1462021479383111,
        0.46732782293111086,
    ),
    0xFFFFFFFF: (
        0.8964226141106337,
        0.189478256739676,
        0.7156526781618595,
        0.9440599093213677,
        0.8452364315744489,
    ),
}

# 種と、その種で 0 から 9 までの列の順を入れ替えた結果。
SHUFFLED: dict[int, tuple[int, ...]] = {
    2024: (9, 2, 0, 1, 7, 3, 4, 5, 6, 8),
    12345: (6, 4, 8, 0, 1, 7, 5, 3, 2, 9),
    0xFFFFFFFF: (3, 0, 9, 4, 2, 7, 6, 5, 1, 8),
}


class Test固定値:
    @pytest.mark.parametrize("seed", list(FIRST_VALUES))
    def test_種ごとに_最初に生成する5つの値が表のとおり(self, seed: int) -> None:
        """足し算と掛け算のあとの切り落としを1か所でも忘れると、ここが食い違う。"""
        rng = Rng(seed)
        assert tuple(rng.random() for _ in range(5)) == FIRST_VALUES[seed]

    @pytest.mark.parametrize("seed", list(SHUFFLED))
    def test_種ごとに_順を入れ替えた結果が表のとおり(self, seed: int) -> None:
        """混ぜる向き（後ろから）と、生成した値から添字を作る式がずれると食い違う。"""
        assert tuple(Rng(seed).shuffled(range(10))) == SHUFFLED[seed]


class Test種と状態:
    @pytest.mark.parametrize(("seed", "same"), [(-1, 0xFFFFFFFF), (2**32 + 5, 5)])
    def test_負の種と_2の32乗以上の種は_下位32ビットとして扱う(
        self, seed: int, same: int
    ) -> None:
        """TypeScript 版の ``seed >>> 0`` と同じ扱い。

        -1 は 0xFFFFFFFF と同じ並びになる。-1 のまま持つと、同じ並びを出すのに
        ``state`` の値が違い、状態を比べたときに食い違って見える。
        """
        a, b = Rng(seed), Rng(same)
        assert a.state == same
        assert [a.random() for _ in range(5)] == [b.random() for _ in range(5)]

    def test_状態は_生成したあとも0以上2の32乗未満(self) -> None:
        """状態は1回ごとに一定の幅だけ進み、2**32 で割った余りになる。

        mulberry32 の決まり。切り落としを忘れると、状態が範囲の外へ出る。
        """
        rng = Rng(0xFFFFFFFF)
        for k in range(1, 4):
            rng.random()
            assert rng.state == (0xFFFFFFFF + k * 0x6D2B79F5) % 2**32

    def test_違う種からは違う並びが出る(self) -> None:
        a, b = Rng(1), Rng(2)
        assert [a.random() for _ in range(20)] != [b.random() for _ in range(20)]


class Test生成する回数:
    def test_1回呼ぶと乱数を1回だけ生成し_cloneは生成しない(self) -> None:
        """random・below・between・chance・choice が対象。

        生成する回数が呼び方で変わると、同じ種でもそれ以降の並びが全部ずれる。
        """
        rng = Rng(1)
        steps: list[Callable[[], object]] = [
            rng.random,
            lambda: rng.below(10),
            lambda: rng.below(1),
            lambda: rng.between(3, 5),
            lambda: rng.chance(0.5),
            lambda: rng.choice("abc"),
        ]
        assert rng.calls == 0
        for count, step in enumerate(steps, start=1):
            step()
            assert rng.calls == count
        rng.clone()
        assert rng.calls == len(steps)

    def test_chanceは_0なら必ず外れ_1なら必ず当たり_どちらも1回生成する(
        self,
    ) -> None:
        rng = Rng(11)
        assert not any(rng.chance(0) for _ in range(1000))
        assert all(rng.chance(1) for _ in range(1000))
        assert rng.calls == 2000

    @pytest.mark.parametrize(("size", "calls"), [(0, 0), (1, 0), (2, 1), (10, 9)])
    def test_shuffledは_要素の数より1少ない回数だけ生成する(
        self, size: int, calls: int
    ) -> None:
        """最後の1つは選ぶ余地が無いので生成しない。

        ``sorted(items, key=…)`` で混ぜると要素の数だけ生成し、TypeScript 版とずれる。
        """
        rng = Rng(5)
        rng.shuffled(range(size))
        assert rng.calls == calls


class Test範囲と添字:
    @pytest.mark.parametrize("limit", [1, 7, 10, 2**32, 2**53 - 1])
    def test_belowは_生成した値に上限を掛けて切り捨てた整数(self, limit: int) -> None:
        """期待値は、表の最初の5つの値から別に求める。

        2**53 - 1 は受けられる最大の上限。
        """
        rng = Rng(12345)
        expected = [math.floor(value * limit) for value in FIRST_VALUES[12345]]
        assert [rng.below(limit) for _ in range(5)] == expected

    def test_belowは_0以上上限未満の整数を_端の値まで出す(self) -> None:
        rng = Rng(42)
        assert {rng.below(7) for _ in range(1000)} == set(range(7))

    def test_betweenは_start以上stop未満の整数を_端の値まで出す(self) -> None:
        rng = Rng(9)
        assert {rng.between(-3, 4) for _ in range(1000)} == set(range(-3, 4))

    def test_betweenは_幅がちょうど最大の範囲からも選ぶ(self) -> None:
        """幅の最大は 2**53 - 1。幅の確認を ``>=`` で比べる形にすると、ここで止まる。"""
        first = FIRST_VALUES[12345][0]
        start = -(2**52)
        expected = start + math.floor(first * (2**53 - 1))
        assert Rng(12345).between(start, 2**52 - 1) == expected

    def test_choiceは_belowで選んだ添字の要素を返す(self) -> None:
        items = "abcdefghij"
        rng = Rng(12345)
        expected = [items[math.floor(value * 10)] for value in FIRST_VALUES[12345]]
        assert [rng.choice(items) for _ in range(5)] == expected

    def test_choiceは_1個の列からその要素を選び_1回生成する(self) -> None:
        rng = Rng(1)
        assert rng.choice(["x"]) == "x"
        assert rng.calls == 1

    def test_chanceは_生成した値が確率より小さいときだけ当たる(self) -> None:
        """表の値ちょうどを確率に渡すと外れ、わずかに大きいと当たる。

        ``<=`` で比べると、ここが逆になる。
        """
        first = FIRST_VALUES[12345][0]
        assert not Rng(12345).chance(first)
        assert Rng(12345).chance(math.nextafter(first, 1))


class Test範囲の外の引数は_乱数を生成する前に止まる:
    @pytest.mark.parametrize(
        "limit", [0, -1, 2**53, 10**309], ids=["0", "-1", "2**53", "10**309"]
    )
    def test_below(self, limit: int) -> None:
        """0 を渡して 0 が返ると、「選べるものが無い」ことに気づけない。

        2**53 以上は TypeScript 版が受けられない。10**309 は float に変換できず、
        確認が無いと、生成したあとで OverflowError になる。
        """
        rng = Rng(1)
        with pytest.raises(ValueError, match="上限は 1 以上 2\\*\\*53 - 1 以下"):
            rng.below(limit)
        assert rng.calls == 0

    @pytest.mark.parametrize(("start", "stop"), [(3, 3), (5, 3)])
    def test_between(self, start: int, stop: int) -> None:
        rng = Rng(1)
        with pytest.raises(ValueError, match=f"start={start}, stop={stop}"):
            rng.between(start, stop)
        assert rng.calls == 0

    def test_betweenの幅が最大を超えると_渡したstartとstopを出す(self) -> None:
        """幅の最大は 2**53 - 1。

        幅の確認を below に任せると、渡していない「上限」の値が出る。
        """
        rng = Rng(1)
        with pytest.raises(ValueError, match=f"start={-(2**52)}, stop={2**52}"):
            rng.between(-(2**52), 2**52)
        assert rng.calls == 0

    @pytest.mark.parametrize("probability", [50, 1.01, -0.1, math.nan])
    def test_chance(self, probability: float) -> None:
        """百分率（50）と取り違えると、黙って「必ず当たる」になる。"""
        rng = Rng(1)
        with pytest.raises(ValueError, match="確率は 0 以上 1 以下"):
            rng.chance(probability)
        assert rng.calls == 0

    def test_空の列からは選べない(self) -> None:
        rng = Rng(1)
        with pytest.raises(ValueError, match="空の列"):
            rng.choice([])
        assert rng.calls == 0


class Test渡した列と_元の乱数を書き換えない:
    def test_shuffledは渡した列を書き換えず_要素を失わない(self) -> None:
        source = list(range(10))
        result = Rng(2024).shuffled(source)
        assert source == list(range(10))
        # 混ざっていること自体も確認する。そのまま返していたら意味が無い。
        assert result != source
        assert sorted(result) == source

    def test_shuffledは_書き換えられない列も受ける(self) -> None:
        assert Rng(7).shuffled((1, 2, 3, 4, 5)) == Rng(7).shuffled([1, 2, 3, 4, 5])

    @pytest.mark.parametrize("items", [[], [7]])
    def test_shuffledは_0個と1個の列でも新しいlistを返す(
        self, items: list[int]
    ) -> None:
        """引数をそのまま返すと、呼び出し側が結果を書き換えたときに元も変わる。"""
        result = Rng(5).shuffled(items)
        assert result == items
        assert result is not items

    def test_cloneは元を進めずに_同じ先を見せる(self) -> None:
        rng = Rng(555)
        rng.random()
        before = rng.state
        ahead = rng.clone()
        predicted = [ahead.random() for _ in range(5)]
        assert rng.state == before
        assert [rng.random() for _ in range(5)] == predicted

    def test_cloneは_生成した回数を0から数え直す(self) -> None:
        rng = Rng(1)
        rng.random()
        rng.random()
        assert rng.clone().calls == 0
