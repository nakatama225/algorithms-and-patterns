"""外から来た値の読み取りで、JSON の文字列を読み込む関数のテスト。

項目を1つ取り出す関数は ``test_strict_read.py`` が見る。文字列の読み方（Python の
``json`` が黙って読むものをどう断るか）は、項目の型の約束とは別の理由で変わるので、
ファイルを分けた。
"""

import math

import pytest

from algorithms_and_patterns.lib.strict_read import (
    ReadError,
    load_json_object,
    read_float,
    read_int,
)

from .error_head import starts


def test_外側のオブジェクトを返す() -> None:
    assert load_json_object('{"count": 1, "names": ["a"]}') == {
        "count": 1,
        "names": ["a"],
    }


class Test断る数:
    @pytest.mark.parametrize(
        ("text", "head"),
        [
            ('{"x": NaN}', "JSON として読めない: JSON に無い数: NaN"),
            ('{"x": Infinity}', "JSON として読めない: JSON に無い数: Infinity"),
            ('{"x": -Infinity}', "JSON として読めない: JSON に無い数: -Infinity"),
            ('{"x": 1e400}', "JSON として読めない: 小数の範囲を超える数: 1e400"),
            ('{"x": -1e400}', "JSON として読めない: 小数の範囲を超える数: -1e400"),
            # 読まない項目の奥にあっても、読み込む所で止める。
            ('{"x": [1, {"y": 1E400}]}', "JSON として読めない: 小数の範囲を超える数"),
        ],
    )
    def test_NaNと無限大と_無限大になる数は止まる(self, text: str, head: str) -> None:
        """Python の json は、どれも黙って数として読む（1e400 は無限大になる）。"""
        with pytest.raises(ReadError, match=starts(head)):
            load_json_object(text)

    @pytest.mark.parametrize(
        ("text", "expected"), [('{"x": 1e300}', 1e300), ('{"x": 1e-400}', 0.0)]
    )
    def test_小数の範囲に収まる指数の数は読める(
        self, text: str, expected: float
    ) -> None:
        """上の表が「指数の数をどれも止める」だけで通ってしまわないための対照。"""
        assert read_float(load_json_object(text), "x") == expected


@pytest.mark.parametrize(("key", "raw"), [("a", "1.0"), ("b", "1000.0")])
def test_小数点や指数で書いた数は_整数の項目では止まる(key: str, raw: str) -> None:
    """Python の json は小数として読む。

    TypeScript 版は、JSON.parse が返す値（1 と 1000）では整数と見分けられないので、
    読む。
    """
    obj = load_json_object('{"a": 1.0, "b": 1e3}')
    with pytest.raises(ReadError, match=starts(f"{key} が整数でない: {raw}")):
        read_int(obj, key, minimum=0, maximum=1000)


class Test外側:
    @pytest.mark.parametrize(
        ("text", "head"),
        [
            ("[1]", "JSON の外側がオブジェクトでない: list"),
            ("1", "JSON の外側がオブジェクトでない: 1"),
            ('"a"', "JSON の外側がオブジェクトでない: 'a'"),
            ("null", "JSON の外側がオブジェクトでない: None"),
            ("true", "JSON の外側がオブジェクトでない: True"),
        ],
    )
    def test_外側がオブジェクトでなければ止まる(self, text: str, head: str) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            load_json_object(text)

    @pytest.mark.parametrize("text", ["", "{", "{'a': 1}", '{"a": 1,}', '{"a": 1} x'])
    def test_JSONとして読めない文字列は止まる(self, text: str) -> None:
        with pytest.raises(ReadError, match=starts("JSON として読めない")):
            load_json_object(text)


class Test標準のjsonが別の例外を出すもの:
    def test_入れ子が深すぎる文字列も_ReadErrorで止まる(self) -> None:
        """json は RecursionError を出す。

        どの深さで止まるかは版で違う（1000 段の入れ子を、3.11 は読めず、3.14 は
        読めた）。
        """
        depth = 100_000
        with pytest.raises(ReadError, match=starts("JSON として読めない")):
            load_json_object('{"x": ' + "[" * depth + "]" * depth + "}")

    def test_4300桁を超える整数も_ReadErrorで止まる(self) -> None:
        """int() の桁の上限で ValueError になる。ReadError の外へ出さない。"""
        with pytest.raises(ReadError, match=starts("JSON として読めない")):
            load_json_object('{"x": ' + "1" * 4301 + "}")

    def test_4300桁までの整数は読み込み_項目を読むときに範囲で止まる(self) -> None:
        obj = load_json_object('{"x": ' + "1" * 4300 + "}")
        with pytest.raises(ReadError, match=starts("x が 0 以上 10 以下でない")):
            read_int(obj, "x", minimum=0, maximum=10)


class Test見ないもの:
    def test_同じ項目名が2度あると_後の値を読む(self) -> None:
        """断らない。TypeScript 版の JSON.parse も後の値を使い、見つける手段が無い。"""
        assert (
            read_int(load_json_object('{"a": 1, "a": 2}'), "a", minimum=0, maximum=9)
            == 2
        )

    def test_負の0は_整数の項目では0_小数の項目では符号を失う(self) -> None:
        """Python の json は ``-0`` を整数の 0 として読む。

        TypeScript 版は -0 として読み、整数の項目では 0 にそろえ、小数の項目では -0 の
        まま返す。``-0.0`` と書けば、Python も -0.0 として読む。
        """
        obj = load_json_object('{"n": -0, "x": -0, "y": -0.0}')
        assert read_int(obj, "n", minimum=-1, maximum=1) == 0
        assert math.copysign(1, read_float(obj, "x")) == 1
        assert math.copysign(1, read_float(obj, "y")) == -1

    def test_protoという名前の項目も_ただの項目として読む(self) -> None:
        """TypeScript 版にも同じテストがある。JSON.parse も自分の項目として作る。"""
        obj = load_json_object('{"__proto__": 1}')
        assert read_int(obj, "__proto__", minimum=0, maximum=1) == 1
