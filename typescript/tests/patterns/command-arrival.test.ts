import { describe, expect, it } from 'vitest';
import {
  ArrivalLog,
  CommandLog,
  ReplaySource,
  type CommandLookup,
  type CommandSource,
} from '../../src/patterns/command.js';

/*
 * src/patterns/command.ts のうち、届いた範囲を持つ記録（ArrivalLog）のテスト。
 * 記録と再生（CommandLog・RecordingSource・ReplaySource）は command.test.ts が見る。
 * 届いた範囲の約束（順に1つずつ受け取る・届いていない歩を読ませない）は、
 * 記録の縮め方や再生の仕方とは別の理由で変わるので、ファイルを分けた。
 */

type Move = -1 | 0 | 1;

/**
 * 何度か変わり、同じ命令が続く所も含む並び。最後も同じ命令が続き、変わった最後の歩
 * （8 歩目）より先まで届いている。
 */
const SCRIPT: readonly Move[] = [1, 1, 0, -1, -1, -1, 1, 1, 0, 0, 0];

/** `script` を 0 歩目から順に受け取った記録。 */
function arrived(script: readonly Move[]): ArrivalLog<Move> {
  const log = new ArrivalLog<Move>(0);
  script.forEach((move, step) => log.put(step, move));
  return log;
}

/** 同じ並びを記録した `CommandLog`。対照に使う。 */
function recorded(script: readonly Move[]): CommandLog<Move> {
  const log = new CommandLog<Move>(0);
  script.forEach((move, step) => log.record(step, move));
  return log;
}

/** 数直線の上の位置を、出どころの命令のぶんだけ `steps` 歩ぶん動かす。 */
function run(source: CommandSource<number, Move>, steps: number): number {
  let position = 0;
  for (let step = 0; step < steps; step += 1) position += source.commandAt(step, position);
  return position;
}

describe('ArrivalLog', () => {
  it('何も届いていなければ、届いた範囲は -1 で、0 歩目も読めない', () => {
    // 何もしない命令を返すと、届く前に動き出した側だけがずれる。
    const log = new ArrivalLog<Move>(0);
    expect(log.arrivedThrough).toBe(-1);
    expect(log.has(0)).toBe(false);
    expect(() => log.at(0)).toThrow(/まだ届いていない/);
    expect(log.entries()).toEqual([]);
  });

  it('順に受け取れば、届いた範囲では CommandLog と同じ命令を返す', () => {
    const log = arrived(SCRIPT);
    expect(log.arrivedThrough).toBe(SCRIPT.length - 1);
    expect(SCRIPT.map((_, step) => log.at(step))).toEqual(SCRIPT);
    expect(log.entries()).toEqual(recorded(SCRIPT).entries());
  });

  it('命令が変わらない歩でも、届いた範囲は進み、記録は増えない', () => {
    // 変わった歩だけで範囲を数えると、同じ命令が続く間は届いた歩も読めない。
    const log = new ArrivalLog<Move>(0);
    for (let step = 0; step < 5; step += 1) log.put(step, 1);
    expect(log.arrivedThrough).toBe(4);
    expect(log.has(4)).toBe(true);
    expect(log.at(4)).toBe(1);
    expect(log.entries()).toEqual([{ step: 0, command: 1 }]);
  });

  it('最初から何もしない命令が続いても、届いた範囲は進む', () => {
    const log = new ArrivalLog<Move>(0);
    log.put(0, 0);
    log.put(1, 0);
    expect(log.arrivedThrough).toBe(1);
    expect(log.at(1)).toBe(0);
    expect(log.entries()).toEqual([]);
  });

  it('届いた範囲の外を読むと止まる。CommandLog なら最後の命令が返る歩でも止まる', () => {
    // この記録の目的そのもの。対照の CommandLog は、同じ歩でそれらしい命令を返す。
    const log = arrived([1, 1, 1]);
    expect(() => log.at(3)).toThrow(RangeError);
    expect(() => log.at(3)).toThrow(/まだ届いていない/);
    expect(log.has(3)).toBe(false);
    expect(log.has(2)).toBe(true);
    expect(recorded([1, 1, 1]).at(3)).toBe(1);
  });

  it('飛んだ歩は受け取らない', () => {
    // 飛んだ歩を受け付けると、抜けた歩に直前の命令が続いて見える。
    const log = new ArrivalLog<Move>(0);
    log.put(0, 1);
    expect(() => log.put(2, -1)).toThrow(RangeError);
  });

  it('最初の命令は、0 歩目でなければ受け取らない', () => {
    const log = new ArrivalLog<Move>(0);
    expect(() => log.put(1, 1)).toThrow(RangeError);
    expect(log.arrivedThrough).toBe(-1);
  });

  it('戻った歩と、同じ歩の2度目は、命令が同じでも受け取らない', () => {
    const log = arrived([1, 1, 0]);
    expect(() => log.put(1, -1)).toThrow(RangeError);
    expect(() => log.put(2, 0)).toThrow(RangeError);
    expect(() => log.put(2, 1)).toThrow(RangeError);
    expect(log.arrivedThrough).toBe(2);
    expect(log.entries()).toEqual([{ step: 0, command: 1 }, { step: 2, command: 0 }]);
  });

  it('断った命令は、届いた範囲も記録も動かさない', () => {
    // 断る前に範囲を進めると、抜けた歩の命令が届いても、もう受け取れない。
    const log = new ArrivalLog<Move>(0);
    log.put(0, 1);
    expect(() => log.put(2, -1)).toThrow(RangeError);
    expect(log.arrivedThrough).toBe(0);
    expect(log.has(2)).toBe(false);
    expect(log.entries()).toEqual([{ step: 0, command: 1 }]);

    // 抜けていた歩が届けば、そこから続けられる。
    log.put(1, 0);
    log.put(2, -1);
    expect([0, 1, 2].map((step) => log.at(step))).toEqual([1, 0, -1]);
  });

  it('負の歩と小数の歩は、受け取りにも、届いたかの問いにも、読み出しにも使えない', () => {
    // どちらも数え間違いの結果。届いた・届いていないのどちらでも答えない。
    // 読み出しは、まだ届いていない歩と同じ RangeError だが、文面で分ける。
    const log = arrived([1, 1]);
    expect(() => log.put(-1, 1)).toThrow(RangeError);
    expect(() => log.put(1.5, 1)).toThrow(RangeError);
    expect(() => log.has(-1)).toThrow(RangeError);
    expect(() => log.has(0.5)).toThrow(RangeError);
    expect(() => log.at(-1)).toThrow(/0 以上の整数/);
    expect(() => log.at(0.5)).toThrow(/0 以上の整数/);
    expect(log.arrivedThrough).toBe(1);
  });

  it('比べ方を渡すと、中身が同じオブジェクトを同じ命令として扱う', () => {
    interface Keys {
      readonly left: boolean;
    }
    const sameKeys = (a: Keys, b: Keys): boolean => a.left === b.left;
    const byContent = new ArrivalLog<Keys>({ left: false }, sameKeys);
    const byIdentity = new ArrivalLog<Keys>({ left: false });
    for (let step = 0; step < 5; step += 1) {
      // 毎回、中身が同じ別のオブジェクトを作る。
      byContent.put(step, { left: true });
      byIdentity.put(step, { left: true });
    }
    expect(byContent.entries()).toHaveLength(1);
    expect(byIdentity.entries()).toHaveLength(5);
    expect(byContent.arrivedThrough).toBe(4);
  });
});

