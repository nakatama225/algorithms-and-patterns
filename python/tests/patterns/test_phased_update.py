"""二段の更新（advance_in_phases）の検査。

呼ばれた順を記録する偽物で、順だけを見る。進める処理と後の処理の中身は呼ぶ側が
決めるので、ここでは見ない。呼ぶ側の関数の例外と、型検査が止めるものは
test_phased_update_invalid.py にある。
"""

from collections.abc import Sequence
from dataclasses import dataclass

import pytest

from algorithms_and_patterns.patterns.phased_update import advance_in_phases


@dataclass(frozen=True)
class Spec:
    """表の1つ。名前・番・番の中を新しいものから進めるか・役目を終えるか・足すもの。"""

    name: str
    phase: int
    newest_first: bool = False
    finishes: bool = False
    """進めた刻みで役目を終えるか。"""
    adds: str | None = None
    """進める間に、呼ぶ側の並びの後ろへ足すものの名前。"""


class Recorder:
    """呼ばれた順を記録する偽物。表から order・advance・settle を作る。

    進める間に足したものを並びの後ろに付ける、呼ぶ側の仕事も受け持つ。
    """

    def __init__(self, specs: Sequence[Spec]) -> None:
        self.items = [spec.name for spec in specs]
        """呼ぶ側の並び。進める間に足すものは、ここの後ろに付ける。"""
        self._specs = {spec.name: spec for spec in specs}
        self.log: list[str] = []

    def order(self, item: str, index: int) -> tuple[int, int]:
        spec = self._specs[item]
        return spec.phase, -index if spec.newest_first else index

    def advance(self, item: str) -> bool:
        self.log.append(item)
        spec = self._specs[item]
        if spec.adds is not None:
            self.items.append(spec.adds)
        return spec.finishes

    def settle(self, item: str) -> None:
        self.log.append(f"{item}:settle")

    def run(self) -> list[str]:
        """1刻み進め、呼ぶ側として、進める間に足したものを後ろに付ける。"""
        n = len(self.items)
        kept = advance_in_phases(self.items, self.order, self.advance, self.settle)
        self.items = kept + self.items[n:]
        return kept


def by_index(item: object, index: int) -> tuple[int, int]:
    """すべてを番 0 に置き、並びの順に進める鍵。"""
    return 0, index


def same_key(item: object, index: int) -> tuple[int, int]:
    """すべてに同じ鍵を返す。"""
    return 0, 0


def ignore(item: object) -> None:
    """何もしない後の処理。"""


ROWS = [
    pytest.param(
        [
            Spec("a", 2, newest_first=True),
            Spec("b", 2, newest_first=True, finishes=True),
            Spec("c", 2, newest_first=True),
            Spec("d", 3),
            Spec("e", 1, adds="f"),
        ],
        ["e", "e:settle", "c", "b", "a", "a:settle", "c:settle", "d", "d:settle"],
        ["a", "c", "d", "e"],
        ["a", "c", "d", "e", "f"],
        id="番が3つ_番の中を新しい順_役目を終えるもの_進める間に足すもの",
    ),
    pytest.param(
        [Spec("x", 0), Spec("y", 0), Spec("z", 0)],
        ["x", "y", "z", "x:settle", "y:settle", "z:settle"],
        ["x", "y", "z"],
        ["x", "y", "z"],
        id="番が1つ_すべて進めてから後の処理",
    ),
    pytest.param(
        [Spec("p", 3), Spec("q", -1), Spec("r", 0)],
        ["q", "q:settle", "r", "r:settle", "p", "p:settle"],
        ["p", "q", "r"],
        ["p", "q", "r"],
        id="番の小さい順_負の番も",
    ),
    pytest.param(
        [Spec("s", 0, finishes=True), Spec("t", 1, finishes=True)],
        ["s", "t"],
        [],
        [],
        id="すべてが役目を終える",
    ),
    pytest.param(
        [Spec("only", 5)],
        ["only", "only:settle"],
        ["only"],
        ["only"],
        id="1件",
    ),
]


