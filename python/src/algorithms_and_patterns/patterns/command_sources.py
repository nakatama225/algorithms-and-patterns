"""Command の出どころを組み立てる部品。いくつかを合わせる形と、途中で替える形。

どちらも出どころ（``CommandSource``）を受け取り、それ自身も出どころとして振る舞う。
処理の側から見ると出どころは1つのままなので、処理の側は変わらない。

- 合わせる … ``CombinedSource``。並びの出どころ全部に毎歩聞き、受け取った合わせ方で
  1つの命令にする
- 途中で替える … ``HandoverSource``。替わる歩を決めて持つ記録（``Handover``）を読み、
  決まった歩の次から、代わりの出どころに任せる。代わりは初めて任せる歩で1度だけ作る

記録と再生（``command.py``）とはファイルを分けた。記録と再生の約束と、出どころの
組み立て方は、別の理由で変わる。
"""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from typing import Generic, TypeVar

from algorithms_and_patterns.patterns.command import CommandSource

C = TypeVar("C")
S = TypeVar("S")


@dataclass(frozen=True)
class CombinedSource(Generic[S, C]):
    """いくつかの出どころの命令を、1つに合わせる出どころ。

    毎歩、並びの順に全部の出どころに聞いてから、``combine`` で合わせる。途中で答えが
    決まっても打ち切らない。前の歩を覚えている出どころは、聞かれなかった歩のぶん
    覚えている内容が古くなり、次に聞かれたときにずれる。記録する出どころ
    （``RecordingSource``）なら、その歩の記録が抜ける。

    合わせ方は呼ぶ側が渡す。たとえば真偽の組なら、項目ごとの OR で「どれかの出どころが
    真なら真」にできる。同じ出どころを2度並べると、1歩に2度聞く（重なりを見分けない）。
    """

    sources: tuple[CommandSource[S, C], ...]
    combine: Callable[[Sequence[C]], C]

    def __post_init__(self) -> None:
        """合わせる出どころがあるかを確認する。

        Raises:
            ValueError: 出どころが1つも無いとき。出どころを繋ぎ忘れたまま、空の並びを
                合わせた命令（真偽の組の OR なら、全部が偽）で黙って進めない。
        """
        if not self.sources:
            raise ValueError("合わせる出どころが無い")

    def command_at(self, step: int, view: S) -> C:
        # 生成式のまま合わせ方に渡すと、any のような合わせ方が途中で打ち切り、
        # 残りの出どころに聞かなくなる。全部に聞き終えてから渡す。
        commands = [source.command_at(step, view) for source in self.sources]
        return self.combine(commands)


class Handover:
    """出どころが途中で替わる歩を、1度だけ決めて持つ記録。

    前の出どころを最後に使う歩（``after``）を持ち、その次の歩から「替わった」と答える。
    替わったかの判定（``replaced_at``）はここ1か所にあり、``HandoverSource`` は
    これを読むだけで、替わる歩を自分では持たない。届いた命令で進める側と、保存した
    記録を再生する側に同じ歩を決めた記録を渡せば、どちらも同じ判定で同じ歩に替わる。
    保存するときは、命令の記録と一緒に ``after`` を残す。

    決めるのは1度だけ。2度目を受け付けて上書きすると、先に読んだ側と後で読んだ側で
    替わる歩が食い違いうる。判定は「決めた歩より後か」だけなので、一度替わったら
    元には戻らない。
    """

    def __init__(self) -> None:
        """替わる歩をまだ決めていない記録を作る。"""
        self._after: int | None = None

    @property
    def after(self) -> int | None:
        """前の出どころを最後に使う歩。まだ決めていなければ None。"""
        return self._after

    def hand_over_after(self, step: int) -> None:
        """``step`` 歩目まで前の出どころを使い、次の歩から代わりに任せると決める。

        Args:
            step: 前の出どころを最後に使う歩。-1 なら、0 歩目から代わりに任せる。

        Raises:
            ValueError: ``step`` が -1 より小さいとき、またはもう決めてあるとき
                （同じ歩でも）。断ったときは、決めてある歩を変えない。
        """
        if step < -1:
            raise ValueError(f"前の出どころを最後に使う歩は -1 以上: {step}")
        if self._after is not None:
            raise ValueError(f"替わる歩はもう決めてある: {self._after} 歩目のあと")
        self._after = step

    def replaced_at(self, step: int) -> bool:
        """``step`` 歩目が、代わりの出どころに任せる歩か。

        Raises:
            ValueError: ``step`` が負のとき。負の歩は数え間違いの結果で、替わった・
                替わっていないのどちらで答えても、誤りが黙って先へ進む。
        """
        if step < 0:
            raise ValueError(f"歩の番号は 0 以上: {step}")
        return self._after is not None and step > self._after


class HandoverSource(Generic[S, C]):
    """記録（``Handover``）が決めた歩の次から、代わりの出どころに任せる出どころ。

    替わる歩より前は、前の出どころ（``first``）に聞く。替わる歩からは、代わりの
    出どころに聞く。代わりは、初めて任せる歩で ``make_next`` を呼んで1度だけ作り、
    それより前には作らない。作り直すと、代わりの出どころが覚えている内容（前の歩までの
    判断）を失う。

    処理の側が替わる歩でこの出どころに聞かなければ、代わりを作るのはそれより後の歩に
    なる。作るときに状態を読まない出どころなら、作る歩がずれても同じ命令を返す。

    替わる歩は自分では持たず、毎歩、記録の判定を読む。前の出どころで答えた歩より
    前を替わる歩に決めると、その歩を、同じ記録を再生する側は代わりに任せるので、
    2つの側がずれる。これは、次に替わったあとの歩を聞かれたときに見つけて止める。
    前の出どころが例外を出した歩（届いていない歩を読んだ、など）は、答えた歩に
    数えない。
    """

    def __init__(
        self,
        first: CommandSource[S, C],
        make_next: Callable[[], CommandSource[S, C]],
        handover: Handover,
    ) -> None:
        """前の出どころと、代わりの作り方と、替わる歩の記録を受け取る。

        Args:
            first: 替わる歩より前に任せる出どころ。
            make_next: 代わりの出どころを作る関数。届いた命令で進める側と、記録を
                再生する側に、同じ出どころを作るものを渡す。
            handover: 替わる歩を決めて持つ記録。
        """
        self._first = first
        self._make_next = make_next
        self._handover = handover
        self._next: CommandSource[S, C] | None = None
        # 前の出どころで答えた最後の歩。まだ無ければ -1。
        self._first_used_through = -1

    def command_at(self, step: int, view: S) -> C:
        """``step`` 歩目の命令を、前の出どころか代わりの出どころに聞いて返す。

        Raises:
            ValueError: ``step`` が負のとき（``Handover.replaced_at``）。
            RuntimeError: 前の出どころで答えた歩が、いまの記録では替わったあとの
                歩になっているとき。替わる歩を、答えた歩より前に決めた。
        """
        if not self._handover.replaced_at(step):
            # 命令を受け取ってから数える。前の出どころが例外を出した歩（届いていない
            # 歩を読んだ、など）は答えていないので、そのあとで決めた歩の検査に使わない。
            command = self._first.command_at(step, view)
            self._first_used_through = max(self._first_used_through, step)
            return command
        used = self._first_used_through
        if used >= 0 and self._handover.replaced_at(used):
            raise RuntimeError(
                f"前の出どころで {used} 歩目まで答えたあとで、"
                f"{self._handover.after} 歩目のあとで替わると決まった"
            )
        if self._next is None:
            self._next = self._make_next()
        return self._next.command_at(step, view)
