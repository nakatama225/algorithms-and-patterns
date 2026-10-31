"""mypy の設定の検査。テストの ``type: ignore[...]`` が働く設定のままか。

テストのいくつかは、型検査が止める書き方を置き、その行に ``type: ignore[...]``
を付けている（``tests/patterns/test_state.py`` など）。型検査がその行を止めなく
なると、注釈が使われなくなり、mypy は使われていない注釈として失敗する。これは
strict に含まれる ``warn_unused_ignores`` による。strict を外すか、
``warn_unused_ignores = false`` を書くか、使われていない注釈の指摘
（``unused-ignore``）を ``disable_error_code`` で切ると、注釈が使われなくなっても
mypy は通り、型検査が止めなくなったことに気づけない（AGENTS.md の、規則を外す
注釈の項目）。

そこで ``pyproject.toml`` を標準ライブラリの ``tomllib``（3.11 から）で読み、
設定を見る。mypy は ``mypy.ini`` か ``.mypy.ini`` があると、``pyproject.toml``
より先にそちらを読むので、その2つが無いことも見る。
"""

import tomllib
from pathlib import Path
from typing import Any

import pytest

ROOT = Path(__file__).resolve().parents[1]


def mypy_settings(text: str) -> dict[str, Any]:
    """``pyproject.toml`` の文字列から、``[tool.mypy]`` の表を返す。無ければ空の表。"""
    settings: dict[str, Any] = tomllib.loads(text).get("tool", {}).get("mypy", {})
    return settings


def _keeps_unused_ignore_error(table: dict[str, Any]) -> bool:
    """1つの表（全体か、モジュールごとの上書き）が、使われていない注釈の指摘を残すか。"""
    disabled = table.get("disable_error_code", [])
    return table.get("warn_unused_ignores", True) is True and (
        "unused-ignore" not in disabled
    )


def reports_unused_ignores(settings: dict[str, Any]) -> bool:
    """使われていない ``type: ignore`` を、mypy が失敗として出す設定か。

    strict が真で、全体の設定とモジュールごとの上書き（``[[tool.mypy.overrides]]``）の
    どれも、``warn_unused_ignores`` を偽にせず、``unused-ignore`` を切っていないとき。
    """
    overrides: list[dict[str, Any]] = settings.get("overrides", [])
    return (
        settings.get("strict") is True
        and _keeps_unused_ignore_error(settings)
        and all(_keeps_unused_ignore_error(override) for override in overrides)
    )


def test_いまの設定は_使われていない注釈を失敗にする() -> None:
    text = (ROOT / "pyproject.toml").read_text(encoding="utf-8")
    assert reports_unused_ignores(mypy_settings(text))


STRICT = "[tool.mypy]\nstrict = true\n"
OVERRIDE = "[[tool.mypy.overrides]]\nmodule = 'tests.*'\n"


@pytest.mark.parametrize(
    "text",
    [
        "[tool.mypy]\nstrict = false\n",
        "[tool.mypy]\nfiles = ['src']\n",
        "[tool.other]\nstrict = true\n",
        STRICT + "warn_unused_ignores = false\n",
        STRICT + "disable_error_code = ['unused-ignore']\n",
        STRICT + OVERRIDE + "warn_unused_ignores = false\n",
        STRICT + OVERRIDE + "disable_error_code = ['unused-ignore']\n",
    ],
)
def test_注釈の指摘を切る設定は_見分ける(text: str) -> None:
    """上の確認が、どんな設定でも真を返すだけで通ってしまわないための対照。

    どの形も、同じ Mac の mypy で、使われていない注釈を置いたファイルが通った。
    """
    assert not reports_unused_ignores(mypy_settings(text))


def test_strictと明記した指摘は_切っていないとみなす() -> None:
    text = (
        STRICT
        + "warn_unused_ignores = true\nenable_error_code = ['exhaustive-match']\n"
        + OVERRIDE
        + "disable_error_code = ['misc']\n"
    )
    assert reports_unused_ignores(mypy_settings(text))


def test_pyprojectより先に読まれる設定のファイルが無い() -> None:
    for name in ["mypy.ini", ".mypy.ini"]:
        assert not (ROOT / name).exists(), name