class Test進める順と後の処理の順:
    @pytest.mark.parametrize(("specs", "log", "kept", "after"), ROWS)
    def test_番ごとにすべて進めてから_役目を終えなかったものの後の処理を並びの順に呼ぶ(
        self,
        specs: list[Spec],
        log: list[str],
        kept: list[str],
        after: list[str],
    ) -> None:
        """1行目は、番を3つ置き、番の中を新しいものから進める場面。

        進めてすぐ後の処理を呼ぶ形・番で区切らずに後の処理を最後にまとめる形・後の
        処理を進めた順に呼ぶ形・役目を終えたものにも後の処理を呼ぶ形・進める間に
        足したものを進めるか返す形・返す並びを進めた順にする形・番の大きい順に進める
        形のどれでも、記録か返す並びが変わる。
        """
        recorder = Recorder(specs)
        assert recorder.run() == kept
        assert recorder.log == log
        assert recorder.items == after

    def test_空の並びは_何も呼ばずに空を返す(self) -> None:
        recorder = Recorder([])
        assert recorder.run() == []
        assert recorder.log == []

    def test_鍵がまったく同じものは_並びの順に進める(self) -> None:
        """並びの順は名前の順と違う。名前で並べ替えると順が変わる。"""
        recorder = Recorder([Spec("c", 0), Spec("a", 0), Spec("b", 0)])
        kept = advance_in_phases(
            recorder.items, same_key, recorder.advance, recorder.settle
        )
        assert recorder.log == ["c", "a", "b", "c:settle", "a:settle", "b:settle"]
        assert kept == ["c", "a", "b"]

    def test_鍵は何も進める前に_1つにつき1度ずつ求める(self) -> None:
        """進める処理が鍵の元の値を変えても、その刻みの順は変わらない。"""
        recorder = Recorder([Spec("a", 1), Spec("b", 0), Spec("c", 1)])
        phases = {"a": 1, "b": 0, "c": 1}

        def order(item: str, index: int) -> tuple[int, int]:
            recorder.log.append(f"order:{item}")
            return phases[item], index

        def advance(item: str) -> bool:
            phases["c"] = -5
            return recorder.advance(item)

        advance_in_phases(recorder.items, order, advance, recorder.settle)
        assert recorder.log == [
            "order:a",
            "order:b",
            "order:c",
            "b",
            "b:settle",
            "a",
            "c",
            "a:settle",
            "c:settle",
        ]


class Test添字で扱う:
    def test_等しい値が2つ並んでも別々に進み_片方だけ役目を終えても_もう片方は残る(
        self,
    ) -> None:
        """値の ``in`` で外すと、等しいもう片方も外れ、後の処理も呼ばれない。"""
        indices: list[int] = []
        advanced: list[int] = []
        settled: list[int] = []

        def order(item: int, index: int) -> tuple[int, int]:
            indices.append(index)
            return 0, index

        def advance(item: int) -> bool:
            advanced.append(item)
            return len(advanced) == 1

        kept = advance_in_phases([5, 5], order, advance, settled.append)
        assert indices == [0, 1]
        assert advanced == [5, 5]
        assert settled == [5]
        assert kept == [5]

    def test_呼んだ並びは書き換えない(self) -> None:
        items = ["a", "b"]
        kept = advance_in_phases(items, by_index, lambda item: item == "a", ignore)
        assert kept == ["b"]
        assert items == ["a", "b"]


class Test選ぶもの:
    def test_選ばなかったものは進めず_後の処理も呼ばず_元の位置に残る(self) -> None:
        """持ち主ごとに進める番を分けるときなどに、ほかの持ち主のものを残す。

        選ぶ関数も、何も進める前に1つにつき1度ずつ呼ぶ。鍵を求める関数は、選んだ
        ものにだけ呼ぶ（選ぶ関数との前後は約束しないので、別の列に記録する）。
        """
        recorder = Recorder([Spec(name, 0, finishes=name == "b") for name in "abcd"])
        ordered: list[str] = []

        def order(item: str, index: int) -> tuple[int, int]:
            ordered.append(item)
            return 0, index

        def picks(item: str) -> bool:
            recorder.log.append(f"picks:{item}")
            return item in {"b", "d"}

        kept = advance_in_phases(
            recorder.items, order, recorder.advance, recorder.settle, picks=picks
        )
        assert ordered == ["b", "d"]
        assert recorder.log == [
            "picks:a",
            "picks:b",
            "picks:c",
            "picks:d",
            "b",
            "d",
            "d:settle",
        ]
        assert kept == ["a", "c", "d"]

    def test_何も選ばなければ_何も進めずにそのまま返す(self) -> None:
        def unexpected(item: str) -> bool:
            raise AssertionError(f"呼ばれないはず: {item}")

        kept = advance_in_phases(
            ["a", "b"], by_index, unexpected, ignore, picks=lambda item: False
        )
        assert kept == ["a", "b"]
