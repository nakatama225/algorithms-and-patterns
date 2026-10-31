"""二段の更新 — 同じ番のものをすべて進めてから、後の処理を呼ぶ。

たくさんのものを1刻みずつ進めるとき、1つずつ「進めてすぐ後の処理（ぶつかったかを
見る、など）」を呼ぶと、先に呼んだものの後の処理が、まだ進んでいないものの古い
位置を読む。逆に、あとから進むものの進める処理が、先に呼んだ後の処理の結果を読む
こともある。そこで、同じ番のものをすべて進めてから、後の処理を呼ぶ。

進める順と、並びの順を分ける。進める順は、呼ぶ側が渡す鍵（番, 番の中の順）で決める。
返す並びは、呼んだ時点の並びの順のまま（状態の要約に混ぜる順などを、進める順で
変えない）。

並びは呼んだ時点で写し、写した並びの位置（添字）で扱う。同じものかを実体で比べない
ので、等しい値が2つ並んでも別々に進み、片方だけが役目を終えても、もう片方は残る。
進めている間に呼ぶ側が自分の並びへ足したものは、この関数からは見えない。進めず、
後の処理も呼ばず、返り値にも含めない。後ろに付けるのは呼ぶ側の仕事になる。

後の処理が無く、進める処理が並びのほかのものの進めた結果を読まず、起きたことも
返さないなら、どの順に進めても結果は同じで、ふつうの for 文で足りる。後の処理が
並びのほかのものの進めた結果を読むか、後の処理が変えた値を、並びのほかのものの進める
処理が読むなら、進める処理どうしが互いを読まなくても、二段に分けることは要る。
番の中の順は、同じ番の進める処理が互いの進めた結果を読まず、起きたことも返さない
なら、結果に影響しない。
"""

from collections.abc import Callable, Sequence
from itertools import groupby
from typing import TypeAlias, TypeVar

T = TypeVar("T")

Order: TypeAlias = Callable[[T, int], tuple[int, int]]
"""1つと、その並びの位置（添字）から、進める順の鍵（番, 番の中の順）を返す関数。

番の小さい順に進め、同じ番の中は2つ目の小さい順に進める。新しく並んだものから
進めるなら、2つ目に位置の符号を反転した値（``-index``）を返す。鍵がまったく同じ
ものどうしは、並びの順に進める。
"""

Advance: TypeAlias = Callable[[T], bool]
"""1つを1刻み進め、その刻みで役目を終えたかを返す関数。終えたら True。

True を返したものは返り値の並びから外し、後の処理（``Settle``）も呼ばない。
"""

Settle: TypeAlias = Callable[[T], None]
"""同じ番のものがすべて進んだあとに、役目を終えなかったものそれぞれに呼ぶ関数。

返り値は使わない。値を返す関数を渡すと型検査が止めるので、後の処理が起きたことの
列を返すなら、呼ぶ側で包み、自分の列に足す。
"""


def advance_in_phases(
    items: Sequence[T],
    order: Order[T],
    advance: Advance[T],
    settle: Settle[T],
    *,
    picks: Callable[[T], bool] | None = None,
) -> list[T]:
    """並びを番の小さい順に1刻み進め、役目を終えなかったものを、元の順で返す。

    番ごとに、その番のものをすべて進めてから、役目を終えなかったものの ``settle`` を
    並びの順（古いものから）に呼び、次の番へ移る。番の中を新しいものから進めても、
    ``settle`` は並びの順に呼ぶ。

    ``picks`` と ``order`` は、何も進める前に、1つにつき1度ずつ呼ぶ（``order`` は
    選んだものだけ）。進めている間に変わる値で鍵が変わることはない。

    呼んだ並びは書き換えない。``order``・``picks``・``advance``・``settle`` が例外を
    出すと、そのまま呼ぶ側へ伝わり（StopIteration も別の例外に置き換えない）、それまでに
    役目を終えたものも呼ぶ側の並びに残る。

    Args:
        items: 進めるものの並び。呼んだ時点で写す。
        order: 進める順の鍵を返す関数（``Order``）。
        advance: 1刻み進め、役目を終えたら True を返す関数（``Advance``）。
        settle: 同じ番のものがすべて進んだあとに呼ぶ関数（``Settle``）。
        picks: この呼び出しで進めるものを選ぶ関数。選ばなかったものは進めず、
            ``settle`` も呼ばず、返り値の元の位置に残す。省くと、すべてを進める。

    Returns:
        役目を終えなかったものと、選ばなかったもの。呼んだ時点の並びの順。
        進めている間に呼ぶ側が足したものは含まないので、呼ぶ側が後ろに付ける。
        呼んでいる間、呼ぶ側の list の後ろに足すだけなら、呼ぶ前の長さを ``n`` として
        ``kept + items[n:]`` で付けられる。外したり途中に差し込んだりすると、
        ``items[n:]`` が増えたものと合わなくなる。
    """
    snapshot = list(items)
    # 鍵は1度ずつ求めてから並べる。sorted は安定なので、鍵が同じものは並びの順のまま。
    # 生成式でなくリスト内包で集める。生成式の中から StopIteration が出ると、Python は
    # RuntimeError に置き換える（PEP 479）ので、order か picks が出したものが別の例外に
    # 化けて届く。
    due = sorted(
        [
            (order(item, index), index)
            for index, item in enumerate(snapshot)
            if picks is None or picks(item)
        ],
        key=lambda entry: entry[0],
    )
    finished: set[int] = set()
    # groupby は隣り合うものしかまとめないので、番で並べたあとに区切る。
    for _, group in groupby(due, key=lambda entry: entry[0][0]):
        members = [index for _, index in group]
        for index in members:
            if advance(snapshot[index]):
                finished.add(index)
        for index in sorted(members):
            if index not in finished:
                settle(snapshot[index])
    return [item for index, item in enumerate(snapshot) if index not in finished]
