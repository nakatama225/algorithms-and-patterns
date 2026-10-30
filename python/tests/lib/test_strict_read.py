"""外から来た値の読み取りで、項目を1つ取り出す関数のテスト。

JSON の文字列の読み込みは ``test_strict_read_json.py``、閉じた種類への読み替えは
``test_strict_read_enum.py`` が見る。項目の型と範囲の約束は、文字列の読み方とも、
種類の決め方とも別の理由で変わるので、ファイルを分けた。

止まったことに加えて、止めた文の頭（どの項目か、なぜか）まで比べる。止まったことだけを
見ると、別の検査が先に止めても通ってしまう。
"""

import math
from collections.abc import Callable

import pytest

from algorithms_and_patterns.lib.strict_read import (
    JsonObject,
    ReadError,
    read_float,
    read_int,
    read_list,
    read_object,
    read_str,
)

from .error_head import starts


def count_0_to_10(obj: JsonObject, key: str) -> int:
    """0 以上 10 以下の整数として読む。"""
    return read_int(obj, key, minimum=0, maximum=10)


READERS: list[Callable[[JsonObject, str], object]] = [
    count_0_to_10,
    read_float,
    read_str,
    lambda obj, key: read_list(obj, key, read_str),
    read_object,
]


class Test項目が無い:
    @pytest.mark.parametrize("read", READERS)
    def test_無い項目は_どの読み取りでも止まる(
        self, read: Callable[[JsonObject, str], object]
    ) -> None:
        """既定値で埋めると、読んだ側だけ違う値で先へ進む。"""
        with pytest.raises(ReadError, match=starts("count が無い")):
            read({"size": 1}, "count")

    @pytest.mark.parametrize("key", ["toString", "__proto__", "constructor"])
    def test_オブジェクトが持つ名前も_項目に無ければ無い(self, key: str) -> None:
        """TypeScript 版にも同じ表がある。JavaScript では ``'toString' in {}`` が真。"""
        with pytest.raises(ReadError, match=starts(f"{key} が無い")):
            read_object({}, key)

    def test_値がnullの項目は_無いのでなく型が違う(self) -> None:
        """JSON の ``null`` は書いてある値。無い項目と同じ文だと、見分けられない。"""
        with pytest.raises(ReadError, match=starts("count が整数でない: None")):
            count_0_to_10({"count": None}, "count")


class Test整数:
    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            # bool は int の仲間で、True == 1。
            (True, "count が整数でない: True"),
            (False, "count が整数でない: False"),
            # JSON の 1.0 は float になる。整数の項目に小数を書くのは、書く側の誤り。
            (1.0, "count が整数でない: 1.0"),
            ("1", "count が整数でない: '1'"),
            ([1], "count が整数でない: list"),
            ({"value": 1}, "count が整数でない: dict"),
            (11, "count が 0 以上 10 以下でない: 11"),
            (-1, "count が 0 以上 10 以下でない: -1"),
            (2**64, "count が 0 以上 10 以下でない: 18446744073709551616"),
        ],
    )
    def test_整数でない値と範囲の外は止まる(self, raw: object, head: str) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            count_0_to_10({"count": raw}, "count")

    @pytest.mark.parametrize("raw", [0, 10, 5])
    def test_最小と最大そのものは読める(self, raw: int) -> None:
        """上の表が「どの値も止める」だけで通ってしまわないための対照。"""
        assert count_0_to_10({"count": raw}, "count") == raw

    def test_範囲が1つの値だけでも読める(self) -> None:
        assert read_int({"count": -3}, "count", minimum=-3, maximum=-3) == -3

    def test_最小が最大より大きい範囲は_ReadErrorでなくValueErrorで止まる(self) -> None:
        """呼ぶ側の誤りなので、ReadError にしない。

        ReadError にすると、受け取った側が外から来た値の誤りとして断って続け、どの値も
        断り続ける。ReadError も ValueError の子なので、型まで比べる。
        """
        with pytest.raises(
            ValueError, match=starts("範囲の最小は最大以下にする: 10 > 0")
        ) as caught:
            read_int({"count": 5}, "count", minimum=10, maximum=0)
        assert type(caught.value) is ValueError


