import { describe, expect, it } from 'vitest';
import {
  CommandLog,
  RecordingSource,
  ReplaySource,
  type CommandSource,
} from '../../src/patterns/command.js';

/** 確かめるための小さな処理。数直線の上の位置を、命令のぶんだけ動かす。 */
type Move = -1 | 0 | 1;
interface Point {
  readonly position: number;
}

function apply(state: Point, move: Move): Point {
  return { position: state.position + move };
}

/** 出どころから命令を受け取りながら、`steps` 歩ぶん進める。 */
function run(source: CommandSource<Point, Move>, steps: number): Point {
  let state: Point = { position: 0 };
  for (let step = 0; step < steps; step += 1) {
    state = apply(state, source.commandAt(step, state));
  }
  return state;
}

/** 状態を見て命令を決める出どころ。3 まで進んだら 0 へ戻り、また進む。 */
class BackAndForth implements CommandSource<Point, Move> {
  #goingUp = true;

  commandAt(_step: number, view: Readonly<Point>): Move {
    if (view.position >= 3) this.#goingUp = false;
    if (view.position <= 0) this.#goingUp = true;
    return this.#goingUp ? 1 : -1;
  }
}

describe('CommandLog', () => {
  it('何も記録していなければ、どの歩でも何もしない命令を返す', () => {
    const log = new CommandLog<Move>(0);
    expect(log.at(0)).toBe(0);
    expect(log.at(1000)).toBe(0);
    expect(log.entries()).toEqual([]);
    expect(log.lastStep).toBe(-1);
  });

  it('変わった歩ちょうどから新しい命令になり、その手前は前の命令のまま', () => {
    const log = new CommandLog<Move>(0);
    log.record(5, 1);
    expect(log.at(4)).toBe(0);
    expect(log.at(5)).toBe(1);
    expect(log.at(99)).toBe(1);
  });

  it('同じ命令が続く間は、記録を増やさない', () => {
    // 押しっぱなしの操作を歩ごとに1件ずつ持つと、記録が歩の数だけ膨らむ。
    const log = new CommandLog<Move>(0);
    for (let step = 0; step < 10; step += 1) log.record(step, 1);
    log.record(10, -1);
    log.record(11, -1);
    expect(log.entries()).toEqual([
      { step: 0, command: 1 },
      { step: 10, command: -1 },
    ]);
  });

  it('記録を増やさなかった歩も、最後に受け付けた歩として覚えている', () => {
    // 保存した記録から、何歩ぶん再生すればよいかを取り出せるようにする。
    const log = new CommandLog<Move>(0);
    log.record(0, 1);
    log.record(7, 1);
    expect(log.entries()).toHaveLength(1);
    expect(log.lastStep).toBe(7);
  });

  it('最初に何もしない命令を記録しても、記録は増えない', () => {
    const log = new CommandLog<Move>(0);
    log.record(0, 0);
    log.record(1, 0);
    expect(log.entries()).toEqual([]);
  });

  it('何度も変わった記録から、それぞれの歩の命令を引ける', () => {
    const log = new CommandLog<Move>(0);
    const script: Move[] = [1, 1, 0, -1, -1, -1, 1, 0, 0, 1];
    script.forEach((move, step) => log.record(step, move));
    script.forEach((move, step) => expect(log.at(step)).toBe(move));
  });

  it('歩が戻ると止まる', () => {
    // 歩の番号を数え直した記録（例：途中で 0 に戻した）を、黙って受け付けない。
    // 受け付けると、再生したときに後から記録した命令が前の命令を上書きして見える。
    const log = new CommandLog<Move>(0);
    log.record(3, 1);
    expect(() => log.record(2, -1)).toThrow(RangeError);
  });

  it('断った記録は、受け付けた最後の歩を動かさない', () => {
    // 断る前に最後の歩を書き換えると、戻った番号のあとで、一度受け付けた番号を
    // もう一度受け付けてしまう。
    const log = new CommandLog<Move>(0);
    log.record(3, 1);
    expect(() => log.record(2, -1)).toThrow(RangeError);
    expect(log.lastStep).toBe(3);
    expect(() => log.record(3, -1)).toThrow(RangeError);
  });

  it('同じ歩を2度記録すると止まる。命令が同じでも止まる', () => {
    const log = new CommandLog<Move>(0);
    log.record(3, 1);
    expect(() => log.record(3, -1)).toThrow(RangeError);
    expect(() => log.record(3, 1)).toThrow(RangeError);
  });

  it('記録を増やさなかった歩も、2度目は受け付けない', () => {
    const log = new CommandLog<Move>(0);
    log.record(3, 0);
    expect(() => log.record(3, 1)).toThrow(RangeError);
  });

  it('負の歩と小数の歩は、記録にも読み出しにも使えない', () => {
    // どちらも数え間違いの結果。何もしない命令や手前の命令を返して黙って進めない。
    const log = new CommandLog<Move>(0);
    expect(() => log.record(-1, 1)).toThrow(RangeError);
    expect(() => log.record(1.5, 1)).toThrow(RangeError);
    expect(() => log.at(-1)).toThrow(RangeError);
    expect(() => log.at(2.5)).toThrow(RangeError);
  });

  it('比べ方を渡すと、中身が同じオブジェクトを同じ命令として扱う', () => {
    interface Keys {
      readonly left: boolean;
      readonly right: boolean;
    }
    const idle: Keys = { left: false, right: false };
    const sameKeys = (a: Keys, b: Keys): boolean => a.left === b.left && a.right === b.right;

    const byContent = new CommandLog<Keys>(idle, sameKeys);
    const byIdentity = new CommandLog<Keys>(idle);
    for (let step = 0; step < 5; step += 1) {
      // 毎回、中身が同じ別のオブジェクトを作る。
      byContent.record(step, { left: true, right: false });
      byIdentity.record(step, { left: true, right: false });
    }
    expect(byContent.entries()).toHaveLength(1);
    expect(byIdentity.entries()).toHaveLength(5);
  });

  it('entries の返り値を書き換えても、記録は変わらない', () => {
    const log = new CommandLog<Move>(0);
    log.record(0, 1);
    const copy = log.entries();
    copy.push({ step: 1, command: -1 });
    expect(log.entries()).toEqual([{ step: 0, command: 1 }]);
    expect(log.at(1)).toBe(1);
  });
});

