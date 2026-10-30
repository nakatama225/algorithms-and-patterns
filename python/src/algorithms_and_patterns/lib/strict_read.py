"""外から来た値の読み取り — JSON の項目を、型と範囲を見ながら取り出す。

通信で届いた文字列や保存した文字列のように、外から来た値を読む。合わない値は、既定値で
埋めたり読み飛ばしたりせず、``ReadError`` で止める。読み飛ばすと、足りない項目を待った
まま止まり、原因が別の所（通信が遅いなど）に見える。既定値で埋めると、同じ値から
作るはずの結果が、読んだ側だけ違うものになる。

- ``load_json_object``：JSON の文字列を読み、外側がオブジェクトであることを見る
- ``read_int``・``read_float``・``read_str``・``read_list``・``read_object``：項目を
  1つ、型（と整数は範囲）を見ながら取り出す。項目が無いときも止める
- ``read_enum``：文字列の項目を、閉じた種類（``Enum``）の値に読み替える

余分な項目は読み飛ばす。止めるときの文は、どの項目かで始める（``count が無い``）。

10 進の整数を書いた文字列の読み取り（``parse_decimal``）は ``decimal_text.py`` に置く。
読んだ値は型と範囲を見て返すだけで（値を変えるのは、``read_float`` が整数を float に
することだけ）、固定値の表は持たず、約束は「同じ入力から、起動のたびに同じ結果を
出す」だけ（README の「決定性を崩す書き方の検査」）。TypeScript 版
（``typescript/src/lib/strict-read.ts``）も同じ形。
"""

import json
import math
from collections.abc import Callable, Mapping
from enum import Enum
from typing import TypeVar

T = TypeVar("T")
E = TypeVar("E", bound=Enum)

JsonObject = Mapping[str, object]
"""JSON のオブジェクトを読んだもの。項目の名前と、型をまだ見ていない値。"""


class ReadError(ValueError):
    """外から来た値が、読む側の約束に合わない。文は、どの項目かで始める。"""


def load_json_object(text: str) -> JsonObject:
    """JSON の文字列を読み、外側のオブジェクトを返す。

    Python の ``json`` は、JSON に無い ``NaN``・``Infinity``・``-Infinity`` を数として
    読み、``1e400`` のように小数の範囲を超える数を無限大として読む。どれも断る。

    Raises:
        ReadError: JSON として読めないとき、断る数があるとき、外側がオブジェクトで
            ないとき。入れ子が深すぎて読めないとき（``RecursionError``）と、
            4300 桁を超える整数（``int()`` の桁の上限）も、ReadError にする。
    """
    try:
        data = json.loads(
            text, parse_constant=_reject_constant, parse_float=_finite_float
        )
    except (ValueError, RecursionError) as exc:
        raise ReadError(f"JSON として読めない: {exc}") from exc
    if not isinstance(data, dict):
        raise ReadError(f"JSON の外側がオブジェクトでない: {_show(data)}")
    return data


def _reject_constant(name: str) -> float:
    """``NaN``・``Infinity``・``-Infinity`` を読んだときに呼ばれ、断る。"""
    raise ValueError(f"JSON に無い数: {name}")


def _finite_float(text: str) -> float:
    """小数点か指数を持つ数を読む。小数の範囲を超えて無限大になる数を断る。"""
    value = float(text)
    if not math.isfinite(value):
        raise ValueError(f"小数の範囲を超える数: {text}")
    return value


def read_int(obj: JsonObject, key: str, *, minimum: int, maximum: int) -> int:
    """整数の項目を、``minimum`` 以上 ``maximum`` 以下で読む。

    上限も必ず渡す。読む時点で上限を置かないと、受けた値を使う先（32 ビットの数を
    前提にした計算など）で、別の例外として止まる。

    Raises:
        ReadError: 項目が無いとき、整数でないとき（``True``・``False`` と、``1.0`` の
            ような小数を含む）、範囲の外のとき。
        ValueError: ``minimum`` が ``maximum`` より大きいとき。呼ぶ側の誤りなので、
            ``ReadError`` にしない（外から来た値の誤りとして断って続けると、どの値も
            断り続ける）。
    """
    if minimum > maximum:
        raise ValueError(f"範囲の最小は最大以下にする: {minimum} > {maximum}")
    raw = _field(obj, key)
    # bool は int の仲間（True == 1）なので、先に断る。JSON の 1.0 は float になる。
    if isinstance(raw, bool) or not isinstance(raw, int):
        raise ReadError(f"{key} が整数でない: {_show(raw)}")
    if raw < minimum or raw > maximum:
        raise ReadError(f"{key} が {minimum} 以上 {maximum} 以下でない: {raw}")
    return raw


