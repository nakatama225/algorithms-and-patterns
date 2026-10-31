"""Strategy — 同じ問いへの答え方を差し替えられるようにし、名前で取り出せるように並べる。

答え方（戦略）を1つずつ値として作り、登録表（``Registry``）に名前をつけて登録する。
使う側は名前で取り出すだけで、どんな答え方があるかを知らない。

答え方を1つ足すときに触るのは、その答え方の定義と、登録の1か所だけ。
使う側にも、既存の答え方にも手を入れない。

交換しているもの：どんな答え方があるかが、型の上に現れない。名前を書き間違えても
型検査は通り、取り出したときに初めて分かる。取りうる種類を型で閉じて（union）、書き忘れを
型検査に見つけさせる形（State。書き方の見本は ``tests/patterns/test_state.py``）とは、
ちょうど逆の性質になる。

登録はデコレータで書ける
------------------------
``@registry.register("名前")`` を答え方の定義に付けると、定義と登録が同じ場所に並ぶ。
関数にもクラスにも付けられる。

デコレータは、そのモジュールが import されたときに走る。どこからも import されない
モジュールに書いた答え方は、登録されない。答え方を別々のモジュールに分けるなら、
登録を集める1か所（パッケージの ``__init__.py`` など）で、それらを並べて import する。
「どのモジュールが読み込まれたか」で登録の有無が変わる作りにしない。
登録表そのものは、その ``__init__.py`` とは別のモジュールに置く。同じ所に置くと、
答え方のモジュールが登録表を import しようとした時点で、登録表がまだ作られておらず止まる
（循環 import）。
"""

from collections.abc import Callable
from typing import Generic, TypeVar

T = TypeVar("T")


class Registry(Generic[T]):
    """名前から答え方を取り出す登録表。

    登録表は値として作る。モジュールに1つだけ置く大域の表にすると、表ごとの中身を
    分けられず、テストの間でも登録が残る。
    """

    def __init__(self, name: str) -> None:
        """空の登録表を作る。

        Args:
            name: 登録するものの呼び名。見つからないときの知らせに使う
                （例：「整形の方法」）。
        """
        self.name = name
        # dict は登録した順を保つ。名前の一覧をその順で返せる。
        self._entries: dict[str, T] = {}

    def add(self, key: str, value: T) -> None:
        """答え方を登録する。

        Raises:
            ValueError: 同じ名前がすでに登録されているとき。上書きを許すと、
                後から登録したものが黙って前のものを消し、どちらが使われるかが
                登録の順で決まる。
        """
        if key in self._entries:
            raise ValueError(f"{self.name}「{key}」はすでに登録されている")
        self._entries[key] = value

    def register(self, key: str) -> Callable[[T], T]:
        """答え方の定義に付けて登録するデコレータを返す。

        登録したものは、そのまま返す。デコレータを付けた関数やクラスは、
        登録表を通さずに直接使うこともできる。

        そのまま返すのは実行時の話。mypy の上では、デコレータを付けた関数は
        登録表の型（``T``）として扱われ、``T`` に無い引数や属性は型の上から
        見えなくなる。
        クラスは、mypy がデコレータの返す型を使わないので、自分の型のまま。
        関数を元の型のまま使いたいなら、デコレータではなく ``add`` で登録する。

        Raises:
            ValueError: 同じ名前がすでに登録されているとき（``add`` と同じ）。
        """

        def decorate(value: T) -> T:
            self.add(key, value)
            return value

        return decorate

    def get(self, key: str) -> T:
        """名前で答え方を取り出す。

        Raises:
            KeyError: 登録されていない名前のとき。既定の答え方に丸めると、
                書き間違いや登録漏れに気づけないまま、違う答え方で動き続ける。
        """
        if key not in self._entries:
            raise KeyError(f"{self.name}「{key}」は登録されていない")
        return self._entries[key]

    def __contains__(self, key: object) -> bool:
        """その名前が登録されているか。``"名前" in registry`` と書ける。"""
        return key in self._entries

    def keys(self) -> tuple[str, ...]:
        """登録されている名前の一覧。登録した順に並ぶ。"""
        return tuple(self._entries)
