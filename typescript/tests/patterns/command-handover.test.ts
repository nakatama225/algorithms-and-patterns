import { describe, expect, it } from 'vitest';
import { ArrivalLog, ReplaySource, type CommandSource } from '../../src/patterns/command.js';
import { Handover, HandoverSource } from '../../src/patterns/command-sources.js';

/*
 * src/patterns/command-sources.ts のうち、途中で替わる出どころのテスト。替わる歩を決めて持つ記録
 * （Handover）と、それを読んで代わりに任せる出どころ（HandoverSource）をここで見る。
 * 出どころを合わせる部品（CombinedSource）は command-sources.test.ts が見る。届いた命令で進める側と、
 * 保存したものを再生する側の比べ合わせは command-handover-replay.test.ts に分けた。
 */

type Move = -1 | 0 | 1;

/** いつも同じ命令を返し、聞かれた歩と状態を覚える出どころ。 */
class Fixed implements CommandSource<number, Move> {
  readonly asked: { step: number; view: number }[] = [];

  constructor(readonly move: Move) {}

  commandAt(step: number, view: number): Move {
    this.asked.push({ step, view });
    return this.move;
  }
}

/**
 * 状態を見て命令を決め、向きを覚えている出どころ。位置 0 と 2 の間を行き来する。
 *
 * 位置 1 では、覚えている向きで答えが違う。作り直すと向きを忘れ、上へ向かうところから始め直す。
 */
class Bounce implements CommandSource<number, Move> {
  readonly asked: { step: number; view: number }[] = [];
  #up = true;

  commandAt(step: number, view: number): Move {
    this.asked.push({ step, view });
    if (view >= 2) this.#up = false;
    if (view <= 0) this.#up = true;
    return this.#up ? 1 : -1;
  }
}

/** 代わりの出どころ（Bounce）を作る関数と、作ったもの。 */
function maker(): { readonly made: Bounce[]; readonly make: () => Bounce } {
  const made: Bounce[] = [];
  return {
    made,
    make: () => {
      const source = new Bounce();
      made.push(source);
      return source;
    },
  };
}

/** 位置 0 から、出どころの命令のぶんだけ `steps` 歩ぶん動かし、命令の列を返す。 */
function run(source: CommandSource<number, Move>, steps: number): Move[] {
  let position = 0;
  const moves: Move[] = [];
  for (let step = 0; step < steps; step += 1) {
    const move = source.commandAt(step, position);
    moves.push(move);
    position += move;
  }
  return moves;
}

/** `step` 歩目のあとで替わると決めた記録。 */
function decided(step: number): Handover {
  const handover = new Handover();
  handover.handOverAfter(step);
  return handover;
}

describe('Handover', () => {
  it('決めるまでは、どの歩でも替わっていない', () => {
    const handover = new Handover();
    expect(handover.after).toBeUndefined();
    expect(handover.replacedAt(0)).toBe(false);
    expect(handover.replacedAt(1000)).toBe(false);
  });

  it('決めた歩までは替わらず、その次の歩から替わる', () => {
    const handover = decided(3);
    expect(handover.after).toBe(3);
    const replaced = [0, 1, 2, 3, 4, 5].map((step) => handover.replacedAt(step));
    expect(replaced).toEqual([false, false, false, false, true, true]);
  });

  it('-1 に決めると、0 歩目から替わる', () => {
    // 前の出どころを1度も使わずに替わる場合。
    expect(decided(-1).replacedAt(0)).toBe(true);
  });

  it('替わる歩は1度だけ決める。同じ歩でも2度目は断り、先に決めた歩のまま', () => {
    // 上書きを受け付けると、先に読んだ側と後で読んだ側で替わる歩が食い違う。
    const handover = decided(3);
    expect(() => handover.handOverAfter(5)).toThrow(/もう決めてある/);
    expect(() => handover.handOverAfter(3)).toThrow(/もう決めてある/);
    expect(handover.after).toBe(3);
    expect([3, 4, 5, 6].map((step) => handover.replacedAt(step))).toEqual([false, true, true, true]);
  });

  it('-1 より前と小数の歩には決められず、断ったあとも決められる', () => {
    const handover = new Handover();
    expect(() => handover.handOverAfter(-2)).toThrow(RangeError);
    expect(() => handover.handOverAfter(1.5)).toThrow(RangeError);
    expect(handover.after).toBeUndefined();
    handover.handOverAfter(-1);
    expect(handover.after).toBe(-1);
  });

  it('負の歩と小数の歩は、替わったかの問いに使えない。決める前も後も', () => {
    // どちらも数え間違いの結果。替わった・替わっていないのどちらでも答えない。
    const handover = new Handover();
    expect(() => handover.replacedAt(-1)).toThrow(RangeError);
    expect(() => handover.replacedAt(0.5)).toThrow(RangeError);
    handover.handOverAfter(-1);
    expect(() => handover.replacedAt(-1)).toThrow(RangeError);
    expect(() => handover.replacedAt(0.5)).toThrow(RangeError);
  });
});

