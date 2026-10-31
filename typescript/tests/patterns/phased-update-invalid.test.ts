import { describe, expect, it } from 'vitest';
import { advanceInPhases, type Order } from '../../src/patterns/phased-update.js';

/*
 * src/patterns/phased-update.ts の二段の更新（advanceInPhases）が止める鍵と、呼ぶ側の関数の例外の伝え方と、
 * 後の処理の型が受け付けるもののテスト。進める順と後の処理の順は phased-update.test.ts が見る。
 * 受け取る値と例外の約束は、順とは別の理由で変わるので、ファイルを分けた。
 */

/** すべてを番 0 に置き、並びの順に進める鍵。 */
const byIndex: Order<unknown> = (_item, index) => [0, index];

/** 何もしない後の処理。 */
const ignore = (): void => {};

/** b で例外を出す。 */
function stopAtB(item: string): void {
  if (item === 'b') throw new Error('止める');
}

describe('呼ぶ側の関数の例外', () => {
  it.each([
    {
      role: '鍵を求める関数',
      call: (items: readonly string[]) =>
        advanceInPhases(
          items,
          (item, index) => {
            stopAtB(item);
            return [0, index];
          },
          () => false,
          ignore,
        ),
    },
    {
      role: '選ぶ関数',
      call: (items: readonly string[]) =>
        advanceInPhases(items, byIndex, () => false, ignore, (item) => {
          stopAtB(item);
          return true;
        }),
    },
    {
      role: '進める処理',
      call: (items: readonly string[]) =>
        advanceInPhases(
          items,
          byIndex,
          (item) => {
            stopAtB(item);
            return true;
          },
          ignore,
        ),
    },
    {
      role: '後の処理',
      call: (items: readonly string[]) => advanceInPhases(items, byIndex, (item) => item === 'a', stopAtB),
    },
  ])('呼ぶ側の関数が出した例外は、そのまま伝わり、呼んだ並びは変わらない：$role', ({ call }) => {
    // 進める処理と後の処理の行は、a が役目を終えたあとに止める。呼んだ並びから a を外す作りだと、
    // 止めたあとの並びが変わる。
    const items = ['a', 'b'];
    expect(() => call(items)).toThrow('止める');
    expect(items).toEqual(['a', 'b']);
  });
});

describe('止める鍵', () => {
  it.each([
    ['番が NaN', [Number.NaN, 0]],
    ['番が小数', [0.5, 0]],
    ['番が無限大', [Number.POSITIVE_INFINITY, 0]],
    ['番の中の順が NaN', [0, Number.NaN]],
    ['番の中の順が小数', [0, -0.5]],
    ['番の中の順が無限大', [0, Number.NEGATIVE_INFINITY]],
  ] as const)('鍵が整数でなければ、何も進める前に RangeError で止める：%s', (_title, key) => {
    // Python は鍵を int の組と型で書き、型検査が止める。TypeScript の number は整数と小数を
    // 区別しないので、実行時に見る。NaN を受け付けると、比べる関数が大小を答えられない。
    const advanced: string[] = [];
    const order: Order<string> = (item, index) => (item === 'b' ? key : [0, index]);
    const advance = (item: string): boolean => {
      advanced.push(item);
      return false;
    };
    expect(() => advanceInPhases(['a', 'b'], order, advance, ignore)).toThrow(RangeError);
    expect(advanced).toEqual([]);
  });

  it('選ばなかったものの鍵は求めないので、整数でない鍵を返す関数でも止めない', () => {
    // 鍵を求める関数は、選んだものにだけ定義されていればよい。
    const order: Order<string> = (item, index) => (item === 'b' ? [0, index] : [Number.NaN, Number.NaN]);
    expect(advanceInPhases(['a', 'b', 'c'], order, () => true, ignore, (item) => item === 'b')).toEqual(['a', 'c']);
  });
});

describe('後の処理の型', () => {
  it('void を返す型は、値を返す関数も受け付け、返した値は捨てる', () => {
    // Python の型検査は、値を返す関数を後の処理に渡すと止める。TypeScript は止めないので、
    // 起きたことの列を返す後の処理をそのまま渡すと、その列が黙って消える。起きたことは呼ぶ側が包んで集める。
    const happened: string[] = [];
    const report = (item: string): string[] => [`${item}:起きたこと`];
    expect(advanceInPhases(['a'], byIndex, () => false, report)).toEqual(['a']);
    advanceInPhases(['a'], byIndex, () => false, (item) => {
      happened.push(...report(item));
    });
    expect(happened).toEqual(['a:起きたこと']);
  });
});
