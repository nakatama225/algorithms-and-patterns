import { describe, expect, it } from 'vitest';
import { advanceInPhases, type Order } from '../../src/patterns/phased-update.js';

/*
 * src/patterns/phased-update.ts の二段の更新（advanceInPhases）のテスト。
 * 呼ばれた順を記録する偽物で、順だけを見る。進める処理と後の処理の中身は呼ぶ側が決めるので、ここでは見ない。
 * 止める鍵と、呼ぶ側の関数の例外と、後の処理の型が受け付けるものは phased-update-invalid.test.ts にある。
 */

/** 表の1つ。 */
interface Spec {
  readonly name: string;
  readonly phase: number;
  /** 番の中を新しいものから進めるか。 */
  readonly newestFirst?: boolean;
  /** 進めた刻みで役目を終えるか。 */
  readonly finishes?: boolean;
  /** 進める間に、呼ぶ側の並びの後ろへ足すものの名前。 */
  readonly adds?: string;
}

/**
 * 呼ばれた順を記録する偽物。表から order・advance・settle を作る。
 * 進める間に足したものを並びの後ろに付ける、呼ぶ側の仕事も受け持つ。
 */
class Recorder {
  /** 呼ぶ側の並び。進める間に足すものは、ここの後ろに付ける。 */
  items: string[];
  readonly log: string[] = [];
  readonly #specs: ReadonlyMap<string, Spec>;

  constructor(specs: readonly Spec[]) {
    this.items = specs.map((spec) => spec.name);
    this.#specs = new Map(specs.map((spec) => [spec.name, spec]));
  }

  readonly order: Order<string> = (item, index) => {
    const spec = this.#spec(item);
    return [spec.phase, spec.newestFirst === true ? -index : index];
  };

  readonly advance = (item: string): boolean => {
    this.log.push(item);
    const spec = this.#spec(item);
    if (spec.adds !== undefined) this.items.push(spec.adds);
    return spec.finishes === true;
  };

  readonly settle = (item: string): void => {
    this.log.push(`${item}:settle`);
  };

  /** 1刻み進め、呼ぶ側として、進める間に足したものを後ろに付ける。 */
  run(): string[] {
    const n = this.items.length;
    const kept = advanceInPhases(this.items, this.order, this.advance, this.settle);
    this.items = [...kept, ...this.items.slice(n)];
    return kept;
  }

  #spec(item: string): Spec {
    const spec = this.#specs.get(item);
    if (spec === undefined) throw new Error(`表に無いもの: ${item}`);
    return spec;
  }
}

/** すべてを番 0 に置き、並びの順に進める鍵。 */
const byIndex: Order<unknown> = (_item, index) => [0, index];

/** 何もしない後の処理。 */
const ignore = (): void => {};

const ROWS: readonly {
  readonly title: string;
  readonly specs: readonly Spec[];
  readonly log: readonly string[];
  readonly kept: readonly string[];
  readonly after: readonly string[];
}[] = [
  {
    title: '番が3つ・番の中を新しい順・役目を終えるもの・進める間に足すもの',
    specs: [
      { name: 'a', phase: 2, newestFirst: true },
      { name: 'b', phase: 2, newestFirst: true, finishes: true },
      { name: 'c', phase: 2, newestFirst: true },
      { name: 'd', phase: 3 },
      { name: 'e', phase: 1, adds: 'f' },
    ],
    log: ['e', 'e:settle', 'c', 'b', 'a', 'a:settle', 'c:settle', 'd', 'd:settle'],
    kept: ['a', 'c', 'd', 'e'],
    after: ['a', 'c', 'd', 'e', 'f'],
  },
  {
    title: '番が1つ・すべて進めてから後の処理',
    specs: [
      { name: 'x', phase: 0 },
      { name: 'y', phase: 0 },
      { name: 'z', phase: 0 },
    ],
    log: ['x', 'y', 'z', 'x:settle', 'y:settle', 'z:settle'],
    kept: ['x', 'y', 'z'],
    after: ['x', 'y', 'z'],
  },
  {
    title: '番の小さい順・負の番も',
    specs: [
      { name: 'p', phase: 3 },
      { name: 'q', phase: -1 },
      { name: 'r', phase: 0 },
    ],
    log: ['q', 'q:settle', 'r', 'r:settle', 'p', 'p:settle'],
    kept: ['p', 'q', 'r'],
    after: ['p', 'q', 'r'],
  },
  {
    title: 'すべてが役目を終える',
    specs: [
      { name: 's', phase: 0, finishes: true },
      { name: 't', phase: 1, finishes: true },
    ],
    log: ['s', 't'],
    kept: [],
    after: [],
  },
  {
    title: '1件',
    specs: [{ name: 'only', phase: 5 }],
    log: ['only', 'only:settle'],
    kept: ['only'],
    after: ['only'],
  },
];

