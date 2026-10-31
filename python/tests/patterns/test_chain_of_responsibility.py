"""規則を優先順に試す型（Chain of Responsibility）の検査。"""

import pytest

from algorithms_and_patterns.patterns.chain_of_responsibility import (
    Handler,
    Resolution,
    resolve,
)

# 検査に使う規則。整数を言葉で分類する。


def negative(n: int) -> str | None:
    return "負の数" if n < 0 else None


def zero(n: int) -> str | None:
    return "ゼロ" if n == 0 else None


def even(n: int) -> str | None:
    return "偶数" if n % 2 == 0 else None


RULES: tuple[Handler[int, str], ...] = (negative, zero, even)
FALLBACK = "奇数"


def test_規則が1つも無ければ_あらかじめ決めた答えを採る() -> None:
    assert resolve((), 5, FALLBACK) == Resolution(FALLBACK, None)


def test_最初に答えた規則の答えを採り_どの規則が答えたかも返す() -> None:
    resolution = resolve(RULES, -4, FALLBACK)
    # -4 は負の数でも偶数でもあるが、前にある規則が答える。
    assert resolution.result == "負の数"
    assert resolution.handled_by is negative


def test_どの規則が答えたかは_関数の名前で残せる() -> None:
    resolution = resolve(RULES, 0, FALLBACK)
    assert resolution.handled_by is not None
    assert resolution.handled_by.__name__ == "zero"


def test_どの規則も答えなければ_あらかじめ決めた答えを採る() -> None:
    assert resolve(RULES, 7, FALLBACK) == Resolution(FALLBACK, None)


def test_答えが決まったら_後ろの規則は呼ばない() -> None:
    """後ろの規則まで呼ぶ作りだと、重い判断や、呼ぶだけで何かが起きる規則が無駄に動く。"""
    called: list[str] = []

    def spy(rule: Handler[int, str]) -> Handler[int, str]:
        def wrapped(n: int) -> str | None:
            called.append(rule.__name__)
            return rule(n)

        return wrapped

    resolve(tuple(spy(rule) for rule in RULES), 0, FALLBACK)
    assert called == ["negative", "zero"]


def test_並びの順が優先順になる_入れ替えると答えが変わる() -> None:
    assert resolve((zero, even), 0, FALLBACK).result == "ゼロ"
    assert resolve((even, zero), 0, FALLBACK).result == "偶数"


def test_規則を1つ外すと_その規則が答えていた状況は次の規則に回る() -> None:
    """この型の目的そのもの。規則を外すのに、ほかの規則を1行も触らない。"""
    assert resolve(RULES, 0, FALLBACK).result == "ゼロ"
    assert resolve((negative, even), 0, FALLBACK).result == "偶数"


@pytest.mark.parametrize("answer", [0, "", False])
def test_0_や空文字や_False_の答えも_答えとして採る(answer: int | str) -> None:
    """答えが偽とみなされるかどうかで「譲った」と判断すると、次の規則へ進んでしまう。"""

    def first(n: int) -> int | str | None:
        return answer

    def skipped(n: int) -> int | str | None:
        return "ここまで来てはいけない"

    fallback: int | str = "fallback"
    assert resolve((first, skipped), 1, fallback).result == answer
    assert resolve((first, skipped), 1, fallback).handled_by is first


def test_同じ規則が並びに2度あっても_最初の位置で答える() -> None:
    """答えたら2度目の位置は呼ばれず、答えなければ両方の位置で呼ばれる。"""
    calls: list[int] = []

    def counted(n: int) -> str | None:
        calls.append(n)
        return zero(n)

    assert resolve((counted, even, counted), 0, FALLBACK).handled_by is counted
    assert calls == [0]
    calls.clear()
    assert resolve((counted, even, counted), 3, FALLBACK).handled_by is None
    assert calls == [3, 3]


def test_規則が投げた例外は_握りつぶさずにそのまま伝わる() -> None:
    """例外を「譲った」と見なして次へ進むと、規則の不具合が別の答えに化けて見えなくなる。"""
    called: list[str] = []

    def broken(n: int) -> str | None:
        raise RuntimeError("壊れた規則")

    def after(n: int) -> str | None:
        called.append("after")
        return "後ろ"

    with pytest.raises(RuntimeError, match="壊れた規則"):
        resolve((broken, after), 1, FALLBACK)
    assert called == []


def test_規則が投げた_StopIteration_も_別の例外に化けずに伝わる() -> None:
    """生成式の中で規則を呼ぶ作りだと、StopIteration が RuntimeError に置き換わる。

    規則の中で既定値なしの ``next()`` を空の並びに使うと、StopIteration が出る。
    """

    def first_of_empty(n: int) -> str | None:
        return next(iter([]))

    with pytest.raises(StopIteration):
        resolve((first_of_empty,), 1, FALLBACK)


def test_ラムダ式も規則として並べられる() -> None:
    """ラムダ式の名前は ``<lambda>`` になる。名前を記録に残すなら ``def`` で書く。"""
    rule: Handler[int, str] = lambda n: "大きい" if n > 100 else None  # noqa: E731
    resolution = resolve((rule,), 500, FALLBACK)
    assert resolution.result == "大きい"
    assert resolution.handled_by is not None
    assert resolution.handled_by.__name__ == "<lambda>"
