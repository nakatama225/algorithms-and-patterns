"""Chain of Responsibility — 規則を優先順に並べ、先頭から「自分の出番か」を尋ねていく。

規則は、自分の出番なら答えを返し、そうでなければ ``None`` を返して次に譲る。
最初に答えた規則の答えを採る。どの規則も答えなければ、あらかじめ決めた答えを採る。

1つの長い関数に if を順に並べる書き方と比べて、並びの操作が、そのまま
振る舞いの操作になる。

- 規則を試しに外す … 並びから1行消す
- 規則を試しに足す … 並びに1行足す
- 優先順を変える … 行を入れ替える

どの規則も、ほかの規則の存在を知らない。長い関数のどこに差し込むとどの分岐が
飛ばされるかを、読んで確かめる必要がない。

⚠️ 並びの順が意味を持つ。前の規則が広い範囲で答えると、後ろの規則は一度も呼ばれない。

規則はただの関数にする。クラスにして次の規則への参照を持たせる形（規則どうしを
鎖のようにつなぐ形）は採らない。並びをタプルで持てば、順番は並びの側だけが知っていればよい。
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Generic, TypeAlias, TypeVar

C = TypeVar("C")
R = TypeVar("R")

Handler: TypeAlias = Callable[[C], R | None]
"""規則1つ。状況を受け取り、自分の出番なら答えを、そうでなければ ``None`` を返す。

状況は読むだけで、書き換えない。書き換えると、後ろの規則が別の状況を見て判断する。
``def`` で書いた規則なら、名前は関数の名前（``__name__``）をそのまま使える。
ラムダ式の名前は ``<lambda>``。``functools.partial`` や ``__call__`` を持つ
オブジェクトは ``__name__`` を持たず、型検査もそれを止めない。
名前を記録に残す規則は ``def`` で書く。
"""


@dataclass(frozen=True)
class Resolution(Generic[C, R]):
    """答えと、それを返した規則。"""

    result: R
    handled_by: Handler[C, R] | None
    """答えた規則。どれも答えず、あらかじめ決めた答えを採ったときは ``None``。"""


def resolve(
    chain: Sequence[Handler[C, R]], context: C, fallback: R
) -> Resolution[C, R]:
    """規則を先頭から試し、最初に返ってきた答えを採る。

    ⚠️ 答えそのものに ``None`` を使わない。``None`` は「次に譲る」の意味に使うので、
    区別がつかない。型変数では「``None`` 以外」を表せないので、型検査では止まらない。
    0 や空文字や ``False`` は答えとして扱う。

    規則が投げた例外は、そのまま呼び出し側へ伝わる。後ろの規則は呼ばれない。

    Args:
        chain: 規則の並び。前にあるものほど優先される。
        context: 規則が判断に使う状況。
        fallback: どの規則も答えなかったときの答え。
    """
    # next() と生成式で1行にも書けるが、for 文にしている。生成式の中から
    # StopIteration が出ると、Python は RuntimeError に置き換える（PEP 479）。
    # 規則の中で既定値なしの next() を空の並びに使う、というよくある書き間違いが、
    # 別の例外に化けて届く。
    for handler in chain:
        result = handler(context)
        if result is not None:
            return Resolution(result, handler)
    return Resolution(fallback, None)