describe('進める順と後の処理の順', () => {
  // 1行目は、番を3つ置き、番の中を新しいものから進める場面。進めてすぐ後の処理を呼ぶ形・番で区切らずに
  // 後の処理を最後にまとめる形・後の処理を進めた順に呼ぶ形・役目を終えたものにも後の処理を呼ぶ形・
  // 進める間に足したものを進めるか返す形・返す並びを進めた順にする形・番の大きい順に進める形の
  // どれでも、記録か返す並びが変わる。
  it.each(ROWS)('番ごとにすべて進めてから、役目を終えなかったものの後の処理を並びの順に呼ぶ：$title', (row) => {
    const recorder = new Recorder(row.specs);
    expect(recorder.run()).toEqual(row.kept);
    expect(recorder.log).toEqual(row.log);
    expect(recorder.items).toEqual(row.after);
  });

  it('空の並びは、何も呼ばずに空を返す', () => {
    const recorder = new Recorder([]);
    expect(recorder.run()).toEqual([]);
    expect(recorder.log).toEqual([]);
  });

  it('鍵がまったく同じものは、並びの順に進める', () => {
    // 並びの順は名前の順と違う。名前で並べ替えると順が変わる。
    const recorder = new Recorder([
      { name: 'c', phase: 0 },
      { name: 'a', phase: 0 },
      { name: 'b', phase: 0 },
    ]);
    const kept = advanceInPhases(recorder.items, () => [0, 0], recorder.advance, recorder.settle);
    expect(recorder.log).toEqual(['c', 'a', 'b', 'c:settle', 'a:settle', 'b:settle']);
    expect(kept).toEqual(['c', 'a', 'b']);
  });

  it('鍵は何も進める前に、1つにつき1度ずつ求める', () => {
    // 比べる関数の中で鍵を求めると、1つにつき何度も呼ぶ。進める処理が鍵の元の値を変えても、
    // その刻みの順は変わらない。
    const recorder = new Recorder([
      { name: 'a', phase: 1 },
      { name: 'b', phase: 0 },
      { name: 'c', phase: 1 },
    ]);
    const phases = new Map([
      ['a', 1],
      ['b', 0],
      ['c', 1],
    ]);
    const order: Order<string> = (item, index) => {
      recorder.log.push(`order:${item}`);
      return [phases.get(item) ?? Number.NaN, index];
    };
    const advance = (item: string): boolean => {
      phases.set('c', -5);
      return recorder.advance(item);
    };
    advanceInPhases(recorder.items, order, advance, recorder.settle);
    expect(recorder.log).toEqual(['order:a', 'order:b', 'order:c', 'b', 'b:settle', 'a', 'c', 'a:settle', 'c:settle']);
  });
});

describe('添字で扱う', () => {
  it('等しい値が2つ並んでも別々に進み、片方だけ役目を終えても、もう片方は残る', () => {
    // 値で外すと（値の Set で覚える、など）、等しいもう片方も外れ、後の処理も呼ばれない。
    const indices: number[] = [];
    const advanced: number[] = [];
    const settled: number[] = [];
    const kept = advanceInPhases(
      [5, 5],
      (_item, index) => {
        indices.push(index);
        return [0, index];
      },
      (item) => advanced.push(item) === 1,
      (item) => {
        settled.push(item);
      },
    );
    expect(indices).toEqual([0, 1]);
    expect(advanced).toEqual([5, 5]);
    expect(settled).toEqual([5]);
    expect(kept).toEqual([5]);
  });

  it('呼んだ並びは書き換えない', () => {
    const items = ['a', 'b'];
    expect(advanceInPhases(items, byIndex, (item) => item === 'a', ignore)).toEqual(['b']);
    expect(items).toEqual(['a', 'b']);
  });
});

describe('選ぶもの', () => {
  it('選ばなかったものは進めず、後の処理も呼ばず、元の位置に残る', () => {
    // 持ち主ごとに進める番を分けるときなどに、ほかの持ち主のものを残す。
    // 選ぶ関数も、何も進める前に1つにつき1度ずつ呼ぶ。鍵を求める関数は、選んだものにだけ呼ぶ
    // （選ぶ関数との前後は約束しないので、別の列に記録する）。
    const recorder = new Recorder(['a', 'b', 'c', 'd'].map((name) => ({ name, phase: 0, finishes: name === 'b' })));
    const ordered: string[] = [];
    const order: Order<string> = (item, index) => {
      ordered.push(item);
      return [0, index];
    };
    const picks = (item: string): boolean => {
      recorder.log.push(`picks:${item}`);
      return item === 'b' || item === 'd';
    };
    const kept = advanceInPhases(recorder.items, order, recorder.advance, recorder.settle, picks);
    expect(ordered).toEqual(['b', 'd']);
    expect(recorder.log).toEqual(['picks:a', 'picks:b', 'picks:c', 'picks:d', 'b', 'd', 'd:settle']);
    expect(kept).toEqual(['a', 'c', 'd']);
  });

  it('何も選ばなければ、何も進めずにそのまま返す', () => {
    const unexpected = (item: string): boolean => {
      throw new Error(`呼ばれないはず: ${item}`);
    };
    expect(advanceInPhases(['a', 'b'], byIndex, unexpected, ignore, () => false)).toEqual(['a', 'b']);
  });
});
