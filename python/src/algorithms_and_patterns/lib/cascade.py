"""連鎖の一括処理と最も早い時刻 — 届く関係に沿って、発火を尽きるまでまとめて広げる。

要素の1つが発火する（その要素の処理が起きる）と、そこから届く要素も同じ時刻に発火し、
さらにその先へも広がる、という連鎖を扱う。要素は 0 から始まる添字で表し、どの要素から
どの要素へ届くかは、添字を受けて届く相手の添字を返す関数（``reaches``）で渡す。

- ``cascade``：起点から連鎖が尽きるまでたどり、発火した要素を、発火する順に1度ずつ返す
- ``earliest_times``：要素ごとに自分で発火する時刻を持つとき、発火が起きる前に、
  それぞれが実際に発火する最も早い時刻を見積もる。``cascade`` と同じたどり方
  （``_spread``）を使うので、時刻の見積もりと実際の連鎖が、同じ届く関係と同じ
  たどり方で決まる

計算は、添字の比べと時刻の比べだけで書く。時刻は足し引きせず、渡した値をそのまま返す。
固定値の表は持たず、約束は「同じ入力から、起動のたびに同じ結果を出す」だけ（README の
「決定性を崩す書き方の検査」）。印は添字で読み書きする list で持ち、要素を set や dict
に入れて順に取り出さない。TypeScript 版（``typescript/src/lib/cascade.ts``）も同じ形。
"""

import math
from collections.abc import Callable, Iterable, Sequence

Reaches = Callable[[int], Iterable[int]]
"""添字を受けて、その要素が発火したときに届く相手の添字を返す関数。"""


def cascade(count: int, starts: Iterable[int], reaches: Reaches) -> list[int]:
    """起点から連鎖が尽きるまでたどり、発火した要素を発火する順に1度ずつ返す。

    待ち行列でたどり、積むときに印を付ける。取り出すときに付けると、2つの経路から
    届いた要素を2度積み、2度処理する。同じ要素へいくつもの経路で届く形、輪、自分
    自身へ届く形でも、1度ずつで止まる。

    - 起点を渡した順に先に積み、そのあとは積んだ順にたどる。返す順は、起点から何回
      届いて発火したか（段）の小さい順で、同じ段の中は積んだ順
    - ``reaches`` は、発火した要素にだけ、返す順に1度ずつ呼ぶ
    - 重なった起点は1度だけ発火する

    Args:
        count: 要素の数。0 以上。
        starts: 起点の添字。たどり始める前に、すべての範囲を見る。
        reaches: 届く相手を返す関数。

    Returns:
        発火した要素の添字。発火する順。

    Raises:
        ValueError: ``count`` が負のとき、起点か ``reaches`` が返した添字が 0 以上
            ``count`` 未満でないとき。負の添字は list の後ろから数えた要素を指し、
            別の要素に印を付けてしまう。
    """
    if count < 0:
        raise ValueError(f"要素の数は 0 以上にする: {count}")
    first = list(starts)
    for start in first:
        _check_index("起点", start, count)
    return _spread([False] * count, first, reaches)


def earliest_times(times: Sequence[float], reaches: Reaches) -> list[float]:
    """要素ごとの時刻から、連鎖を考えた、それぞれが実際に発火する最も早い時刻を求める。

    要素は自分の時刻に発火し、届いた相手は同じ時刻に発火する。添字を時刻の小さい順に
    並べ（同じ時刻なら添字の小さい順）、まだ発火していない要素から ``cascade`` と同じ
    たどり方を当て、届いた要素にその時刻を入れる。

    印は、起点を替えても1組だけを使う。前の起点の連鎖で時刻の決まった要素は、印が
    あるので積まれず、その先もたどり直さない。小さい時刻から決めるので、あとから届く
    遅い時刻が、決まった時刻を書き換えることもない。起点ごとに新しい印で ``cascade``
    を呼ぶ形にすると、決まった要素の先を毎回たどり直し、遅い起点から早い起点へ届く
    形で、早いほうの時刻が遅いほうに書き換わる。

    - 時刻が ``math.inf`` の要素は、自分では発火しない。ほかから届いたときだけ時刻が
      入り、どこからも届かなければ ``math.inf`` のまま
    - 負の時刻と ``-math.inf``、float の範囲を超える int も受ける。比べるだけで
      足し引きしないので、どの値でも意味が変わらない
    - ``reaches`` は、発火した要素にだけ1度ずつ呼ぶ

    Args:
        times: 要素ごとの、自分で発火する時刻。単位は問わない。
        reaches: 届く相手を返す関数。

    Returns:
        要素ごとの、最も早く発火する時刻。どれも ``times`` のどれかの値そのもの。
        ``times`` は書き換えない。

    Raises:
        ValueError: 時刻に NaN があるとき（大小を比べるとどれも偽になり、並べた順が
            決まらない）、または ``reaches`` が返した添字が範囲の外のとき。
    """
    for index, time in enumerate(times):
        # 自分と等しくない値は NaN だけ。math.isnan は int を float に変換するので、
        # float の範囲を超える int を渡すと OverflowError で止まってしまう。
        if time != time:
            raise ValueError(f"時刻が NaN: {index} 番目")
    result = list(times)
    fired = [False] * len(times)
    # sorted は安定なので、同じ時刻なら添字の小さい順。答えは順によらないが、
    # reaches を呼ぶ順を決めておく。
    for index in sorted(range(len(times)), key=lambda i: times[i]):
        time = times[index]
        if time == math.inf:
            # 残りはどれも無限大で、自分では発火しない。
            break
        for reached in _spread(fired, [index], reaches):
            result[reached] = time
    return result


def _spread(fired: list[bool], starts: Sequence[int], reaches: Reaches) -> list[int]:
    """印のまだ無い起点から連鎖をたどり、新しく発火した要素を発火する順に返す。

    ``fired`` に印を付けていく。呼ぶ側が同じ ``fired`` を渡し続ければ、前の呼び出しで
    発火した要素は積まず、その先もたどらない。起点は範囲の中のものだけを渡す。

    返す list をそのまま待ち行列にし、先頭の添字を進めて読む。積んだ順が、そのまま
    発火する順になる。
    """
    count = len(fired)
    order: list[int] = []
    for start in starts:
        if not fired[start]:
            fired[start] = True
            order.append(start)
    head = 0
    while head < len(order):
        index = order[head]
        head += 1
        for target in reaches(index):
            _check_index(f"{index} から届く相手", target, count)
            if not fired[target]:
                fired[target] = True
                order.append(target)
    return order


def _check_index(name: str, index: int, count: int) -> None:
    """添字が 0 以上 ``count`` 未満かを確認する。"""
    if not 0 <= index < count:
        raise ValueError(f"{name}が範囲の外: {index}（要素の数 {count}）")
