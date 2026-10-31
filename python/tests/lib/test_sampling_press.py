"""毎回読む値の判定（``sampling.py``）のうち、押す・離すを扱う2つのテスト。

押し始め（``EdgeDetector``）と短い押しの取りこぼし防止（``PressLatch``）を見る。揺れる値を
分ける2つは ``test_sampling.py`` が見る。
"""

import enum

import pytest

from algorithms_and_patterns.lib.sampling import EdgeDetector, PressLatch


class Test押し始め:
    def test_押し始めた回だけ返す(self) -> None:
        edges: EdgeDetector[str] = EdgeDetector([])
        held = [{"a"}, {"a"}, {"a", "b"}, {"b"}, set(), {"a"}]
        started = [edges.update(keys) for keys in held]
        assert started == [{"a"}, set(), {"b"}, set(), set(), {"a"}]

    @pytest.mark.parametrize(
        ("held_at_start", "expected"),
        [
            pytest.param(["a"], set(), id="押していた鍵を渡す"),
            pytest.param(
                [], {"a"}, id="対照_何も押していない組で始めると押し始めに見える"
            ),
        ],
    )
    def test_始まりの前から押していた鍵は_押し始めにならない(
        self, held_at_start: list[str], expected: set[str]
    ) -> None:
        """何も押していない組で始めると、押したまま始まった鍵を押したことにしてしまう。"""
        assert EdgeDetector(held_at_start).update(["a"]) == expected

    def test_始まりの前の鍵も_離して押し直せば押し始めになる(self) -> None:
        edges = EdgeDetector(["a"])
        assert [edges.update(keys) for keys in (["a"], [], ["a"])] == [
            set(),
            set(),
            {"a"},
        ]

    def test_押していなかった鍵を渡しても_最初の回に離した扱いになるだけ(
        self,
    ) -> None:
        """押しているかが分からないときに、押し始めだけを見たい鍵を全部渡す使い方。"""
        edges = EdgeDetector(["a", "b"])
        assert edges.update([]) == set()
        assert edges.update(["a"]) == {"a"}

    def test_同じ回に2度呼ぶと_2度目は押し始めを返さない(self) -> None:
        """1回の読みで1度だけ呼び、返した押し始めを、その回の処理の全部で使う。"""
        edges: EdgeDetector[str] = EdgeDetector([])
        assert edges.update(["a"]) == {"a"}
        assert edges.update(["a"]) == set()

    def test_release_allのあとは_押したままの鍵がもう一度押し始めになる(
        self,
    ) -> None:
        edges: EdgeDetector[str] = EdgeDetector([])
        edges.update(["a"])
        edges.release_all()
        assert edges.update(["a"]) == {"a"}

    def test_始まりの前の鍵は省けない(self) -> None:
        """既定を空の組にすると、押したまま始まった鍵の穴がそのまま戻る。"""
        with pytest.raises(TypeError):
            EdgeDetector()  # type: ignore[call-arg]

    def test_始まりの前の鍵は写して持つ(self) -> None:
        held = {"a"}
        edges = EdgeDetector(held)
        held.clear()
        assert edges.update(["a"]) == set()

    def test_同じ鍵が重なっても1つにまとめ_frozensetで返す(self) -> None:
        edges: EdgeDetector[str] = EdgeDetector([])
        started = edges.update(["a", "a"])
        assert started == {"a"}
        assert isinstance(started, frozenset)

    def test_鍵の組の代わりに文字列を1つ渡すと止まる(self) -> None:
        """止めないと ``'enter'`` が4つの鍵に分かれ、型検査も止めない。"""
        with pytest.raises(TypeError, match="鍵の組の代わりに文字列が来た: 'enter'"):
            EdgeDetector("enter")
        edges = EdgeDetector(["enter"])
        with pytest.raises(TypeError, match="鍵の組の代わりに文字列が来た: 'enter'"):
            edges.update("enter")
        assert edges.update(["enter"]) == set()

    def test_鍵はhashできる値なら何でもよい(self) -> None:
        class Side(enum.Enum):
            LEFT = "left"
            RIGHT = "right"

        sides = EdgeDetector([Side.LEFT])
        assert sides.update([Side.LEFT, Side.RIGHT]) == {Side.RIGHT}
        pairs = EdgeDetector([(0, 1)])
        assert pairs.update([(0, 1), (1, 0)]) == {(1, 0)}


class Test短い押し:
    def test_何も押していなければ空(self) -> None:
        latch: PressLatch[str] = PressLatch()
        assert latch.read() == set()

    def test_読みの間に押して離した鍵も_その回は押した扱い(self) -> None:
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.release("a")
        assert latch.read() == {"a"}

    def test_end_stepで印が消え_押したままの鍵は残る(self) -> None:
        """``end_step`` で押している鍵まで消すと、押し続けている鍵が次の回に消える。"""
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.press("b")
        latch.release("a")
        assert latch.read() == {"a", "b"}
        latch.end_step()
        assert latch.read() == {"b"}

    def test_end_stepを呼ばない回の押しは_次に読み終えるまで残る(self) -> None:
        """読んだのに使わなかった回に忘れると、その間の押しが使われないまま消える。"""
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.release("a")
        assert latch.read() == {"a"}
        assert latch.read() == {"a"}
        latch.end_step()
        assert latch.read() == set()

    def test_離したことが届かなかった鍵を押し直しても_印を付ける(self) -> None:
        """押していなかった鍵にだけ印を付けると、押し直してすぐ離した鍵が消える。"""
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.end_step()
        latch.press("a")
        latch.release("a")
        assert latch.read() == {"a"}

    def test_押していない鍵を離しても何も起きない(self) -> None:
        latch: PressLatch[str] = PressLatch()
        latch.release("a")
        assert latch.read() == set()

    def test_同じ鍵を2度押しても1つで_離しても印は残る(self) -> None:
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.press("a")
        latch.release("a")
        assert latch.read() == {"a"}
        latch.end_step()
        assert latch.read() == set()

    def test_forget_allのあとは_押したままの鍵も印も残らない(self) -> None:
        """離したことが届かなくなるとき、忘れないと押したままの鍵が読まれ続ける。"""
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        latch.press("b")
        latch.release("b")
        latch.forget_all()
        assert latch.read() == set()
        latch.press("a")
        assert latch.read() == {"a"}

    def test_frozensetで返し_あとの押しで読んだ値は変わらない(self) -> None:
        latch: PressLatch[str] = PressLatch()
        latch.press("a")
        first = latch.read()
        latch.press("b")
        assert first == {"a"}
        assert isinstance(first, frozenset)
