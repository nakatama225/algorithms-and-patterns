"""二段の更新（advance_in_phases）が、呼ぶ側の関数の例外をそのまま伝えることと、
型検査が止めるものの検査。

進める順と後の処理の順は ``test_phased_update.py`` が見る。例外の伝え方と受け取る型の
約束は、順とは別の理由で変わるので、ファイルを分けた。
"""

from collections.abc import Callable

import pytest

from algorithms_and_patterns.patterns.phased_update import advance_in_phases

from .test_phased_update import by_index, ignore


def keeps(item: object) -> bool:
    """進めても役目を終えない。"""
    return False


def a_finishes(item: str) -> bool:
    """a だけが役目を終える。"""
    return item == "a"


def stop_at_b(item: str) -> None:
    """b で StopIteration を出す。

    呼ぶ側の関数の中で既定値なしの ``next()`` を空の並びに使う、というよくある
    書き間違いで出る例外。生成式の中で呼ぶ作りだと、RuntimeError に置き換わる
    （PEP 479）。
    """
    if item == "b":
        raise StopIteration("止める")


def order_stops(item: str, index: int) -> tuple[int, int]:
    stop_at_b(item)
    return 0, index


def picks_stops(item: str) -> bool:
    stop_at_b(item)
    return True


def advance_stops(item: str) -> bool:
    """a は役目を終え、b で止める。"""
    stop_at_b(item)
    return True


CALLS: dict[str, Callable[[list[str]], list[str]]] = {
    "鍵を求める関数": lambda items: advance_in_phases(
        items, order_stops, keeps, ignore
    ),
    "選ぶ関数": lambda items: advance_in_phases(
        items, by_index, keeps, ignore, picks=picks_stops
    ),
    "進める処理": lambda items: advance_in_phases(
        items, by_index, advance_stops, ignore
    ),
    "後の処理": lambda items: advance_in_phases(items, by_index, a_finishes, stop_at_b),
}
"""止める関数の役目ごとに、並び ["a", "b"] で呼ぶ形。"""


class Test呼ぶ側の関数の例外:
    @pytest.mark.parametrize("role", CALLS)
    def test_StopIteration_も_別の例外に化けずに伝わり_呼んだ並びは変わらない(
        self, role: str
    ) -> None:
        """進める処理と後の処理の行は、a が役目を終えたあとに止める。

        呼んだ並びから a を外す作りだと、止めたあとの並びが変わる。鍵を求める関数と
        選ぶ関数を生成式の中で呼ぶ作りだと、StopIteration が RuntimeError に置き換わる。
        """
        items = ["a", "b"]
        with pytest.raises(StopIteration, match="止める"):
            CALLS[role](items)
        assert items == ["a", "b"]


class Test型検査が止めるもの:
    """下の行に付けた ``type: ignore`` は、mypy が型エラーを出すから要る。

    エラーが出なくなると、mypy --strict は使われていない ``type: ignore`` として
    失敗する。
    """

    def test_番が整数でない鍵は_型検査が止める(self) -> None:
        """TypeScript は実行時に RangeError で止める。Python は実行時には止めない。"""

        def half(item: str, index: int) -> tuple[float, int]:
            return 0.5, index

        kept = advance_in_phases(["a"], half, keeps, ignore)  # type: ignore[arg-type]
        assert kept == ["a"]

    def test_後の処理に値を返す関数を渡すと_型検査が止める(self) -> None:
        """返した値は使わないので、起きたことの列を返す後の処理を渡すと、列が黙って消える。

        TypeScript の void を返す関数の型は、値を返す関数も受け付ける。
        """

        def settle(item: str) -> list[str]:
            return [f"{item}:起きたこと"]

        kept = advance_in_phases(["a"], by_index, keeps, settle)  # type: ignore[arg-type]
        assert kept == ["a"]
