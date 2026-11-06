import type { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';
import { linesOf, lint, ruleAt } from './lint-probe.js';

/**
 * src/lib/ だけに当てる静的検査（ESLint）の規則（層の向きと決定性）が、意図した所で働いていることの確認。
 *
 * lib/ に部品を足すたびに lib/ のファイルの一覧が伸びるので、リポジトリ全体の書き方の規則
 * （lint-rules.test.ts）から分けた。規則の当たる範囲と止める書き方の見方は、lint-probe.ts の説明にある。
 */

describe('層の向き：lib/ は patterns/ と problems/ を読み込まない', () => {
  const RULE = 'no-restricted-imports';

  it('src/lib の下のファイルには、下のフォルダの中まで規則が当たる', async () => {
    // 初めの15個は lib/ に置いたファイルのパス。範囲の書き方を誤って、どのファイルにも当たらなく
    // なったときに失敗する。設定から規則が当たるかを見るだけで、ファイルが在るかは見ない（ファイルを
    // 消しても、lib/ に足したファイルを一覧に足し忘れても、ここでは失敗しない）。
    for (const path of [
      'src/lib/bisect.ts',
      'src/lib/rng.ts',
      'src/lib/state-hash.ts',
      'src/lib/fixed-step.ts',
      'src/lib/grid.ts',
      'src/lib/cascade.ts',
      'src/lib/strict-read.ts',
      'src/lib/decimal-text.ts',
      'src/lib/sampling.ts',
      'src/lib/ring.ts',
      'src/lib/percentile.ts',
      'src/lib/line-break.ts',
      'src/lib/geo.ts',
      'src/lib/mbr.ts',
      'src/lib/safe-integer.ts',
      'src/lib/__probe__.ts',
      'src/lib/sub/__probe__.ts',
    ]) {
      expect(await ruleAt(path, RULE), path).toEqual([2, expect.anything()]);
    }
  });

  it('src/lib の外には規則が当たらない', async () => {
    // patterns/ が lib/ を使うのはよい向き。テストも対象にしない。
    for (const path of ['src/patterns/command.ts', 'tests/lib/bisect.test.ts']) {
      expect(await ruleAt(path, RULE), path).toBeUndefined();
    }
  });

  it.each([
    ['値の import', "import { CommandLog } from '../patterns/command.js';"],
    ['型だけの import', "import type { CommandSource } from '../patterns/command.js';"],
    ['export … from', "export { CommandLog } from '../patterns/command.js';"],
    ['export * from', "export * from '../patterns/command.js';"],
    ['フォルダそのもの', "import * as patterns from '../patterns';"],
    ['problems/ の import', "import '../problems/example.js';"],
  ])('src/lib の下で上の層を読むと止める：%s', async (_kind, line) => {
    expect(linesOf(await lint(`${line}\n`, 'src/lib/__probe__.ts'), RULE)).toEqual([1]);
  });

  it('src/lib の下のフォルダからでも止める', async () => {
    const line = "import { CommandLog } from '../../patterns/command.js';\n";
    expect(linesOf(await lint(line, 'src/lib/sub/__probe__.ts'), RULE)).toEqual([1]);
  });

  it('同じ行を patterns/ に置くと止めず、lib/ の中どうしの import も止めない', async () => {
    // 上の確認が「どこに置いても止める」だけで通ってしまわないための対照。
    const upward = "import { CommandLog } from '../patterns/command.js';\n";
    expect(linesOf(await lint(upward, 'src/patterns/__probe__.ts'), RULE)).toEqual([]);
    const sibling = "import { bisectRight } from './bisect.js';\n";
    expect(linesOf(await lint(sibling, 'src/lib/__probe__.ts'), RULE)).toEqual([]);
    // 名前の一部に patterns を含むだけのものは、上の層ではない。
    // 読み込み先の区切り（前の / と後ろの / か末尾）を見ないと、ここで誤って止める。
    for (const near of [
      "import { a } from './string-patterns/kmp.js';\n",
      "import { a } from './patterns-util.js';\n",
    ]) {
      expect(linesOf(await lint(near, 'src/lib/__probe__.ts'), RULE), near).toEqual([]);
    }
  });
});

describe('決定性：lib/ では乱数・時刻・for...in を止める', () => {
  const RULES = ['no-restricted-properties', 'no-restricted-syntax'];

  /** 指摘のうち、決定性の規則によるものの行番号と強さ（2 はエラー）。 */
  function found(messages: ESLint.LintResult['messages']): [number, number][] {
    return messages
      .filter((message) => message.ruleId !== null && RULES.includes(message.ruleId))
      .map((message) => [message.line, message.severity]);
  }

  it('src/lib の下のファイルには、下のフォルダの中まで規則が当たる', async () => {
    // 初めの15個は lib/ に置いたファイルのパス（上と同じく、ファイルが在るかは見ない）。
    for (const path of [
      'src/lib/bisect.ts',
      'src/lib/rng.ts',
      'src/lib/state-hash.ts',
      'src/lib/fixed-step.ts',
      'src/lib/grid.ts',
      'src/lib/cascade.ts',
      'src/lib/strict-read.ts',
      'src/lib/decimal-text.ts',
      'src/lib/sampling.ts',
      'src/lib/ring.ts',
      'src/lib/percentile.ts',
      'src/lib/line-break.ts',
      'src/lib/geo.ts',
      'src/lib/mbr.ts',
      'src/lib/safe-integer.ts',
      'src/lib/__probe__.ts',
      'src/lib/sub/__probe__.ts',
    ]) {
      for (const rule of RULES) {
        // 止めるものが2つずつで、強さはエラー。
        expect(await ruleAt(path, rule), `${path} ${rule}`).toEqual([
          2,
          expect.anything(),
          expect.anything(),
        ]);
      }
    }
  });

  it('src/lib の外には規則が当たらない', async () => {
    for (const path of ['src/patterns/command.ts', 'tests/lib/rng.test.ts']) {
      for (const rule of RULES) {
        expect(await ruleAt(path, rule), `${path} ${rule}`).toBeUndefined();
      }
    }
  });

  // 止める書き方。どれも src/lib の下に置くと1行目で止まり、src/patterns の下では止まらない。
  const BANNED = [
    ['Math.random', 'export const value = Math.random();'],
    ['分割代入した Math.random', 'export const { random } = Math;'],
    ['Date.now', 'export const value = Date.now();'],
    ['new Date', 'export const value = new Date();'],
    ['時刻を渡した new Date', 'export const value = new Date(0);'],
    ['new を付けない Date()', 'export const value = Date();'],
    [
      'for...in',
      'export function keys(o: object): string[] { const k: string[] = []; for (const key in o) k.push(key); return k; }',
    ],
  ];

  it.each(BANNED)('src/lib の下では止める：%s', async (_kind, line) => {
    expect(found(await lint(`${line}\n`, 'src/lib/__probe__.ts'))).toEqual([[1, 2]]);
  });

  it('src/lib の下のフォルダからでも止める', async () => {
    const line = 'export const value = Math.random();\n';
    expect(found(await lint(line, 'src/lib/sub/__probe__.ts'))).toEqual([[1, 2]]);
  });

  it.each(BANNED)('同じ行を src/patterns に置くと止めない：%s', async (_kind, line) => {
    // 上の確認が「どこに置いても止める」だけで通ってしまわないための対照。
    expect(found(await lint(`${line}\n`, 'src/patterns/__probe__.ts'))).toEqual([]);
  });

  it.each([
    ['Math のほかの関数', 'export const value = Math.floor(1.5);'],
    ['名前が random の、ほかの物のメソッド', 'export const draw = (rng: { readonly random: () => number }) => rng.random();'],
    ['時刻を読まない Date の関数', 'export const value = Date.UTC(2020, 0, 1);'],
    ['for...of', 'export function sum(xs: number[]): number { let s = 0; for (const x of xs) s += x; return s; }'],
    ['Map', 'export const table = new Map<string, number>();'],
  ])('src/lib の下でも、止める書き方でないものは止めない：%s', async (_kind, line) => {
    expect(found(await lint(`${line}\n`, 'src/lib/__probe__.ts'))).toEqual([]);
  });
});
