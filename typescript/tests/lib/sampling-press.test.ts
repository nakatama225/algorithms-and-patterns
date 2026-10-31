import { describe, expect, it } from 'vitest';
import { EdgeDetector, PressLatch } from '../../src/lib/sampling.js';

/*
 * src/lib/sampling.ts のうち、押す・離すを扱う2つのテスト。
 * 押し始め（EdgeDetector）と短い押しの取りこぼし防止（PressLatch）を見る。
 * 揺れる値を分ける2つは sampling.test.ts が見る。
 */

describe('押し始め', () => {
  it('押し始めた回だけ返す', () => {
    const edges = new EdgeDetector<string>([]);
    const held = [['a'], ['a'], ['a', 'b'], ['b'], [], ['a']];
    expect(held.map((keys) => [...edges.update(keys)])).toEqual([['a'], [], ['b'], [], [], ['a']]);
  });

  it.each([
    ['押していた鍵を渡す', ['a'], []],
    ['対照：何も押していない組で始めると押し始めに見える', [], ['a']],
  ])('始まりの前から押していた鍵は、押し始めにならない：%s', (_kind, heldAtStart, expected) => {
    // 何も押していない組で始めると、押したまま始まった鍵を押したことにしてしまう。
    expect([...new EdgeDetector<string>(heldAtStart).update(['a'])]).toEqual(expected);
  });

  it('始まりの前の鍵も、離して押し直せば押し始めになる', () => {
    // 鍵の型を書かないと、渡した組から 'a' だけの型に決まり、ほかの鍵を渡すと型エラーになる。
    const edges = new EdgeDetector<string>(['a']);
    expect([['a'], [], ['a']].map((keys) => [...edges.update(keys)])).toEqual([[], [], ['a']]);
  });

  it('押していなかった鍵を渡しても、最初の回に離した扱いになるだけ', () => {
    // 押しているかが分からないときに、押し始めだけを見たい鍵を全部渡す使い方。
    const edges = new EdgeDetector(['a', 'b']);
    expect([...edges.update([])]).toEqual([]);
    expect([...edges.update(['a'])]).toEqual(['a']);
  });

  it('同じ回に2度呼ぶと、2度目は押し始めを返さない', () => {
    // 1回の読みで1度だけ呼び、返した押し始めを、その回の処理の全部で使う。
    const edges = new EdgeDetector<string>([]);
    expect([...edges.update(['a'])]).toEqual(['a']);
    expect([...edges.update(['a'])]).toEqual([]);
  });

  it('releaseAll のあとは、押したままの鍵がもう一度押し始めになる', () => {
    const edges = new EdgeDetector<string>([]);
    edges.update(['a']);
    edges.releaseAll();
    expect([...edges.update(['a'])]).toEqual(['a']);
  });

  it('始まりの前の鍵は省けない（型検査が止める）', () => {
    // 既定を空の組にすると、押したまま始まった鍵の穴がそのまま戻る。既定を足すと、下の注釈が
    // 何も止めなくなり、型検査が失敗する。
    // @ts-expect-error 始まりの前の鍵を渡していない
    const edges = new EdgeDetector<string>();
    // 実行時には見ない（new Set(undefined) は空の Set）。型検査を外して省くと、空の組で始まり、
    // 押したままの鍵が押し始めに見える。
    expect([...edges.update(['a'])]).toEqual(['a']);
  });

  it('始まりの前の鍵は写して持つ', () => {
    const held = new Set(['a']);
    const edges = new EdgeDetector(held);
    held.clear();
    expect([...edges.update(['a'])]).toEqual([]);
  });

  it('同じ鍵が重なっても1つにまとめる', () => {
    const edges = new EdgeDetector<string>([]);
    expect([...edges.update(['a', 'a'])]).toEqual(['a']);
  });

  it('数の鍵も使える', () => {
    // 返す Set の順は約束しないので、Set どうしで比べる。
    const edges = new EdgeDetector<number>([2]);
    expect(new Set(edges.update([3, 2, 1]))).toEqual(new Set([3, 1]));
  });

  it('鍵の組の代わりに文字列を1つ渡すと止まる', () => {
    // 止めないと 'enter' が4つの鍵に分かれ、型検査も止めない。
    expect(() => new EdgeDetector<string>('enter')).toThrow(TypeError);
    expect(() => new EdgeDetector<string>('enter')).toThrow("鍵の組の代わりに文字列が来た: 'enter'");
    const edges = new EdgeDetector<string>(['enter']);
    expect(() => edges.update('enter')).toThrow(TypeError);
    expect(() => edges.update('enter')).toThrow("鍵の組の代わりに文字列が来た: 'enter'");
    expect([...edges.update(['enter'])]).toEqual([]);
  });
});

describe('短い押し', () => {
  it('何も押していなければ空', () => {
    expect([...new PressLatch<string>().read()]).toEqual([]);
  });

  it('読みの間に押して離した鍵も、その回は押した扱い', () => {
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.release('a');
    expect([...latch.read()]).toEqual(['a']);
  });

  it('endStep で印が消え、押したままの鍵は残る', () => {
    // endStep で押している鍵まで消すと、押し続けている鍵が次の回に消える。
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.press('b');
    latch.release('a');
    expect(new Set(latch.read())).toEqual(new Set(['a', 'b']));
    latch.endStep();
    expect([...latch.read()]).toEqual(['b']);
  });

  it('endStep を呼ばない回の押しは、次に読み終えるまで残る', () => {
    // 読んだのに使わなかった回に忘れると、その間の押しが使われないまま消える。
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.release('a');
    expect([...latch.read()]).toEqual(['a']);
    expect([...latch.read()]).toEqual(['a']);
    latch.endStep();
    expect([...latch.read()]).toEqual([]);
  });

  it('離したことが届かなかった鍵を押し直しても、印を付ける', () => {
    // 押していなかった鍵にだけ印を付けると、押し直してすぐ離した鍵が消える。
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.endStep();
    latch.press('a');
    latch.release('a');
    expect([...latch.read()]).toEqual(['a']);
  });

  it('押していない鍵を離しても何も起きない', () => {
    const latch = new PressLatch<string>();
    latch.release('a');
    expect([...latch.read()]).toEqual([]);
  });

  it('同じ鍵を2度押しても1つで、離しても印は残る', () => {
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.press('a');
    latch.release('a');
    expect([...latch.read()]).toEqual(['a']);
    latch.endStep();
    expect([...latch.read()]).toEqual([]);
  });

  it('forgetAll のあとは、押したままの鍵も印も残らない', () => {
    // 離したことが届かなくなるとき、忘れないと押したままの鍵が読まれ続ける。
    const latch = new PressLatch<string>();
    latch.press('a');
    latch.press('b');
    latch.release('b');
    latch.forgetAll();
    expect([...latch.read()]).toEqual([]);
    latch.press('a');
    expect([...latch.read()]).toEqual(['a']);
  });

  it('読んだ値は、あとの押しで変わらない', () => {
    const latch = new PressLatch<string>();
    latch.press('a');
    const first = latch.read();
    latch.press('b');
    expect([...first]).toEqual(['a']);
  });
});