describe('ArrivalLog と ReplaySource', () => {
  it('ReplaySource に渡すと、届いた歩までは命令を返し、その先で止まる', () => {
    const replay = new ReplaySource(arrived(SCRIPT));
    expect(SCRIPT.map((_, step) => replay.commandAt(step))).toEqual(SCRIPT);
    expect(() => replay.commandAt(SCRIPT.length)).toThrow(/まだ届いていない/);
  });

  it('届いた歩までは、CommandLog を再生したときと同じ結果になる', () => {
    // 対照の CommandLog は、記録より先の歩まで進めても、最後の命令を返し続ける。
    const log = arrived(SCRIPT);
    const plain = recorded(SCRIPT);
    expect(run(new ReplaySource(log), SCRIPT.length)).toBe(run(new ReplaySource(plain), SCRIPT.length));
    expect(() => run(new ReplaySource(plain), SCRIPT.length + 1)).not.toThrow();
    expect(() => run(new ReplaySource(log), SCRIPT.length + 1)).toThrow(/まだ届いていない/);
  });

  it('保存した一覧から作り直した記録は、届いた歩まで同じ命令を返す', () => {
    // 一覧だけでは、最後に変わった歩より先のどこまで届いていたかが分からない。
    // entries() と arrivedThrough を一緒に残す。
    const log = arrived(SCRIPT);
    const rebuilt = new CommandLog<Move>(0);
    for (const { step, command } of log.entries()) rebuilt.record(step, command);
    expect(rebuilt.lastStep).toBeLessThan(log.arrivedThrough);

    const steps = Array.from({ length: log.arrivedThrough + 1 }, (_, step) => step);
    const fromRebuilt = new ReplaySource(rebuilt);
    const fromLog = new ReplaySource(log);
    expect(steps.map((step) => fromRebuilt.commandAt(step))).toEqual(steps.map((step) => fromLog.commandAt(step)));
  });

  it('at を持つものなら、記録のクラスでなくても、そのまま記録として渡せる', () => {
    // ReplaySource が受けるのは CommandLookup で、記録のクラスに限らない。
    const replay = new ReplaySource<Move>({ at: (step) => (step % 2 === 0 ? 1 : -1) });
    expect([0, 1, 2].map((step) => replay.commandAt(step))).toEqual([1, -1, 1]);
  });

  it('歩の型を狭めた at は、型検査で渡せない', () => {
    // `CommandLookup` の `at` をメソッドの形で宣言すると、型検査が歩の型の向きを見なくなり、
    // 下の行が型エラーにならず、`@ts-expect-error` が使われていないとして型検査が失敗する。
    const firstTwo = { at: (step: 0 | 1): Move => (step === 0 ? 1 : -1) };
    // @ts-expect-error 0 と 1 のほかの歩には答えられない
    const lookup: CommandLookup<Move> = firstTwo;
    expect(lookup.at(0)).toBe(1);
  });
});
