"""State に足すもの：種類ごとの性質の表。共通の処理は、種類ではなく性質だけを見る。

``test_state.py`` から分けた。状態の表し方の約束と、共通の処理が性質だけを見る使い方は、
別の理由で変わる。``src/`` に部品は無い。

送る・受け取る・後始末のように、状態の種類で答えが変わる処理がいくつもあると、種類で
振り分ける分岐がその処理ごとに散らばり、種類を1つ足すたびに、その全部に書き足す。
ここでは種類ごとの性質を返す関数（``traits_of``）を1つだけ置き、共通の処理はその性質だけを
見る。種類を足すときに書くのは ``traits_of`` の1か所で、書き忘れは mypy が見つける。

TypeScript 版は性質を表（``Record`` と ``satisfies``）で書く。Python の ``dict`` の
型は、鍵がすべてそろっているかを表さないので、``match`` と ``assert_never`` の関数で
書く。
"""

from collections.abc import Sequence
from dataclasses import dataclass
from enum import Enum
from typing import Final, assert_never

import pytest


@dataclass(frozen=True)
class Connecting:
    """つなごうとしている。"""

    attempt: int
    """何回目の試行か。"""


@dataclass(frozen=True)
class Open:
    """つながっている。"""


@dataclass(frozen=True)
class Closing:
    """閉じている途中。こちらからは送らないが、相手が送り終えるまでは受け取る。"""


@dataclass(frozen=True)
class Closed:
    """切れた。"""

    reason: str
    """切れた理由。"""


Connection = Connecting | Open | Closing | Closed


@dataclass(frozen=True)
class Traits:
    """共通の処理が見る性質。処理はこれだけを見て、種類を見ない。"""

    can_send: bool
    """新しく送ってよいか。"""
    can_receive: bool
    """届いたものを受け取るか。

    送れるかと1つにまとめない。閉じている途中は、送らないが受け取る。まとめると、
    閉じている途中の振る舞いが必ずどちらかで壊れる。
    """
    needs_cleanup: bool
    """終えるときに、つないだものを閉じる後始末が要るか。"""


_CONNECTING: Final = Traits(can_send=False, can_receive=False, needs_cleanup=True)
_OPEN: Final = Traits(can_send=True, can_receive=True, needs_cleanup=True)
_CLOSING: Final = Traits(can_send=False, can_receive=True, needs_cleanup=True)
_CLOSED: Final = Traits(can_send=False, can_receive=False, needs_cleanup=False)


def traits_of(state: Connection) -> Traits:
    """状態の性質。種類で振り分けるのは、ここ1か所だけ。"""
    match state:
        case Connecting():
            return _CONNECTING
        case Open():
            return _OPEN
        case Closing():
            return _CLOSING
        case Closed():
            return _CLOSED
        case _:
            assert_never(state)


def exchange(
    state: Connection, outgoing: Sequence[str], incoming: Sequence[str]
) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """送りたいものと届いたもののうち、いまの状態で実際に送るものと受け取るもの。"""
    traits = traits_of(state)
    sent = tuple(outgoing) if traits.can_send else ()
    received = tuple(incoming) if traits.can_receive else ()
    return sent, received


def needing_cleanup(states: Sequence[Connection]) -> list[Connection]:
    """終えるときに後始末が要る接続。並びの順を保つ。"""
    return [state for state in states if traits_of(state).needs_cleanup]


@pytest.mark.parametrize(
    ("state", "sent", "received"),
    [
        (Connecting(attempt=1), (), ()),
        (Open(), ("送る",), ("届いた",)),
        (Closing(), (), ("届いた",)),
        (Closed(reason="時間切れ"), (), ()),
    ],
)
def test_共通の処理は_性質だけで答える(
    state: Connection, sent: tuple[str, ...], received: tuple[str, ...]
) -> None:
    assert exchange(state, ["送る"], ["届いた"]) == (sent, received)


def test_後始末が要る接続を_性質だけで選ぶ() -> None:
    closed = Closed(reason="時間切れ")
    connecting = Connecting(attempt=1)
    states: list[Connection] = [closed, Open(), connecting, Closing(), closed]
    assert needing_cleanup(states) == [Open(), connecting, Closing()]
    assert needing_cleanup([]) == []
    assert needing_cleanup([closed]) == []


def test_似た性質を1つにまとめない_閉じている途中は送らないが受け取る() -> None:
    """送れるかと受け取るかが分かれるのは、閉じている途中だけ。

    1つの真偽値にまとめると、届いたものを捨てるか、閉じている途中に送るか、どちらかになる。
    """
    assert traits_of(Closing()) == Traits(
        can_send=False, can_receive=True, needs_cleanup=True
    )
    assert exchange(Closing(), ["送る"], ["届いた"]) == ((), ("届いた",))


def test_種類を1つ書き忘れると_型検査が止める() -> None:
    """``Closed`` を書き忘れると、``case _:`` に届く型が ``Closed`` のまま残る。

    ``assert_never`` を呼ぶ行で mypy が止める。止めなくなると、mypy --strict は使われて
    いない ``type: ignore`` として失敗する。実行時は、書き忘れた種類が届いた所で止まる。
    """

    def forgetful(state: Connection) -> Traits:
        match state:
            case Connecting():
                return _CONNECTING
            case Open():
                return _OPEN
            case Closing():
                return _CLOSING
            case _:
                assert_never(state)  # type: ignore[arg-type]

    assert forgetful(Open()) == _OPEN
    with pytest.raises(AssertionError, match="Closed"):
        forgetful(Closed(reason="時間切れ"))


class Kind(Enum):
    """中身を持たない閉じた種類を、列挙で表したもの。"""

    CONNECTING = "connecting"
    OPEN = "open"
    CLOSING = "closing"
    CLOSED = "closed"


def test_列挙を鍵にしたdictは_書き忘れても型検査を通る() -> None:
    """``dict[Kind, Traits]`` の型は、鍵がすべてそろっているかを表さない。

    下の ``forgetful`` は ``Kind.CLOSED`` を書き忘れているが、mypy は止めない（止める
    ようになれば、ここで mypy が失敗する）。性質を ``dict`` の表で持つなら、鍵の集合を
    列挙のすべてと比べるテストを置く。
    """
    complete: dict[Kind, Traits] = {
        Kind.CONNECTING: _CONNECTING,
        Kind.OPEN: _OPEN,
        Kind.CLOSING: _CLOSING,
        Kind.CLOSED: _CLOSED,
    }
    forgetful: dict[Kind, Traits] = {
        Kind.CONNECTING: _CONNECTING,
        Kind.OPEN: _OPEN,
        Kind.CLOSING: _CLOSING,
    }
    assert set(complete) == set(Kind)
    assert set(Kind) - set(forgetful) == {Kind.CLOSED}