def read_float(obj: JsonObject, key: str) -> float:
    """数の項目を、有限の float として読む。整数で書かれた数も受ける。

    JSON は整数と小数を書き分けないので（書く側が 2.0 を 2 と書くことがある）、
    整数も float にして返す。

    Raises:
        ReadError: 項目が無いとき、数でないとき（``True``・``False`` を含む）、
            NaN か無限大のとき、float の範囲を超える整数のとき。
    """
    raw = _field(obj, key)
    if isinstance(raw, bool) or not isinstance(raw, int | float):
        raise ReadError(f"{key} が数でない: {_show(raw)}")
    try:
        value = float(raw)
    except OverflowError as exc:
        # 桁の多い整数は、float にする所で止まる（math.isfinite に渡しても同じ）。
        raise ReadError(f"{key} が有限の数でない: 小数の範囲を超える整数") from exc
    if not math.isfinite(value):
        raise ReadError(f"{key} が有限の数でない: {_show(raw)}")
    return value


def read_str(obj: JsonObject, key: str) -> str:
    """文字列の項目を読む。

    Raises:
        ReadError: 項目が無いとき、文字列でないとき。
    """
    raw = _field(obj, key)
    if not isinstance(raw, str):
        raise ReadError(f"{key} が文字列でない: {_show(raw)}")
    return raw


def read_list(
    obj: JsonObject, key: str, item: Callable[[JsonObject, str], T]
) -> list[T]:
    """配列の項目を読み、要素を1つずつ ``item`` で読む。

    ``item`` には、この部品の読み取りの関数（``read_str`` や、範囲を決めた
    ``read_int``）を渡す。要素は ``{"names[0]": 要素}`` のような1項目のオブジェクトに
    入れて渡すので、止めるときの文は ``names[0]`` で始まる。型を見ていない要素を
    そのまま返すと、使う側が要素を読む所で、同じ検査をもう一度書く。

    Raises:
        ReadError: 項目が無いとき、配列でないとき、``item`` が要素を断ったとき。
    """
    raw = _field(obj, key)
    if not isinstance(raw, list):
        raise ReadError(f"{key} が配列でない: {_show(raw)}")
    result: list[T] = []
    for index, element in enumerate(raw):
        label = f"{key}[{index}]"
        result.append(item({label: element}, label))
    return result


def read_object(obj: JsonObject, key: str) -> JsonObject:
    """オブジェクトの項目を読む。中の項目は、返したものからこの部品で読む。

    Raises:
        ReadError: 項目が無いとき、オブジェクトでないとき（配列と ``null`` を含む）。
    """
    raw = _field(obj, key)
    if not isinstance(raw, Mapping):
        raise ReadError(f"{key} がオブジェクトでない: {_show(raw)}")
    return raw


def read_enum(obj: JsonObject, key: str, kind: type[E]) -> E:
    """文字列の項目を、値（``value``）が等しい ``kind`` のメンバーに読み替える。

    閉じた種類への読み替えは、外から来た所で1度だけ行う。知らない値を既定の種類に
    倒さずに止める。止めたときの ``__cause__`` に、``kind`` が出した元の例外が残る。

    読むのは文字列だけ。整数を値に持つ種類（``IntEnum``・``IntFlag``）は、この関数
    ではどの値も読めずに止まる。``IntFlag`` は ``boundary=STRICT`` でも、負の整数を
    補数として受け（2つの値を持つ種類で -1 は両方を立てた値）、既定の ``boundary``
    は決めていないビットも受ける。``IntEnum`` は ``True`` と ``1.0`` を 1 の値として
    受ける。ビットの組を外から読むときは、``read_int`` で 0 以上と上限を見てから作る。

    ``kind`` を ``Enum`` の仲間に限っても、``IntFlag`` は ``Enum`` の仲間なので、
    型検査は止めない。止めるのは実行時で、文字列でない値は ``read_str`` が断り、
    文字列からは整数を値に持つ種類の値を作れない。止める文は、候補の値も断った値と
    同じく ``repr`` で並べるので、文字列の ``'1'`` と整数の ``1`` を見分けられる。

    Raises:
        ReadError: 項目が無いとき、文字列でないとき、``kind`` に無い値のとき。
    """
    raw = read_str(obj, key)
    try:
        return kind(raw)
    except ValueError as exc:
        known = "・".join(repr(member.value) for member in kind)
        raise ReadError(f"{key} が知らない値: {raw!r}（{known} のどれか）") from exc


def _field(obj: JsonObject, key: str) -> object:
    """項目の値。無ければ止める。"""
    if key not in obj:
        raise ReadError(f"{key} が無い")
    return obj[key]


def _show(raw: object) -> str:
    """止めるときの文に入れる、値の書き表し。

    数・文字列・真偽値・``None`` は ``repr`` で、配列とオブジェクトは型の名前だけを書く
    （大きいものを文に入れない）。
    """
    if raw is None or isinstance(raw, bool | int | float | str):
        return repr(raw)
    return type(raw).__name__