describe('HandoverSource', () => {
  it('決めるまでは前の出どころに任せ、代わりは作らない', () => {
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(-1), make, new Handover());
    expect(run(source, 10)).toEqual(Array<Move>(10).fill(-1));
    expect(made).toEqual([]);
  });

  it('決めた歩までは前の出どころ、次の歩から代わりで、代わりはその歩で初めて作る', () => {
    // 替わる歩が1つずれる作りも、代わりを先に作る作りも、ここで止まる。
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(0), make, decided(2));
    for (let step = 0; step < 3; step += 1) {
      expect(source.commandAt(step, 0)).toBe(0);
      expect(made).toEqual([]);
    }
    expect(source.commandAt(3, 0)).toBe(1);
    expect(made).toHaveLength(1);
    expect(made[0]?.asked).toEqual([{ step: 3, view: 0 }]);
  });

  it('代わりは1度だけ作り、作り直さずに覚えた向きのまま使い続ける', () => {
    // 作り直すと、位置 1 で向きを忘れて上へ戻り、0 まで下りなくなる。
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(0), make, decided(-1));
    expect(run(source, 8)).toEqual([1, 1, -1, -1, 1, 1, -1, -1]);
    expect(made).toHaveLength(1);
    expect(made[0]?.asked.map(({ step }) => step)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('前の出どころにも代わりにも、同じ歩と状態を渡す', () => {
    const first = new Fixed(0);
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(first, make, decided(0));
    source.commandAt(0, 5);
    source.commandAt(1, 7);
    expect(first.asked).toEqual([{ step: 0, view: 5 }]);
    expect(made[0]?.asked).toEqual([{ step: 1, view: 7 }]);
  });

  it('負の歩と小数の歩は、前の出どころにも代わりにも渡さない', () => {
    const first = new Fixed(0);
    const source = new HandoverSource<number, Move>(first, maker().make, new Handover());
    expect(() => source.commandAt(-1, 0)).toThrow(RangeError);
    expect(() => source.commandAt(0.5, 0)).toThrow(RangeError);
    expect(first.asked).toEqual([]);
  });

  it('前の出どころで答えた歩より前を替わる歩に決めると、次に聞いたときに止まる', () => {
    // 3 歩目を前の出どころで答えたあとで、2 歩目のあとで替わると決めた場合。同じ記録を再生する側は、
    // 3 歩目を代わりに任せる。黙って進めると、2つの側が 3 歩目からずれる。
    const handover = new Handover();
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(0), make, handover);
    for (let step = 0; step < 4; step += 1) source.commandAt(step, 0);
    handover.handOverAfter(2);
    expect(() => source.commandAt(4, 0)).toThrow(/3 歩目まで答えたあと/);
    expect(made).toEqual([]);
  });

  it('前の出どころで答えた最後の歩を、最後に使う歩に決めるのはよい', () => {
    const handover = new Handover();
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(0), make, handover);
    for (let step = 0; step < 4; step += 1) source.commandAt(step, 0);
    handover.handOverAfter(3);
    expect(source.commandAt(4, 0)).toBe(1);
    expect(made).toHaveLength(1);
  });

  it('順不同に聞いたあとでも、答えた歩のうち最も後の歩より前に決めると止まる', () => {
    // 最後に聞いた歩で覚え直す作りだと、3 歩目を答えたことを忘れて止まらない。
    const handover = new Handover();
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new Fixed(0), make, handover);
    source.commandAt(3, 0);
    source.commandAt(1, 0);
    handover.handOverAfter(2);
    expect(() => source.commandAt(4, 0)).toThrow(/3 歩目まで答えたあと/);
    expect(made).toEqual([]);
  });

  it('前の出どころが届いていない歩で止まったあとで決めても、次は代わりに任せる', () => {
    // 前の出どころが例外を出した歩は、答えた歩に数えない。届いた最後の歩（4 歩目）まで前の
    // 出どころを使うと決めるのは正しい決め方で、5 歩目を読もうとして止まったことは、その妨げにならない。
    const arrivals = new ArrivalLog<Move>(0);
    const handover = new Handover();
    const { made, make } = maker();
    const source = new HandoverSource<number, Move>(new ReplaySource(arrivals), make, handover);
    for (let step = 0; step < 5; step += 1) {
      arrivals.put(step, -1);
      expect(source.commandAt(step, 0)).toBe(-1);
    }
    expect(() => source.commandAt(5, 0)).toThrow(/まだ届いていない/);
    handover.handOverAfter(arrivals.arrivedThrough);
    expect(source.commandAt(5, 0)).toBe(1);
    expect(made).toHaveLength(1);
  });
});