describe('RecordingSource と ReplaySource', () => {
  it('記録しながら流した命令を再生すると、同じ結果になる', () => {
    // この型の目的そのもの。状態を見て命令を決める出どころでも、再生で同じになる。
    const log = new CommandLog<Move>(0);
    const recorded = run(new RecordingSource(new BackAndForth(), log), 50);
    const replayed = run(new ReplaySource(log), 50);
    expect(replayed).toEqual(recorded);
  });

  it('再生は、記録した命令の列を歩ごとにそのまま返す', () => {
    const log = new CommandLog<Move>(0);
    const seen: Move[] = [];
    const inner = new BackAndForth();
    const spy: CommandSource<Point, Move> = {
      commandAt(step, view) {
        const move = inner.commandAt(step, view);
        seen.push(move);
        return move;
      },
    };
    run(new RecordingSource(spy, log), 20);

    const replay = new ReplaySource(log);
    const replayed = seen.map((_, step) => replay.commandAt(step));
    expect(replayed).toEqual(seen);
  });

  it('再生は歩の番号で命令を引く。呼ばれた順番には頼らない', () => {
    // 呼ばれた回数を自分で数えて引く作りだと、途中から再生したり、同じ歩を
    // 読み直したりしたときに別の命令を返す。
    const log = new CommandLog<Move>(0);
    log.record(3, 1);
    log.record(7, -1);
    const replay = new ReplaySource(log);
    expect([7, 3, 7, 0, 5].map((step) => replay.commandAt(step))).toEqual([-1, 1, -1, 0, 1]);
  });

  it('記録は、渡された歩の番号のまま残る', () => {
    // 包む側が自分で番号を数える作りだと、歩 5 から始めた記録が 0 から始まってしまう。
    const log = new CommandLog<Move>(0);
    const moves: Record<number, Move> = { 5: 1, 10: -1, 20: 1 };
    const recording = new RecordingSource<Point, Move>(
      { commandAt: (step) => moves[step] ?? 0 },
      log,
    );
    for (const step of [5, 10, 20]) recording.commandAt(step, { position: 0 });
    expect(log.entries()).toEqual([
      { step: 5, command: 1 },
      { step: 10, command: -1 },
      { step: 20, command: 1 },
    ]);
  });

  it('包まれた出どころには、同じ歩の番号と状態がそのまま渡る', () => {
    const calls: { step: number; position: number }[] = [];
    const inner: CommandSource<Point, Move> = {
      commandAt(step, view) {
        calls.push({ step, position: view.position });
        return 1;
      },
    };
    run(new RecordingSource(inner, new CommandLog<Move>(0)), 3);
    expect(calls).toEqual([
      { step: 0, position: 0 },
      { step: 1, position: 1 },
      { step: 2, position: 2 },
    ]);
  });

  it('記録した歩数より長く再生すると、最後の命令が続く', () => {
    // 再生を記録より長く回したときの振る舞いを、黙って決めないために書いておく。
    const log = new CommandLog<Move>(0);
    const recorded = run(new RecordingSource(new BackAndForth(), log), 10);
    const last = log.at(9);
    const replayed = run(new ReplaySource(log), 20);
    expect(replayed.position).toBe(recorded.position + last * 10);
  });

  it('より多くを知っている状態を前提にした出どころは、型検査で渡せない', () => {
    // 状態の型の向きを型検査が見ていることを確かめる。`commandAt` をメソッドの形で
    // 宣言すると向きを見なくなり、下の行が型エラーにならず、`@ts-expect-error` が
    // 使われていないとして型検査が落ちる。
    interface Labeled extends Point {
      readonly label: string;
    }
    class NeedsLabel implements CommandSource<Labeled, Move> {
      commandAt(_step: number, view: Readonly<Labeled>): Move {
        return view.label.startsWith('+') ? 1 : 0;
      }
    }
    // @ts-expect-error Point には label が無い
    const source: CommandSource<Point, Move> = new NeedsLabel();
    expect(source).toBeInstanceOf(NeedsLabel);
  });
});
