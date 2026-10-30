"""取りうる状態を閉じた union で表す型（State）の、Python での書き方の見本と検査。

``src/`` に対応するモジュールは無い。TypeScript 版が自分で書いている部品
（扱い忘れを型検査に見つけさせる ``assertNever``）は、Python では標準ライブラリの
``typing.assert_never``（3.11 以降）がそのまま使え、分岐は ``match`` 文で書ける。
置く部品が無いので、書き方と、それで何が守られるかを、ここに検査として残す。

書き方は3つ。

1. 状態ごとに frozen dataclass を1つ作り、その状態でだけ意味を持つ値をそこにだけ持たせる
2. 状態の型は、それらの union（``Idle | Connecting | Closed``）にする
3. 分岐は ``match`` で書き、最後の ``case _:`` で ``assert_never`` を呼ぶ。
   扱っていない状態が残っていれば、mypy が ``assert_never`` を呼ぶ行で止める

種類ごとの性質を1つの関数にまとめ、共通の処理が性質だけを見る使い方は
``test_state_traits.py`` が見る。変わる理由が違うので、ファイルを分けた。
"""

from dataclasses import FrozenInstanceError, dataclass, replace
from typing import assert_never, cast

import pytest


@dataclass(frozen=True)
class Idle:
    """待機中。中身を持たない。"""


@dataclass(frozen=True)
class Connecting:
    """つなごうとしている。"""

    attempt: int
    """何回目の試行か。つなごうとしている間だけ意味を持つ。"""


@dataclass(frozen=True)
class Closed:
    """切れた。"""

    reason: str
    """切れた理由。切れたあとだけ意味を持つ。"""


Connection = Idle | Connecting | Closed


def label(state: Connection) -> str:
    """すべての状態を扱う分岐。状態を足すと、``assert_never`` の行で mypy が止める。"""
    match state:
        case Idle():
            return "待機中"
        case Connecting(attempt=attempt):
            # 見分けるのと、その状態の値を取り出すのを、1行で書ける。
            return f"接続中（{attempt} 回目）"
        case Closed(reason=reason):
            return f"切断（{reason}）"
        case _:
            assert_never(state)


def test_すべての状態を扱った分岐は_状態ごとの値を使って答える() -> None:
    assert label(Idle()) == "待機中"
    assert label(Connecting(attempt=2)) == "接続中（2 回目）"
    assert label(Closed(reason="時間切れ")) == "切断（時間切れ）"


def test_状態を1つ扱い忘れると_型検査が止める() -> None:
    """この型の目的そのもの。

    ``Closed`` の分岐を書き忘れると、``case _:`` に届く型が ``Closed`` のまま残り、
    ``assert_never`` を呼ぶ行で mypy が止める。下の ``type: ignore`` はそのために要る。
    止まらなくなると、mypy --strict は使われていない ``type: ignore`` として落とす。
    """

    def forgetful(state: Connection) -> str:
        match state:
            case Idle():
                return "待機中"
            case Connecting():
                return "接続中"
            case _:
                assert_never(state)  # type: ignore[arg-type]

    assert forgetful(Idle()) == "待機中"


def test_値を返さないmatchの書き忘れも_型検査が止める() -> None:
    """``case _:`` を書かない ``match`` には、``assert_never`` を呼ぶ行が無い。

    値を返す関数なら、mypy は「値を返さずに抜ける道がある」として止める。値を返さない
    関数では止める所が無く、strict でも通り、扱っていない状態は黙って何もせずに通る。
    そこで ``pyproject.toml`` で ``exhaustive-match`` を有効にしている。mypy は
    ``match`` の行で止めるので、下の ``type: ignore`` はそのために要る。設定から外すと、
    使われていない ``type: ignore`` として mypy --strict が失敗する。
    """
    seen: list[str] = []

    def record(state: Connection) -> None:
        match state:  # type: ignore[exhaustive-match]
            case Idle():
                seen.append("待機中")
            case Connecting(attempt=attempt):
                seen.append(f"接続中（{attempt} 回目）")

    record(Idle())
    record(Closed(reason="時間切れ"))
    assert seen == ["待機中"]


def test_型をすり抜けた値が届いたら_止まる() -> None:
    """外から読み込んだ値など、型の上では届かないはずの状態が実行時に来た場合。

    黙って何もしないと、知らない状態のまま処理が進む。
    """

    @dataclass(frozen=True)
    class Reconnecting:
        attempt: int

    with pytest.raises(AssertionError, match="Reconnecting"):
        label(cast(Connection, Reconnecting(attempt=1)))


def test_値は書き換えられない_差し替えるときは新しい値を作る() -> None:
    """frozen dataclass は、書き換えを実行時に止める。mypy も同じ行を止める。

    書き換えられると、同じ値を持っている別の場所の状態まで変わる。
    """
    before = Connecting(attempt=1)
    with pytest.raises(FrozenInstanceError):
        before.attempt = 2  # type: ignore[misc]
    after = replace(before, attempt=3)
    assert (before.attempt, after.attempt) == (1, 3)


def test_中身を持たない状態は_別に作っても同じ状態とみなす() -> None:
    """dataclass の ``==`` は項目ごとに比べるので、項目が無ければ常に等しい。

    状態を比べるときに、同じ値を使い回しているかどうかを気にしなくてよい。
    """
    assert Idle() == Idle()
    assert Connecting(attempt=1) != Connecting(attempt=2)
