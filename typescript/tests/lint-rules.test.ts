import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';

/**
 * 静的検査（ESLint）の設定が、意図した所で働いていることの確認。
 *
 * 設定を書いただけでは、働いているかは分からない。規則を当てる範囲を書き誤っても、
 * 違反が無ければ lint は緑のまま通る。そこで次の2つを見る。
 *
 * 1. どのパスに規則が当たるか（`calculateConfigForFile`。ディスクに無いパスでも答える）
 * 2. 違反を1行含む文字列を、ファイルの名前つきで ESLint に渡すと、規則が止めるか（`lintText`）
 *
 * ディスクには書き出さず、子プロセスも使わない。書き出した違反は本物の src に混ざり、
 * ほかの検査と並べて実行できなくなる。
 *
 * 文字列を渡すときは、型の情報を使わない設定に替える。型の情報を使う設定のままだと、
 * ディスクに無いパスは tsconfig.json のどこにも属さないとして、規則を当てる前に止まる。
 * 替えるのは、型の情報を使わないことと、型の情報を要する規則を外すことだけ。
 * ここで確認する層の規則・決定性の規則・method-signature-style・注釈の扱い（reportUnusedDisableDirectives）は、
 * eslint.config.js に書いたものをそのまま読む。
 */

/**
 * typescript/ の場所。ESLint はここから設定を探す。
 * 型の設定に Node.js の型を入れていないので、Node.js が持つ import.meta.dirname を型に書き足して読む。
 */
const ROOT = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/..`;

/** 設定をそのまま読む ESLint。どのパスにどの規則が当たるかを尋ねる。 */
const configReader = new ESLint({ cwd: ROOT });
/** 文字列を検査する ESLint。型の情報を使わず、型の情報を要する規則を外す。 */
const textLinter = new ESLint({ cwd: ROOT, overrideConfig: tseslint.configs.disableTypeChecked });

/** `filePath` に当たる `rule` の設定。当たらなければ undefined。 */
async function ruleAt(filePath: string, rule: string): Promise<unknown> {
  const config = (await configReader.calculateConfigForFile(filePath)) as {
    readonly rules?: Readonly<Record<string, unknown>>;
  };
  return config.rules?.[rule];
}

/** `source` を `filePath` に置いたとして検査し、指摘を返す。 */
async function lint(source: string, filePath: string): Promise<ESLint.LintResult['messages']> {
  const [result] = await textLinter.lintText(source, { filePath });
  if (result === undefined) throw new Error(`検査の結果が無い: ${filePath}`);
  return result.messages;
}

/** 指摘のうち、`rule` によるものの行番号。 */
function linesOf(messages: ESLint.LintResult['messages'], rule: string): number[] {
  return messages.filter((message) => message.ruleId === rule).map((message) => message.line);
}

describe('層の向き：lib/ は patterns/ と problems/ を読み込まない', () => {
  const RULE = 'no-restricted-imports';

  it('src/lib の下のファイルには、下のフォルダの中まで規則が当たる', async () => {
    // 初めの8つは実在するファイル。範囲の書き方を誤って、どのファイルにも当たらなくなったときに失敗する。
    for (const path of [
      'src/lib/bisect.ts',
      'src/lib/rng.ts',
      'src/lib/state-hash.ts',
      'src/lib/fixed-step.ts',
      'src/lib/grid.ts',
      'src/lib/cascade.ts',
      'src/lib/strict-read.ts',
      'src/lib/decimal-text.ts',
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
    // 初めの8つは実在するファイル。
    for (const path of [
      'src/lib/bisect.ts',
      'src/lib/rng.ts',
      'src/lib/state-hash.ts',
      'src/lib/fixed-step.ts',
      'src/lib/grid.ts',
      'src/lib/cascade.ts',
      'src/lib/strict-read.ts',
      'src/lib/decimal-text.ts',
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

describe('interface の関数の形', () => {
  it('src の下でメソッドの形の interface を書くと、エラーとして止める', async () => {
    // 下の MethodShaped の注釈で分かるのは、規則が外れたことだけ。強さを warn に下げても、
    // 範囲を tests/ に狭めても、注釈は使われたままで lint は通る。強さと範囲はここで見る。
    const source = 'export interface Probe {\n  run(value: number): number;\n}\n';
    for (const path of ['src/patterns/__probe__.ts', 'src/lib/__probe__.ts']) {
      const found = (await lint(source, path))
        .filter((message) => message.ruleId === '@typescript-eslint/method-signature-style')
        .map((message) => [message.line, message.severity]);
      expect(found, path).toEqual([[2, 2]]);
    }
  });
});

describe('規則を外す注釈', () => {
  it('何も外していない注釈は、警告でなくエラーとして止める', async () => {
    // 警告だと eslint . は成功で終わる。下の MethodShaped の注釈が使われなくなったときに、
    // lint が失敗しなくなる。MethodShaped は tests/ に置いてあるので、tests/ の下でも見る。
    const source = '// eslint-disable-next-line no-console\nexport const value = 1;\n';
    for (const path of ['src/lib/__probe__.ts', 'tests/__probe__.ts']) {
      const messages = await lint(source, path);
      expect(messages, path).toEqual([
        expect.objectContaining({ ruleId: null, severity: 2, line: 1 }),
      ]);
      expect(messages[0]?.message, path).toContain('no-console');
    }
  });
});

/**
 * メソッドの形で書いた型。method-signature-style が働いていることを、lint そのもので確認する。
 *
 * 規則が働いていれば、下の注釈がその指摘を外す。規則が外れると、注釈が何も外さなくなり、
 * npm run lint がこの行で失敗する（上のテストで確認した設定による）。
 * 規則の強さと当たる範囲は、注釈では分からないので「interface の関数の形」のテストで見る。
 * 使っていない型として止められないよう、export している。
 */
export interface MethodShaped {
  // eslint-disable-next-line @typescript-eslint/method-signature-style -- 規則が働いていることの確認
  run(value: number): number;
}
