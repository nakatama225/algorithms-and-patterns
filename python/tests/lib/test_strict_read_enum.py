"""外から来た値の読み取りで、文字列の項目を閉じた種類に読み替える関数のテスト。

項目を1つ取り出す関数は ``test_strict_read.py`` が見る。種類の決め方（どの値を受けるか、
整数を値に持つ種類をどう扱うか）は、項目の型の約束とは別の理由で変わるので、ファイルを
分けた。
"""

from enum import STRICT, Enum, IntEnum, IntFlag, StrEnum

import pytest

from algorithms_and_patterns.lib.strict_read import ReadError, read_enum, read_int

from .error_head import starts


class Shape(Enum):
    """文字列を値に持つ、ふつうの Enum。"""

    CIRCLE = "circle"
    SQUARE = "square"


class Unit(StrEnum):
    METER = "m"
    SECOND = "s"


class Access(IntFlag, boundary=STRICT):
    """決めていないビットを含む値から作ると ValueError になる、ビットの組。"""

    READ = 1
    WRITE = 2


class Level(IntEnum):
    LOW = 1
    HIGH = 2


class Test読み替え:
    def test_値で読み替える(self) -> None:
        assert read_enum({"shape": "square"}, "shape", Shape) is Shape.SQUARE
        assert read_enum({"unit": "s"}, "unit", Unit) is Unit.SECOND

    def test_知らない値は止まり_元の例外がcauseに残る(self) -> None:
        """既定の種類に倒すと、書く側が種類を足したことに気づけない。"""
        with pytest.raises(
            ReadError,
            match=starts(
                "shape が知らない値: 'triangle'（'circle'・'square' のどれか）"
            ),
        ) as caught:
            read_enum({"shape": "triangle"}, "shape", Shape)
        assert type(caught.value.__cause__) is ValueError

    @pytest.mark.parametrize("raw", ["CIRCLE", "Circle", " circle", ""])
    def test_名前や前後の空白では読まない(self, raw: str) -> None:
        """値（``value``）とだけ比べる。名前（``CIRCLE``）は値でない。"""
        with pytest.raises(ReadError, match=starts("shape が知らない値")):
            read_enum({"shape": raw}, "shape", Shape)

    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            (True, "shape が文字列でない: True"),
            (1, "shape が文字列でない: 1"),
            (1.0, "shape が文字列でない: 1.0"),
            (None, "shape が文字列でない: None"),
        ],
    )
    def test_文字列でない値は_種類に渡す前に止まる(
        self, raw: object, head: str
    ) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            read_enum({"shape": raw}, "shape", Shape)

    def test_項目が無ければ止まる(self) -> None:
        with pytest.raises(ReadError, match=starts("shape が無い")):
            read_enum({}, "shape", Shape)


class Test整数を値に持つ種類:
    def test_前提_STRICTのIntFlagでも_負の整数は補数として作れる(self) -> None:
        """この関数が整数を読まない理由。

        ``boundary=STRICT`` は、決めていないビットを含む 0 以上の整数（4）を断るが、
        負の整数は補数として受ける。-1 は両方のビットを立てた値、-4 は何も立てていない
        値になる。標準ライブラリの版が変わってこの振る舞いが無くなったら、ここで分かる。
        """
        assert Access(-1) == Access.READ | Access.WRITE
        assert Access(-2) == Access.WRITE
        assert Access(-4) == Access(0)
        for bits in (4, -5):
            with pytest.raises(ValueError):
                Access(bits)

    def test_前提_IntEnumは_Trueと小数の1も_1の値として受ける(self) -> None:
        """整数を種類に渡す形にすると、bool と小数の検査も要る。"""
        assert Level(True) is Level.LOW
        # 型検査は float を渡すのを止めるが、json.loads が返す値は Any なので止めない。
        assert Level(1.0) is Level.LOW  # type: ignore[arg-type]

    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            (-1, "access が文字列でない: -1"),
            (3, "access が文字列でない: 3"),
            ("3", "access が知らない値: '3'"),
            ("-1", "access が知らない値: '-1'"),
        ],
    )
    def test_IntFlagを渡しても_負の整数から値を作らない(
        self, raw: object, head: str
    ) -> None:
        """型検査は止めない（IntFlag も Enum の仲間）。文字列しか読まないので止まる。"""
        with pytest.raises(ReadError, match=starts(head)):
            read_enum({"access": raw}, "access", Access)

    @pytest.mark.parametrize(
        ("raw", "head"),
        [
            (True, "level が文字列でない: True"),
            (1.0, "level が文字列でない: 1.0"),
            (1, "level が文字列でない: 1"),
            # 候補も repr で並べるので、断った文字列の '1' と、候補の整数の 1 を
            # 見分けられる。
            ("1", "level が知らない値: '1'（1・2 のどれか）"),
        ],
    )
    def test_IntEnumを渡しても_真偽値や小数から値を作らない(
        self, raw: object, head: str
    ) -> None:
        with pytest.raises(ReadError, match=starts(head)):
            read_enum({"level": raw}, "level", Level)

    @pytest.mark.parametrize(
        ("raw", "expected"), [(0, Access(0)), (3, Access.READ | Access.WRITE)]
    )
    def test_ビットの組は_0以上と上限を見た整数から作る(
        self, raw: int, expected: Access
    ) -> None:
        bits = read_int({"access": raw}, "access", minimum=0, maximum=3)
        assert Access(bits) == expected

    @pytest.mark.parametrize("raw", [-1, -4, 4])
    def test_ビットの組の負の整数と上限の外は_作る前に止まる(self, raw: int) -> None:
        """下限の 0 を渡し忘れると、-1 が両方のビットを立てた値になる。"""
        with pytest.raises(ReadError, match=starts("access が 0 以上 3 以下でない")):
            read_int({"access": raw}, "access", minimum=0, maximum=3)
