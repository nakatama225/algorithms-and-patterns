"""連鎖の一括処理のテストが使う、偽の届く関係。テストの補助で、src には対応しない。

- ``FakeReaches``：届く関係を (元, 先) の組で持ち、尋ねられた添字を順に控える
- ``all_relations``：少ない要素の間の、ありうるすべての届く関係。素朴な求め方と
  突き合わせるテストが、全部の場合を並べるのに使う
"""

from collections.abc import Iterator


class FakeReaches:
    """届く関係を (元, 先) の組で持ち、尋ねられた添字を順に控える ``reaches``。

    同じ元の組は、書いた順に先を返す。尋ねられた回数が ``limit`` を超えたら止める。
    印を付けない誤った実装でも、輪で回り続けずにテストが終わる。
    """

    def __init__(self, *pairs: tuple[int, int], limit: int = 100) -> None:
        self._targets: dict[int, list[int]] = {}
        for source, target in pairs:
            self._targets.setdefault(source, []).append(target)
        self._limit = limit
        self.asked: list[int] = []
        """尋ねられた添字。尋ねられた順。"""

    def __call__(self, index: int) -> list[int]:
        self.asked.append(index)
        if len(self.asked) > self._limit:
            raise RuntimeError(f"reaches を {self._limit} 回より多く呼んだ")
        return list(self._targets.get(index, []))


def all_relations(count: int) -> Iterator[tuple[tuple[int, int], ...]]:
    """``count`` 個の要素の間の、ありうるすべての届く関係。

    自分自身へ届く組も含める。組の数は ``count`` の2乗なので、関係の数は 2 の
    ``count ** 2`` 乗になる。3 個なら 512 通り。
    """
    pairs = [(source, target) for source in range(count) for target in range(count)]
    for mask in range(1 << len(pairs)):
        yield tuple(pair for bit, pair in enumerate(pairs) if mask >> bit & 1)
