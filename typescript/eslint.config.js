import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 型検査で止められない書き方を、こちらで止める。
 *
 * 型の情報を使う規則の組（recommendedTypeChecked）を使っている。たとえば、
 * 型の分からない値（any）をそのまま渡し回すことや、待っていない Promise を止める。
 * 型の情報を得るために、検査するファイルはすべて tsconfig.json の include に入っている
 * 必要がある。入っていないファイルは、そのファイルで止まる。
 *
 * ここに書いた規則が意図した所で働いていることは、tests/lint-rules.test.ts で確認している。
 */
export default tseslint.config(
  { ignores: ['node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

  {
    // 規則を外す注釈（eslint-disable）が何も外していなければ、エラーにする。
    // ESLint の既定は警告（warn）で、eslint . は警告だけなら成功で終わるので、
    // 規則が働かなくなって注釈が使われなくなっても気づけない。
    // このリポジトリでは、規則を外す注釈を付けた違反を置き、規則が外れていないことを
    // lint そのもので確認している（tests/lint-rules.test.ts の MethodShaped と、
    // tests/patterns/state.test.ts の書き忘れた switch）。
    // 規則の強さと当たる範囲は注釈では分からないので、tests/lint-rules.test.ts のテストで見る。
    // 型検査の @ts-expect-error（使われないと tsc が失敗する）と同じ働きにする。
    // animal-bomber の設定には無く、このリポジトリで足した仕組み。
    linterOptions: { reportUnusedDisableDirectives: 'error' },
  },

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      // 型だけの import を import type と書かせる。実行時に残る依存と、
      // 型の上だけの依存を読み分けられるようにする。
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // interface と型の中の関数は `commandAt: (step, view) => C` の形で書く。
      // メソッドの形（`commandAt(step, view): C`）だと、TypeScript は引数の型の向きを
      // 検査しないので、より多くを知っている状態を前提にした実装を渡しても型エラーに
      // ならない（README の Command）。クラスの中はメソッドの形のままでよい。
      // animal-bomber の設定から持ってきた規則。
      '@typescript-eslint/method-signature-style': ['error', 'property'],
      // switch で閉じた union の種類を書き忘れたら止める（README の State）。
      // 値を返さない関数の switch は、default で assertNever を呼ばない限り、型検査が書き忘れを
      // 見つけない。型の情報を使う規則で、recommendedTypeChecked には含まれていない。
      // 選択肢は typescript-eslint 8.70 の既定と同じ値を書いて、版が替わっても変わらないようにしている。
      // - allowDefaultCaseForExhaustiveSwitch: true … すべての種類を書いたうえで default に
      //   assertNever を置く形（state.ts の約束1）を止めない
      // - considerDefaultExhaustiveForUnions: false … default があっても、書いていない種類が
      //   残っていれば止める。default で残りをまとめて受けると、足した種類も黙ってそこで扱われる
      // - requireDefaultForNonUnion: false … union でない値（number など）の switch に default を求めない
      // 規則の強さと当たる範囲と、選択肢どおりに止めることは tests/lint-rules.test.ts で、規則が
      // 外れていないことは tests/patterns/state.test.ts の注釈でも見る。animal-bomber の設定には無く、
      // このリポジトリで足した規則。
      '@typescript-eslint/switch-exhaustiveness-check': [
        'error',
        {
          allowDefaultCaseForExhaustiveSwitch: true,
          considerDefaultExhaustiveForUnions: false,
          requireDefaultForNonUnion: false,
        },
      ],
    },
  },

  {
    // lib/ だけに当てる規則。規則が意図した所で働いていることは tests/lint-rules.test.ts で見る。
    //
    // 層の向き：lib/ は patterns/ と problems/ を読み込まない（AGENTS.md）。
    // 共通部品が特定の型や問題を知っている状態にしない。逆の向き（patterns/ から lib/）はよい。
    // import と export … from に書いた読み込み先の文字列だけを見る。import() で読むものは見ない。
    files: ['src/lib/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(^|/)(patterns|problems)(/|$)',
              message: 'lib/ は patterns/ と problems/ を読み込まない（AGENTS.md の層の向き）。',
            },
          ],
        },
      ],
      // 決定性：lib/ の部品は、同じ入力から、起動のたびに同じ結果を出す
      // （README の「決定性を崩す書き方の検査」）。乱数と時刻は引数で受け取る。
      // Math.random と Date は ES2022 の一部で、import しなくても使えるので、ここで止める。
      // performance.now や setTimeout は、tsconfig.json の型（ES2022 だけ）に無いので、
      // 型検査が先に止める。
      'no-restricted-properties': [
        'error',
        {
          object: 'Math',
          property: 'random',
          message: 'lib/ では乱数を引数で受け取る（lib/rng.ts の Rng など）。',
        },
        {
          object: 'Date',
          property: 'now',
          message: 'lib/ では時刻を引数で受け取る。',
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          // `new Date()` は引数が無ければ、`new` を付けない `Date()` は引数を渡しても、いまの時刻になる。
          // 時刻を渡す形（`new Date(0)`）も止める。lib/ では Date を作らない。
          selector: ':matches(NewExpression, CallExpression)[callee.name="Date"]',
          message: 'lib/ では時刻を引数で受け取る。',
        },
        {
          // 仕様が順を実装に任せる場合があり、継承した項目まで並べる。
          selector: 'ForInStatement',
          message:
            'for...in は使わない。順が要る並びは配列、名前と値の組は Map（入れた順を保つ）で持つ。',
        },
      ],
    },
  },

  {
    // この設定ファイル自体は JavaScript なので、型の情報を使う規則を外す。
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
