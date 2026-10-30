"""外から来た値の読み取りのテストが使う、止めた文の頭の比べ方。

テストの補助で、``src`` には対応しない。
"""

import re


def starts(head: str) -> str:
    """止めた文が ``head`` で始まることを表す、``pytest.raises`` の ``match``。

    ``match`` は文のどこかに合えば通る（``re.search``）ので、頭に ``^`` を付ける。
    ``head`` の中の ``[`` などは、正規表現の記号として読まないよう、文字のまま比べる。
    """
    return "^" + re.escape(head)
