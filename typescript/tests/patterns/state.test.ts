import { describe, expect, it } from 'vitest';
import { assertNever } from '../../src/patterns/state.js';

/*
 * src/patterns/state.ts の約束と、扱い忘れを見つける検査のテスト。
 * 種類ごとの性質を表にまとめ、共通の処理が性質だけを見る使い方は state-traits.test.ts が見る。
 * 変わる理由が違うので、ファイルを分けた。
 */

/** 確かめるための状態。接続の状態を、状態ごとに持つ値を分けて表す。 */
interface Idle {
  readonly kind: 'idle';
}
interface Connecting {
  readonly kind: 'connecting';
  /** 何回目の試行か。つなごうとしている間だけ意味を持つ。 */
  readonly attempt: number;
}
interface Closed {
  readonly kind: 'closed';
  /** 切れた理由。切れたあとだけ意味を持つ。 */
  readonly reason: string;
}
type Connection = Idle | Connecting | Closed;

/** 中身を持たない状態は1つを使い回す。書き換えられないよう凍らせておく。 */
const IDLE: Idle = Object.freeze({ kind: 'idle' });

/** すべての状態を扱う分岐。状態を足すと、ここが型エラーになる。 */
function label(state: Connection): string {
  switch (state.kind) {
    case 'idle':
      return '待機中';
    case 'connecting':
      // この分岐の中でだけ、attempt を読める。
      return `接続中（${state.attempt} 回目）`;
    case 'closed':
      return `切断（${state.reason}）`;
    default:
      return assertNever(state);
  }
}

describe('状態を閉じた union で表す', () => {
  it('すべての状態を扱った分岐は、状態ごとの値を使って答える', () => {
    expect(label(IDLE)).toBe('待機中');
    expect(label({ kind: 'connecting', attempt: 2 })).toBe('接続中（2 回目）');
    expect(label({ kind: 'closed', reason: '時間切れ' })).toBe('切断（時間切れ）');
  });

  it('状態を1つ扱い忘れると、型検査が止める', () => {
    // この型の目的そのもの。`closed` の分岐を書き忘れると、`state` が `never` にならず、
    // assertNever を呼ぶ行が型エラーになる。型エラーにならなければ、`@ts-expect-error` が
    // 使われていないとして型検査が落ちる。
    // 静的検査の switch-exhaustiveness-check も、default があっても同じ書き忘れを止める
    // （規則の選択肢は eslint.config.js）。その指摘は、下の注釈で外す。default がある書き忘れを
    // 止めない選択肢に替えると、この注釈が何も外さなくなり、npm run lint が失敗する。
    function forgetful(state: Connection): string {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- closed を扱っていない
      switch (state.kind) {
        case 'idle':
          return '待機中';
        case 'connecting':
          return '接続中';
        default:
          // @ts-expect-error closed を扱っていない
          return assertNever(state);
      }
    }
    expect(forgetful(IDLE)).toBe('待機中');
  });

  it('値を返さない switch の書き忘れは、静的検査が止める', () => {
    // 値を返す関数なら、型検査は「値を返さずに抜ける道がある」として止める。値を返さない関数で
    // default の assertNever も書かないと、扱っていない状態が残っても型検査は止めず、その状態は
    // 黙って何もせずに通る。そこで、静的検査の switch-exhaustiveness-check（eslint.config.js）を
    // 当てている。下の注釈はその指摘を外す。規則が外れると注釈が何も外さなくなり、npm run lint が
    // 失敗する。規則の強さと当たる範囲は、lint-rules.test.ts で見る。
    const seen: string[] = [];
    function record(state: Connection): void {
      // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check -- closed を扱っていない
      switch (state.kind) {
        case 'idle':
          seen.push('待機中');
          break;
        case 'connecting':
          seen.push(`接続中（${state.attempt} 回目）`);
          break;
      }
    }
    record(IDLE);
    record({ kind: 'closed', reason: '時間切れ' });
    expect(seen).toEqual(['待機中']);
  });

  it('その状態でだけ意味を持つ値は、見分ける前には読めない', () => {
    // 引数で受けて確かめる。変数に代入すると、型検査は代入した値から状態を絞り込むので、
    // 見分けていない状態を作れない。
    function attemptOf(state: Connection): unknown {
      // @ts-expect-error 見分ける前は、attempt を持たない状態かもしれない
      return state.attempt;
    }
    expect(attemptOf({ kind: 'connecting', attempt: 1 })).toBe(1);

    // 待機中の状態に試行の回数を持たせた値は、直接書くと型検査が止める。
    // ⚠️ 止まるのは直接書いた値だけ。いったん別の変数に入れた値を渡すと、余分な項目は
    // 見逃される。
    // @ts-expect-error 待機中の状態は attempt を持てない
    const wrong: Idle = { kind: 'idle', attempt: 3 };
    expect(wrong.kind).toBe('idle');
  });

  it('readonly の項目の書き換えは型検査が止める。実行時には止まらない', () => {
    // readonly は型検査だけの約束。実行時にも止めたい値は、次のテストのように凍らせる。
    const before: Connecting = { kind: 'connecting', attempt: 1 };
    // @ts-expect-error readonly の項目は書き換えられない
    before.attempt = 2;
    expect(before.attempt).toBe(2);
    // 差し替えるときは、新しい値を作る。
    const after: Connecting = { ...before, attempt: 3 };
    expect(after.attempt).toBe(3);
  });

  it('使い回す状態は凍らせてあるので、実行時にも書き換えられない', () => {
    // readonly は型検査だけの約束。凍らせていないと、型をすり抜けた書き換えが
    // 使い回している全員の状態を変える。
    const writable = IDLE as { kind: string };
    expect(() => {
      writable.kind = 'closed';
    }).toThrow(TypeError);
    expect(IDLE.kind).toBe('idle');
  });
});

describe('assertNever', () => {
  it('型をすり抜けた値が届いたら、その値を知らせて止まる', () => {
    // 外から読み込んだ値など、型の上では届かないはずの状態が実行時に来た場合。
    const unknown = { kind: 'reconnecting' } as unknown as Connection;
    expect(() => label(unknown)).toThrow('扱っていない状態: {"kind":"reconnecting"}');
  });

  it('JSON にできない値でも、別の例外を投げずに知らせる', () => {
    // 知らせを作るところで別の例外が出ると、本当に知らせたいことが隠れる。
    const cyclic: Record<string, unknown> = { kind: 'cyclic' };
    cyclic['self'] = cyclic;
    expect(() => assertNever(cyclic as never)).toThrow('扱っていない状態: [object Object]');
    expect(() => assertNever(10n as never)).toThrow('扱っていない状態: 10');
    expect(() => assertNever(undefined as never)).toThrow('扱っていない状態: undefined');
    const bare: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    bare['self'] = bare;
    expect(() => assertNever(bare as never)).toThrow('扱っていない状態: [object Object]');
  });
});
