"""最小ベイズリスクによる選択 — 候補の中から、ほかの候補と最も似ているものを選ぶ。

最小ベイズリスク（Minimum Bayes Risk、MBR）による選択。機械翻訳や要約で、モデルから
複数の候補を出したときに、どれを答えにするかを決めるのに使う。候補ごとに、ほかの
すべての候補との似ている度合いの平均を求め、最も高い候補の位置を返す。ほかの多くの
候補と似ている候補は、候補の集まりが共通して支持する答えとみなせる。モデルが最も高い
確率を付けた候補（ビームサーチの1位）をそのまま採ると、確率は高いが、ほかの候補と
かけ離れた答えを選ぶことがある。

似ている度合いを求める関数は、呼ぶ側が渡す。翻訳なら chrF++ や BLEU（文字や語の
n-gram の一致）を渡す。候補は文字列に限らない。関数は ``similarity(候補, 相手)`` の
向きで呼ぶ。chrF++ や BLEU のように向きで値の変わる物差しは、候補を訳、相手を正解と
みなして測る形になる。

同じ値の候補は、別々の候補として数える。同じ答えが2回出たことを、支持が多いしるし
として扱うためで、数えたくなければ呼ぶ側が先に除く。

固定値の表は持たず、約束は「同じ値から、起動のたびに同じ結果を出す」だけ（渡す関数が
そうであれば）。平均は、位置の小さい相手から順に足して求めるので、足す順も毎回同じ。
TypeScript 版（``typescript/src/lib/mbr.ts``）も同じ形。
"""

import math
from collections.abc import Callable, Sequence
from typing import TypeVar

T = TypeVar("T")


def mbr_select(candidates: Sequence[T], similarity: Callable[[T, T], float]) -> int:
    """ほかの候補との似ている度合いの平均が、最も高い候補の位置を返す。

    関数を呼ぶ回数は、候補の数 n に対して n × (n - 1)。``candidates`` は書き換えない。

    Args:
        candidates: 候補の列。空でない。
        similarity: 2つの候補の似ている度合いを返す関数。``similarity(候補, 相手)`` の
            向きで呼ぶ。返す値は有限の数で、大きいほど似ている。

    Returns:
        平均が最も高い候補の位置（0 から数える）。最も高い候補が複数あるときは、前に
        あるほう。候補が1つなら、関数を呼ばずに 0。

    Raises:
        ValueError: ``candidates`` が空のとき、``similarity`` が有限の数でない値
            （NaN・無限大）を返したとき。NaN はどの値と比べても偽なので、最も高い
            ものを選ぶ結果が比べ方で変わる（``>`` で比べると NaN の候補は選ばれず、
            組み込みの ``max`` は並び順で変わる）。無限大は、平均をほかの相手の値に
            よらないものにする。
    """
    n = len(candidates)
    if n == 0:
        raise ValueError("候補が空だと選べない")
    if n == 1:
        return 0
    best_index = 0
    best_mean = -math.inf
    for i, candidate in enumerate(candidates):
        total = 0.0
        for j, other in enumerate(candidates):
            if i == j:
                continue
            value = similarity(candidate, other)
            if not math.isfinite(value):
                raise ValueError(
                    f"似ている度合いが有限の数でない: 候補 {i}、相手 {j}、値 {value!r}"
                )
            total += value
        mean = total / (n - 1)
        if mean > best_mean:
            best_index, best_mean = i, mean
    return best_index
