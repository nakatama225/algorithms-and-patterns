"""答え方を名前で引ける登録表（Strategy）の検査。"""

from typing import Protocol

import pytest

from algorithms_and_patterns.patterns.strategy import Registry


class Formatter(Protocol):
    """確かめるための答え方。文字列の整形の仕方を差し替える。

    ``__call__`` だけを持つ Protocol なので、ただの関数がそのまま答え方になる。
    引数を位置専用（``/``）にしてあるのは、mypy が引数の名前まで照らし合わせるため。
    ``/`` が無いと、引数の名前が ``text`` でない関数は渡せない。
    """

    def __call__(self, text: str, /) -> str: ...


def upper(text: str) -> str:
    return text.upper()


def lower(text: str) -> str:
    return text.lower()


def test_何も登録していなければ_名前の一覧は空で_引くと止まる() -> None:
    formatters: Registry[Formatter] = Registry("整形の方法")
    assert formatters.keys() == ()
    assert "upper" not in formatters
    with pytest.raises(KeyError, match="整形の方法「upper」は登録されていない"):
        formatters.get("upper")


def test_登録した答え方を_名前で引いて使える() -> None:
    formatters: Registry[Formatter] = Registry("整形の方法")
    formatters.add("upper", upper)
    assert "upper" in formatters
    assert formatters.get("upper")("abc") == "ABC"


def test_名前の一覧は_登録した順に並ぶ() -> None:
    """画面に選択肢として並べるときなど、順番に意味を持たせられるようにする。"""
    # 名前の並べ替えと区別がつくよう、アルファベット順と逆に登録する。
    formatters: Registry[Formatter] = Registry("整形の方法")
    formatters.add("upper", upper)
    formatters.add("lower", lower)
    assert formatters.keys() == ("upper", "lower")


def test_同じ名前で2度登録すると止まり_先に登録したものが残る() -> None:
    """上書きを許すと、2つの答え方に同じ名前を付けた書き間違いに気づけない。"""
    formatters: Registry[Formatter] = Registry("整形の方法")
    formatters.add("upper", upper)
    with pytest.raises(ValueError, match="整形の方法「upper」はすでに登録されている"):
        formatters.add("upper", lower)
    assert formatters.get("upper")("Abc") == "ABC"


def test_大文字と小文字が違えば_別の名前として扱う() -> None:
    """名前を黙って揃えない。揃えるなら、使う側が揃えてから引く。"""
    formatters: Registry[Formatter] = Registry("整形の方法")
    formatters.add("upper", upper)
    formatters.add("Upper", lower)
    assert formatters.keys() == ("upper", "Upper")
    with pytest.raises(KeyError):
        formatters.get("UPPER")


def test_答え方が_0_や空文字や_None_でも_登録されていれば引ける() -> None:
    """値が偽とみなされるかどうかで「登録されていない」と判断すると、ここで止まる。"""
    weights: Registry[int] = Registry("重み")
    weights.add("none", 0)
    labels: Registry[str | None] = Registry("見出し")
    labels.add("blank", "")
    labels.add("missing", None)
    assert weights.get("none") == 0
    assert labels.get("blank") == ""
    assert labels.get("missing") is None
    assert ["none" in weights, "blank" in labels, "missing" in labels] == [True] * 3


def test_引数の名前が違う関数も_答え方として渡せる() -> None:
    """``Formatter`` の引数を位置専用にしてあるので、名前を揃えなくてよい。

    ``/`` を外すと、この行で mypy が止まる。
    """

    def exclaim(s: str) -> str:
        return s + "!"

    formatters: Registry[Formatter] = Registry("整形の方法")
    formatters.add("exclaim", exclaim)
    assert formatters.get("exclaim")("hi") == "hi!"


def test_登録表ごとに_中身は分かれている() -> None:
    """1つの大域の表を共有する作りだと、片方への登録がもう片方に見える。"""
    a: Registry[Formatter] = Registry("整形の方法")
    b: Registry[Formatter] = Registry("整形の方法")
    a.add("upper", upper)
    assert "upper" not in b
    b.add("upper", lower)
    assert a.get("upper")("Abc") == "ABC"


class TestRegisterDecorator:
    def test_関数に付けると_その名前で登録される(self) -> None:
        formatters: Registry[Formatter] = Registry("整形の方法")

        @formatters.register("shout")
        def shout(text: str) -> str:
            return text.upper() + "!"

        assert formatters.get("shout")("hi") == "HI!"

    def test_登録したものを_そのまま返す(self) -> None:
        """デコレータが別のものを返すと、付けた関数を直接呼べなくなる。"""
        formatters: Registry[Formatter] = Registry("整形の方法")

        def whisper(text: str) -> str:
            return text.lower() + "..."

        assert formatters.register("whisper")(whisper) is whisper
        assert formatters.get("whisper") is whisper

    def test_クラスに付けると_クラスそのものが登録される(self) -> None:
        """答え方が状態を持つなら、クラスを登録して、使う側で作る。"""

        class Counter(Protocol):
            def count(self, text: str) -> int: ...

        counters: Registry[type[Counter]] = Registry("数え方")

        @counters.register("chars")
        class CountChars:
            def count(self, text: str) -> int:
                return len(text)

        assert counters.get("chars") is CountChars
        assert counters.get("chars")().count("abc") == 3

    def test_同じ名前を2度付けると止まり_先に登録したものが残る(self) -> None:
        formatters: Registry[Formatter] = Registry("整形の方法")
        formatters.register("upper")(upper)
        with pytest.raises(ValueError):
            formatters.register("upper")(lower)
        assert formatters.get("upper") is upper

    def test_デコレータを先に2つ作ってから付けても_2つ目で止まる(self) -> None:
        """名前の重なりを、デコレータを作った時点でしか確かめない作りだと、
        作ってから付けるまでの間に同じ名前が登録されても気づけない。
        """
        formatters: Registry[Formatter] = Registry("整形の方法")
        first = formatters.register("upper")
        second = formatters.register("upper")
        first(upper)
        with pytest.raises(ValueError):
            second(lower)
        assert formatters.get("upper") is upper
