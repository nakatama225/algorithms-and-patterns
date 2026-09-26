import { defineConfig } from 'vitest/config';

/** テストの設定。部品は実行環境を選ばないので、Node.js の上でそのまま走らせる。 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
