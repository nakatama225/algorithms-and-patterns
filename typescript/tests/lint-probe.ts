import { ESLint } from 'eslint';
import tseslint from 'typescript-eslint';

/**
 * 静的検査（ESLint）の設定が意図した所で働いていることを確認するテストの、共通の補助。
 * lint-rules.test.ts と lint-lib-rules.test.ts が使う。テストの補助で、src には対応しない。
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
 * 2つのテストで確認する層の規則・決定性の規則・method-signature-style・注釈の扱い（reportUnusedDisableDirectives）は、
 * eslint.config.js に書いたものをそのまま読む。
 * 型の情報を要する規則（switch-exhaustiveness-check）は、この設定では働かない。型の情報を使う設定の
 * まま、実在するファイルのパスに文字列を渡して見る（中身はディスクから読まず、渡した文字列を検査する）。
 */

/**
 * typescript/ の場所。ESLint はここから設定を探す。
 * 型の設定に Node.js の型を入れていないので、Node.js が持つ import.meta.dirname を型に書き足して読む。
 */
const ROOT = `${(import.meta as ImportMeta & { readonly dirname: string }).dirname}/..`;

/** 設定をそのまま読む ESLint。どのパスにどの規則が当たるかを尋ねる。 */
export const configReader = new ESLint({ cwd: ROOT });
/** 文字列を検査する ESLint。型の情報を使わず、型の情報を要する規則を外す。 */
const textLinter = new ESLint({ cwd: ROOT, overrideConfig: tseslint.configs.disableTypeChecked });

/** `filePath` に当たる `rule` の設定。当たらなければ undefined。 */
export async function ruleAt(filePath: string, rule: string): Promise<unknown> {
  const config = (await configReader.calculateConfigForFile(filePath)) as {
    readonly rules?: Readonly<Record<string, unknown>>;
  };
  return config.rules?.[rule];
}

/** `source` を `filePath` に置いたとして検査し、指摘を返す。 */
export async function lint(source: string, filePath: string): Promise<ESLint.LintResult['messages']> {
  const [result] = await textLinter.lintText(source, { filePath });
  if (result === undefined) throw new Error(`検査の結果が無い: ${filePath}`);
  return result.messages;
}

/** 指摘のうち、`rule` によるものの行番号。 */
export function linesOf(messages: ESLint.LintResult['messages'], rule: string): number[] {
  return messages.filter((message) => message.ruleId === rule).map((message) => message.line);
}
