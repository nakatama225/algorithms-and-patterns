import { describe, expect, it } from 'vitest';
import { configReader, lint, ruleAt } from './lint-probe.js';

/**
 * リポジトリ全体に当てる静的検査（ESLint）の設定が、意図した所で働いていることの確認。
 * interface の関数の形・switch の種類の書き忘れ・規則を外す注釈の扱いを見る。
 *
 * src/lib/ だけに当てる規則（層の向きと決定性）は lint-lib-rules.test.ts に分けた。lib/ に部品を
 * 足すたびに、そちらの実在するファイルの一覧が伸びるため。規則の当たる範囲と止める書き方の見方は、
 * lint-probe.ts の説明にある。
 */

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

describe('switch の種類の書き忘れ', () => {
  const RULE = '@typescript-eslint/switch-exhaustiveness-check';

  it('src と tests の全部に、エラーとして、決めた選択肢で当たる', async () => {
    // 注釈（tests/patterns/state.test.ts）で分かるのは規則が外れたことだけなので、強さと範囲と
    // 選択肢は設定を読んで見る。ディスクに無いパスも尋ねられる。初めの3つは実在するファイル。
    for (const path of [
      'src/patterns/state.ts',
      'src/lib/rng.ts',
      'tests/patterns/state.test.ts',
      'src/patterns/__probe__.ts',
      'tests/__probe__.ts',
    ]) {
      expect(await ruleAt(path, RULE), path).toEqual([
        2,
        {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: false,
        },
      ]);
    }
  });

  /** 種類が2つの union の switch。`case 'a'` の後ろに `rest` を足す。3行目が switch の行。 */
  function switchOn(rest: string): string {
    const head = ["type Kind = 'a' | 'b';", 'export function f(kind: Kind): void {', '  switch (kind) {'];
    return [...head, `    case 'a': break; ${rest}`, '  }', '}', ''].join('\n');
  }

  const CASES: [string, string, [number, number][]][] = [
    ['書き忘れ', '', [[3, 2]]],
    ['書き忘れを default で受ける', 'default: break;', [[3, 2]]],
    ['すべて書く', "case 'b': break;", []],
    ['すべて書いて default も置く', "case 'b': break; default: break;", []],
  ];

  it.each(CASES)('実在するファイルに置いた文字列を、型の情報を使う設定で検査する：%s', async (_kind, rest, expected) => {
    // ディスクに無いパスでは、規則を当てる前に止まる。止まったせいで指摘が0件になる形を見逃さない
    // よう、構文解析の失敗（ruleId が null）も数える。
    for (const path of ['src/patterns/state.ts', 'src/lib/rng.ts', 'tests/patterns/state.test.ts']) {
      const [result] = await configReader.lintText(switchOn(rest), { filePath: path });
      const found = result?.messages
        .filter((message) => message.ruleId === RULE || message.ruleId === null)
        .map((message) => [message.line, message.severity]);
      expect(found, path).toEqual(expected);
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
