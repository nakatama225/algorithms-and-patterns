import { describe, expect, it } from 'vitest';
import {
  ArrivalLog,
  CommandLog,
  ReplaySource,
  type CommandChange,
  type CommandSource,
} from '../../src/patterns/command.js';
import { Handover, HandoverSource } from '../../src/patterns/command-sources.js';

/*
 * src/patterns/command-sources.ts のうち、途中で替わる出どころの2つの側の比べ合わせ。届いた命令で
 * 進める側と、保存したものを再生する側が、同じ歩に替わるかをここで見る。部品そのもの（Handover・
 * HandoverSource）の約束は command-handover.test.ts が見る。2つの側を揃える使い方（命令の記録と
 * 替わる歩を一緒に保存する）は、部品の約束とは別の理由で変わるので、ファイルを分けた。
 */

type Move = -1 | 0 | 1;

/** 状態を見て命令を決め、向きを覚えている出どころ。位置 0 と 2 の間を行き来する。 */
class Bounce implements CommandSource<number, Move> {
  #up = true;

  commandAt(_step: number, view: number): Move {
    if (view >= 2) this.#up = false;
    if (view <= 0) this.#up = true;
    return this.#up ? 1 : -1;
  }
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

/** 届いた命令。5 歩目からは届かず、4 歩目のあとで替わると決まる。 */
const ARRIVED: readonly Move[] = [1, 1, 0, -1, -1];
const STEPS = 12;

/** 届いた命令で進める側が、保存するもの。代わりの出どころの命令は含まれない。 */
interface Saved {
  readonly entries: readonly CommandChange<Move>[];
  readonly after: number | undefined;
}

/**
 * 届いた命令で進める側。命令は1歩ずつ届き、届かなくなった所で替わる歩が決まる。
 * 進めた命令の列と、保存するもの（届いた命令の一覧と、前の出どころを最後に使う歩）を返す。
 */
function runArrived(decide: boolean): { readonly moves: Move[]; readonly saved: Saved } {
  const arrivals = new ArrivalLog<Move>(0);
  const handover = new Handover();
  const source = new HandoverSource<number, Move>(new ReplaySource(arrivals), () => new Bounce(), handover);
  let position = 0;
  const moves: Move[] = [];
  for (let step = 0; step < STEPS; step += 1) {
    const move = ARRIVED[step];
    if (move !== undefined) {
      arrivals.put(step, move);
    } else if (decide && handover.after === undefined) {
      // 次の命令は届かないと知らされた。届いた最後の歩まで前の出どころを使う。
      handover.handOverAfter(arrivals.arrivedThrough);
    }
    const used = source.commandAt(step, position);
    moves.push(used);
    position += used;
  }
  return { moves, saved: { entries: arrivals.entries(), after: handover.after } };
}

/** 保存したものを再生する側。記録を作り直し、代わりも同じ作り方で作り直す。 */
function runReplayed({ entries, after }: Saved): Move[] {
  const log = new CommandLog<Move>(0);
  for (const { step, command } of entries) log.record(step, command);
  const handover = new Handover();
  if (after !== undefined) handover.handOverAfter(after);
  return run(new HandoverSource<number, Move>(new ReplaySource(log), () => new Bounce(), handover), STEPS);
}

describe('届いた命令で進める側と、保存したものを再生する側', () => {
  it('同じ判定を読むので、保存した歩から作り直した記録を渡せば、同じ歩に替わる', () => {
    // 2つの側は同じ判定（Handover.replacedAt）を読む。再生する側の記録は、保存した歩から作り直す。
    // 代わりの出どころの命令は保存しない。再生する側は、同じ作り方で代わりを作り直す。
    // 代わりの命令まで記録して再生する形だと、替わる歩を渡さなくても一致するので、
    // 2つの側が同じ歩に替わることは示せない。
    const { moves, saved } = runArrived(true);
    expect(saved.after).toBe(ARRIVED.length - 1);
    expect(moves).toEqual([...ARRIVED, 1, 1, -1, -1, 1, 1, -1]);
    expect(Math.max(...saved.entries.map(({ step }) => step))).toBeLessThan(ARRIVED.length);
    expect(runReplayed(saved)).toEqual(moves);
  });

  it('再生する側だけ替わる歩が1歩ずれると、例外も出ずに命令の列が違う', () => {
    // 保存した替わる歩が1歩ずれると起きること。部品の中では見つけられないので、命令の記録と
    // 替わる歩を一緒に残す。後へずれると、記録の最後の命令が1歩ぶん続く。前へずれると、
    // まだ届いた命令を使う歩で代わりに任せる。
    const { moves, saved } = runArrived(true);
    const after = ARRIVED.length - 1;
    expect(saved.after).toBe(after);
    expect(runReplayed({ ...saved, after: after + 1 })).not.toEqual(moves);
    expect(runReplayed({ ...saved, after: after - 1 })).not.toEqual(moves);
  });

  it('替わる歩を決め忘れると、進める側は届いていない歩で止まり、再生する側は黙ってずれる', () => {
    // 再生する側の記録（CommandLog）は、記録より先の歩に最後の命令を返し続ける。替わる歩を
    // 保存し忘れると、再生する側は例外も出さずに別の結果になる。届いた命令で進める側は、
    // まだ届いていない歩を読んだ所で止まる（ArrivalLog）。
    expect(() => runArrived(false)).toThrow(/まだ届いていない/);
    const { moves, saved } = runArrived(true);
    const replayed = runReplayed({ ...saved, after: undefined });
    expect(replayed).not.toEqual(moves);
    expect(replayed.slice(ARRIVED.length)).toEqual(Array<Move>(STEPS - ARRIVED.length).fill(-1));
  });
});
