"""Command — 「何をするか」を、実行する処理から切り離して値として渡す。

1歩ずつ進む処理が、歩ごとに「この歩では何をするか」を命令の出どころ
（``CommandSource``）に尋ねる。処理の側は、出どころの正体を知らない。
人の操作・自動の判断・記録の再生・通信で届いた命令が、同じ資格で並ぶ。

命令が値なので、記録と再生は部品を1つ挟むだけで作れる。

- 記録する … 出どころを ``RecordingSource`` で包む。
  包まれた側は、記録されていることを知らない
- 再生する … 出どころを ``ReplaySource`` に差し替える。
  処理の側は1行も変わらない

⚠️ 再生して同じ結果になるのは、次の2つが守られているときだけ。

1. 出どころは状態を読むだけで、書き換えない。命令を返す前に状態が変わると、
   記録した命令を流し直しても同じ状態にならない
2. 処理の側は、同じ状態と同じ命令から必ず同じ次の状態を作る。
   内側で乱数や時刻を引くと、記録に残らない入力が混ざる
"""

from bisect import bisect_right
from dataclasses import dataclass
from typing import Generic, NamedTuple, Protocol, TypeVar

C = TypeVar("C")
S = TypeVar("S")
# Protocol の型引数は、使われる向きを宣言する必要がある。状態は引数として
# 受け取るだけ（反変）、命令は返すだけ（共変）。宣言しないと mypy が定義そのものを拒む。
# TypeScript は使われ方から向きを推し量るので宣言は要らないが、メソッドの形で書いた
# 引数は向きを検査しない。そのため TypeScript 版は、関数を持つ項目の形で書いている。
S_contra = TypeVar("S_contra", contravariant=True)
C_co = TypeVar("C_co", covariant=True)


class CommandSource(Protocol[S_contra, C_co]):
    """1歩ごとに命令を返すもの。"""

    def command_at(self, step: int, view: S_contra) -> C_co:
        """``step`` 歩目に実行する命令を返す。

        Args:
            step: 何歩目か。処理の側が 0 から数えて渡す。
                状態の中に持っている時刻で代用しない。状態を作り直すと
                時刻が 0 に戻る作りだと、同じ番号が2度渡され、記録がそこで
                例外になって止まる。
            view: いまの状態。読むだけで、書き換えない。
        """
        ...


class CommandChange(NamedTuple, Generic[C]):
    """記録の1件。``step`` 歩目から、命令が ``command`` に変わった。"""

    step: int
    command: C


class CommandLog(Generic[C]):
    """命令の記録。命令が変わった歩だけを持つ。

    同じ命令が続く間は何も足さない。ある歩の命令は「その歩か、それより前で
    最後に変わったときの命令」として引く。押しっぱなしの操作のように、
    変わる回数が歩の数よりずっと少ない命令では、記録が小さくなる。

    命令が同じかは ``==`` で比べる。比べ方は命令のクラスの側が決める
    （``__eq__``）。dataclass は項目ごとに比べる ``__eq__`` を作るので、中身が同じなら
    別に作ったものでも同じ命令になる。``__eq__`` を持たない普通のクラスは
    「同じものか」で比べるので、記録が小さくならない。
    """

    def __init__(self, idle: C) -> None:
        """空の記録を作る。

        Args:
            idle: 最初に命令が変わるより前の歩に返す、何もしない命令。
        """
        self._idle = idle
        # 変わった歩（昇順）と、そのときの命令。同じ位置どうしが対になる。
        self._steps: list[int] = []
        self._commands: list[C] = []
        # 最後に記録を受け付けた歩。まだ無ければ -1。
        self._last_step = -1

    @property
    def last_step(self) -> int:
        """最後に記録を受け付けた歩。まだ無ければ -1。

        命令が変わらず記録を増やさなかった歩も含む。記録より長く再生すると
        最後の命令が続くので、``entries()`` と一緒に保存しておくと、
        何歩ぶん再生すればよいかが分かる。
        """
        return self._last_step

    def record(self, step: int, command: C) -> None:
        """``step`` 歩目の命令を記録する。直前と同じ命令なら何も足さない。

        Raises:
            ValueError: ``step`` が負のとき、または前回の記録より進んでいないとき。
                同じ歩を2度記録すると、どちらが正しいのかが記録から分からなくなる。
        """
        _check_step(step)
        if step <= self._last_step:
            raise ValueError(
                f"歩が進んでいない: {self._last_step} 歩目のあとに {step} 歩目"
            )
        self._last_step = step
        if command == self._latest():
            return
        self._steps.append(step)
        self._commands.append(command)

    def at(self, step: int) -> C:
        """``step`` 歩目の命令を返す。最初に変わるより前なら、何もしない命令を返す。

        Raises:
            ValueError: ``step`` が負のとき。
        """
        _check_step(step)
        index = bisect_right(self._steps, step) - 1
        return self._idle if index < 0 else self._commands[index]

    def entries(self) -> tuple[CommandChange[C], ...]:
        """変わった歩と命令の一覧。

        返した並びを書き換えても、記録は変わらない。中の命令そのものは記録と共有して
        いるので、命令を書き換えられるオブジェクトで表すなら、書き換えないこと。
        """
        return tuple(
            CommandChange(step, command)
            for step, command in zip(self._steps, self._commands, strict=True)
        )

    def _latest(self) -> C:
        """いま有効な命令。まだ何も変わっていなければ、何もしない命令。"""
        return self._commands[-1] if self._commands else self._idle


@dataclass(frozen=True)
class ReplaySource(Generic[C]):
    """記録した命令を流す出どころ。

    状態を見ずに、歩の番号だけで命令を決める。だから、記録したときと同じ状態から
    始めれば、同じ命令が同じ順に流れる。状態の型を ``object`` で受けるので、
    どの状態を扱う処理にも差し込める。
    """

    log: CommandLog[C]

    def command_at(self, step: int, view: object) -> C:
        return self.log.at(step)


@dataclass(frozen=True)
class RecordingSource(Generic[S, C]):
    """流れた命令を記録しながら、包んだ出どころの命令をそのまま返す。

    包まれる側は、記録されていることを知らない。記録の有無で振る舞いを変える
    分岐が、どの出どころにも要らない。
    """

    inner: CommandSource[S, C]
    log: CommandLog[C]

    def command_at(self, step: int, view: S) -> C:
        command = self.inner.command_at(step, view)
        self.log.record(step, command)
        return command


def _check_step(step: int) -> None:
    """歩の番号が 0 以上かを確かめる。

    整数かどうかは型検査に任せる。TypeScript 版は number が整数と小数を区別しないので、
    実行時に整数かどうかも確かめている。
    """
    if step < 0:
        raise ValueError(f"歩の番号は 0 以上: {step}")
