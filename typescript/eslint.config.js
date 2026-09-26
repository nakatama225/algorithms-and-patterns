import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/**
 * 型検査で止められない書き方を、こちらで止める。
 *
 * 型の情報を使う規則の組（recommendedTypeChecked）を使っている。たとえば、
 * 型の分からない値（any）をそのまま渡し回すことや、待っていない Promise を止める。
 * 型の情報を得るために、検査するファイルはすべて tsconfig.json の include に入っている
 * 必要がある。入っていないファイルは、そのファイルで止まる。
 */
export default tseslint.config(
  { ignores: ['node_modules/**', 'coverage/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,

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
    },
  },

  {
    // この設定ファイル自体は JavaScript なので、型の情報を使う規則を外す。
    files: ['**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
);
