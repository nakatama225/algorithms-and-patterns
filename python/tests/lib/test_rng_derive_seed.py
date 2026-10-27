"""種から種を導く関数（derive_seed）の検査。

乱数の本体（Rng）の検査は test_rng.py にある。種を導く式と乱数を生成する式は
別々に変わるので、ファイルを分けた。
"""

import pytest

from algorithms_and_patterns.lib.rng import derive_seed

# 言語をまたぐ固定値。TypeScript のテスト
# （typescript/tests/lib/rng-derive-seed.test.ts）にも同じ名前の表があり、2つが等しい
# ことを test_cross_language.py が検証する。値は2つの言語の実装で別々に出し、一致を
# 確認してから貼った。

# 元の種と番号、そこから導いた種。
DERIVED_SEEDS: dict[tuple[int, int], int] = {
    (12345, 0): 2654423432,
    (12345, 1): 1013891931,
    (12345, 2): 3668335914,
    (0, 0): 2654435761,
    (0, 2**32 - 2): 1640531535,
    (0xFFFFFFFF, 0): 1640531534,
    (0xFFFFFFFF, 7): 239350391,
    (-1, 7): 239350391,
    (2**32 + 5, 3): 2027808449,
}


@pytest.mark.parametrize(("seed", "stream"), list(DERIVED_SEEDS))
def test_種と番号から導いた種が表のとおり(seed: int, stream: int) -> None:
    assert derive_seed(seed, stream) == DERIVED_SEEDS[seed, stream]


class Test種と番号:
    @pytest.mark.parametrize("seed", [0, 12345, 0xFFFFFFFF])
    def test_番号が違えば違う種になり_元の種とも違う(self, seed: int) -> None:
        """番号に 1 を足さないと、番号 0 が元の種をそのまま返す。"""
        streams = [*range(1000), 2**32 - 2]
        derived = [derive_seed(seed, stream) for stream in streams]
        assert len(set(derived)) == len(derived)
        assert seed not in derived

    @pytest.mark.parametrize("stream", [0, 7])
    def test_元の種は_下位32ビットだけを使う(self, stream: int) -> None:
        assert derive_seed(-1, stream) == derive_seed(0xFFFFFFFF, stream)
        assert derive_seed(2**32 + 5, stream) == derive_seed(5, stream)

    @pytest.mark.parametrize("seed", [-(2**40), -1, 0, 2**40])
    def test_導いた種は_0以上2の32乗未満(self, seed: int) -> None:
        for stream in (0, 1, 2**32 - 2):
            assert 0 <= derive_seed(seed, stream) < 2**32


@pytest.mark.parametrize("stream", [-1, 2**32 - 1, 2**40])
def test_derive_seedの番号が範囲の外なら止まる(stream: int) -> None:
    """2**32 - 1 は、1 を足すと下位 32 ビットが 0 になり、元の種がそのまま返る。"""
    with pytest.raises(ValueError, match="番号は 0 以上"):
        derive_seed(12345, stream)
