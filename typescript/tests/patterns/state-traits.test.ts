import { describe, expect, it } from 'vitest';

/*
 * State に足すもの：種類ごとの性質の表。共通の処理は、状態の種類ではなく性質だけを見る。
 *
 * state.test.ts から分けた。状態の表し方の約束と、共通の処理が性質だけを見る使い方は、
 * 別の理由で変わる。src/ に部品は無い。表は Record と satisfies だけで書ける。
 *
 * 送る・受け取る・後始末のように、状態の種類で答えが変わる処理がいくつもあると、種類で
 * 振り分ける分岐がその処理ごとに散らばり、種類を1つ足すたびに、その全部に書き足す。
 * ここでは種類ごとの性質を1つの表に集め、共通の処理は表の性質だけを見る。種類を足すときに
 * 書くのは表の1行で、書き忘れは型検査が見つける。
 */

/** 見本の状態。接続の状態を、閉じている途中まで分けて表す。 */
interface Connecting {
  readonly kind: 'connecting';
  /** 何回目の試行か。 */
  readonly attempt: number;
}
interface Open {
  readonly kind: 'open';
}
/** 閉じている途中。こちらからは送らないが、相手が送り終えるまでは受け取る。 */
interface Closing {
  readonly kind: 'closing';
}
interface Closed {
  readonly kind: 'closed';
  /** 切れた理由。 */
  readonly reason: string;
}
type Connection = Connecting | Open | Closing | Closed;

/** 共通の処理が見る性質。処理はこれだけを見て、種類を見ない。 */
interface Traits {
  /** 新しく送ってよいか。 */
  readonly canSend: boolean;
  /**
   * 届いたものを受け取るか。
   *
   * 送れるかと1つにまとめない。閉じている途中は、送らないが受け取る。まとめると、
   * 閉じている途中の振る舞いが必ずどちらかで壊れる。
   */
  readonly canReceive: boolean;
  /** 終えるときに、つないだものを閉じる後始末が要るか。 */
  readonly needsCleanup: boolean;
}

/** 種類ごとの性質。種類を足すと、ここに1行足すまで `satisfies` の行が型エラーになる。 */
const TRAITS = {
  connecting: { canSend: false, canReceive: false, needsCleanup: true },
  open: { canSend: true, canReceive: true, needsCleanup: true },
  closing: { canSend: false, canReceive: true, needsCleanup: true },
  closed: { canSend: false, canReceive: false, needsCleanup: false },
} as const satisfies Record<Connection['kind'], Traits>;

/** 状態の性質。種類で振り分けるのは、ここ1か所だけ。 */
function traitsOf(state: Connection): Traits {
  return TRAITS[state.kind];
}

/** 送りたいものと届いたもののうち、いまの状態で実際に送るものと受け取るもの。 */
function exchange(
  state: Connection,
  outgoing: readonly string[],
  incoming: readonly string[],
): { readonly sent: readonly string[]; readonly received: readonly string[] } {
  const traits = traitsOf(state);
  return {
    sent: traits.canSend ? [...outgoing] : [],
    received: traits.canReceive ? [...incoming] : [],
  };
}

/** 終えるときに後始末が要る接続。並びの順を保つ。 */
function needingCleanup(states: readonly Connection[]): Connection[] {
  return states.filter((state) => traitsOf(state).needsCleanup);
}

const CONNECTING: Connecting = { kind: 'connecting', attempt: 1 };
const OPEN: Open = { kind: 'open' };
const CLOSING: Closing = { kind: 'closing' };
const CLOSED: Closed = { kind: 'closed', reason: '時間切れ' };

describe('種類ごとの性質の表', () => {
  it.each([
    ['つなごうとしている', CONNECTING, [], []],
    ['つながっている', OPEN, ['送る'], ['届いた']],
    ['閉じている途中', CLOSING, [], ['届いた']],
    ['切れた', CLOSED, [], []],
  ] as const)('共通の処理は、性質だけで答える：%s', (_name, state, sent, received) => {
    expect(exchange(state, ['送る'], ['届いた'])).toEqual({ sent, received });
  });

  it('後始末が要る接続を、性質だけで選ぶ', () => {
    const states = [CLOSED, OPEN, CONNECTING, CLOSING, CLOSED];
    expect(needingCleanup(states)).toEqual([OPEN, CONNECTING, CLOSING]);
    expect(needingCleanup([])).toEqual([]);
    expect(needingCleanup([CLOSED])).toEqual([]);
  });

  it('似た性質を1つにまとめない：閉じている途中は、送らないが受け取る', () => {
    // 送れるかと受け取るかが分かれるのは、閉じている途中だけ。1つの真偽値にまとめると、
    // 届いたものを捨てるか、閉じている途中に送るか、どちらかになる。
    expect(traitsOf(CLOSING)).toEqual({ canSend: false, canReceive: true, needsCleanup: true });
    expect(exchange(CLOSING, ['送る'], ['届いた'])).toEqual({ sent: [], received: ['届いた'] });
  });

  it('種類を1つ書き忘れると、型検査が止める', () => {
    // 表の鍵の集合を union の種類から導いているので、種類を足すと表の書き忘れが型エラーになる。
    // 型エラーは satisfies を書いた行に出る。止めなくなると、@ts-expect-error が使われていないとして
    // 型検査が失敗する。
    const forgetful = {
      connecting: { canSend: false, canReceive: false, needsCleanup: true },
      open: { canSend: true, canReceive: true, needsCleanup: true },
      closing: { canSend: false, canReceive: true, needsCleanup: true },
      // @ts-expect-error closed の性質を書いていない
    } as const satisfies Record<Connection['kind'], Traits>;
    expect(Object.keys(forgetful)).toEqual(['connecting', 'open', 'closing']);
  });

  it('無い種類の名前を書くと、型検査が止める', () => {
    // 種類の名前の書き間違いも、その行で止まる。
    const misspelled = {
      connecting: { canSend: false, canReceive: false, needsCleanup: true },
      // @ts-expect-error opne という種類は無い
      opne: { canSend: true, canReceive: true, needsCleanup: true },
      open: { canSend: true, canReceive: true, needsCleanup: true },
      closing: { canSend: false, canReceive: true, needsCleanup: true },
      closed: { canSend: false, canReceive: false, needsCleanup: false },
    } as const satisfies Record<Connection['kind'], Traits>;
    expect(Object.keys(misspelled)).toHaveLength(5);
  });
});