class Test小数:
    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            (True, "ratio が数でない: True"),
            ("1.5", "ratio が数でない: '1.5'"),
            (None, "ratio が数でない: None"),
            (math.nan, "ratio が有限の数でない: nan"),
            (math.inf, "ratio が有限の数でない: inf"),
            (-math.inf, "ratio が有限の数でない: -inf"),
            # float にする所で OverflowError になる整数。
            (10**400, "ratio が有限の数でない: 小数の範囲を超える整数"),
        ],
    )
    def test_数でない値とNaNと無限大は止まる(self, raw: object, head: str) -> None:
        """``load_json_object`` を通さずに作ったものには、NaN と無限大もありうる。"""
        with pytest.raises(ReadError, match=starts(head)):
            read_float({"ratio": raw}, "ratio")

    @pytest.mark.parametrize(
        ("raw", "expected"), [(1.5, 1.5), (2, 2.0), (-0.0, -0.0), (10**300, 1e300)]
    )
    def test_整数で書いた数も_floatとして読む(
        self, raw: object, expected: float
    ) -> None:
        """JSON は整数と小数を書き分けないので、書く側が 2.0 を 2 と書くことがある。"""
        value = read_float({"ratio": raw}, "ratio")
        assert type(value) is float
        assert value == expected
        assert math.copysign(1, value) == math.copysign(1, expected)


class Test文字列:
    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            (1, "name が文字列でない: 1"),
            (None, "name が文字列でない: None"),
            (["a"], "name が文字列でない: list"),
        ],
    )
    def test_文字列でない値は止まる(self, raw: object, head: str) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            read_str({"name": raw}, "name")

    def test_空の文字列も読む(self) -> None:
        assert read_str({"name": ""}, "name") == ""


class Test配列:
    def test_要素を1つずつ読み_止めた文は要素の位置で始まる(self) -> None:
        """どの要素が合わないのかが文から分かる。"""
        with pytest.raises(ReadError, match=starts("names[1] が文字列でない: 2")):
            read_list({"names": ["a", 2, "c"]}, "names", read_str)

    def test_範囲を決めた整数の要素も読める(self) -> None:
        obj: JsonObject = {"sizes": [0, 10]}
        assert read_list(obj, "sizes", count_0_to_10) == [0, 10]
        with pytest.raises(ReadError, match=starts("sizes[2] が 0 以上 10 以下でない")):
            read_list({"sizes": [0, 10, 11]}, "sizes", count_0_to_10)

    def test_オブジェクトの要素は_読んだオブジェクトから項目を読む(self) -> None:
        rows = read_list({"rows": [{"size": 1}, {"size": 2}]}, "rows", read_object)
        assert [count_0_to_10(row, "size") for row in rows] == [1, 2]

    def test_空の配列は空のlist(self) -> None:
        assert read_list({"names": []}, "names", read_str) == []

    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            # str も並びの仲間（Sequence）なので、並びかどうかで見ると通ってしまう。
            ("ab", "names が配列でない: 'ab'"),
            ({"0": "a"}, "names が配列でない: dict"),
            (None, "names が配列でない: None"),
        ],
    )
    def test_配列でなければ止まる(self, raw: object, head: str) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            read_list({"names": raw}, "names", read_str)


class Testオブジェクト:
    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            ([], "config がオブジェクトでない: list"),
            (None, "config がオブジェクトでない: None"),
            ("{}", "config がオブジェクトでない: '{}'"),
        ],
    )
    def test_オブジェクトでなければ止まる(self, raw: object, head: str) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            read_object({"config": raw}, "config")

    def test_中の項目も同じ関数で読む(self) -> None:
        config = read_object({"config": {"size": 3}}, "config")
        assert count_0_to_10(config, "size") == 3
        with pytest.raises(ReadError, match=starts("count が無い")):
            count_0_to_10(config, "count")


def test_余分な項目があっても_読む項目は読める() -> None:
    """書く側が項目を足しても、読む側が知っている項目は読める。"""
    obj: JsonObject = {"count": 3, "added_later": [1, 2], "note": None}
    assert count_0_to_10(obj, "count") == 3
