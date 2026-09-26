/**
 * Command — 「何をするか」を、実行する処理から切り離して値として渡す。
 *
 * 1歩ずつ進む処理が、歩ごとに「この歩では何をするか」を命令の出どころ
 * （`CommandSource`）に尋ねる。処理の側は、出どころの正体を知らない。
 * 人の操作・自動の判断・記録の再生・通信で届いた命令が、同じ資格で並ぶ。
 *
 * 命令が値なので、記録と再生は部品を1つ挟むだけで作れる。
 *
 * - 記録する … 出どころを `RecordingSource` で包む。包まれた側は、記録されていることを知らない
 * - 再生する … 出どころを `ReplaySource` に差し替える。処理の側は1行も変わらない
 *
 * ⚠️ 再生して同じ結果になるのは、次の2つが守られているときだけ。
 *
 * 1. 出どころは状態を読むだけで、書き換えない。命令を返す前に状態が変わると、
 *    記録した命令を流し直しても同じ状態にならない
 * 2. 処理の側は、同じ状態と同じ命令から必ず同じ次の状態を作る。
 *    内側で乱数や時刻を引くと、記録に残らない入力が混ざる
 */

/** 1歩ごとに命令を返すもの。 */
export interface CommandSource<S, C> {
  /**
   * `step` 歩目に実行する命令を返す。
   *
   * @param step 何歩目か。処理の側が 0 から数えて渡す。
   *   状態の中に持っている時刻で代用しない。状態を作り直すと時刻が 0 に戻る作りだと、
   *   同じ番号が2度渡され、記録がそこで例外になって止まる
   * @param view いまの状態。読むだけで、書き換えない
   *
   * ⚠️ メソッドの形（`commandAt(step, view): C`）ではなく、関数を持つ項目の形で書いている。
   * メソッドの形だと、TypeScript は引数の型の向きを検査しない。より多くを知っている状態を
   * 前提にした出どころ（例：`view.label` を読む）を、それを持たない状態の処理へ渡しても
   * 型エラーにならず、実行して初めて落ちる。
   */
  readonly commandAt: (step: number, view: Readonly<S>) => C;
}

/** 記録の1件。`step` 歩目から、命令が `command` に変わった。 */
export interface CommandChange<C> {
  readonly step: number;
  readonly command: C;
}

/**
 * 命令の記録。命令が変わった歩だけを持つ。
 *
 * 同じ命令が続く間は何も足さない。ある歩の命令は「その歩か、それより前で
 * 最後に変わったときの命令」として引く。押しっぱなしの操作のように、
 * 変わる回数が歩の数よりずっと少ない命令では、記録が小さくなる。
 */
export class CommandLog<C> {
  readonly #idle: C;
  readonly #equals: (a: C, b: C) => boolean;
  /** 変わった歩。昇順に並ぶ。`#commands` と同じ位置どうしが対になる。 */
  readonly #steps: number[] = [];
  readonly #commands: C[] = [];
  #lastStep = -1;

  /**
   * @param idle 最初に命令が変わるより前の歩に返す、何もしない命令
   * @param equals 2つの命令が同じかを判定する。既定は `Object.is`。
   *   オブジェクトどうしなら「同じものか」を比べるので、命令をオブジェクトで表すなら、
   *   中身で比べる関数を渡す。渡さないと、中身が同じでも別に作ったものは
   *   「変わった」とみなし、記録が小さくならない
   */
  constructor(idle: C, equals: (a: C, b: C) => boolean = Object.is) {
    this.#idle = idle;
    this.#equals = equals;
  }

  /**
   * 最後に記録を受け付けた歩。まだ無ければ -1。
   *
   * 命令が変わらず記録を増やさなかった歩も含む。記録より長く再生すると最後の命令が
   * 続くので、`entries()` と一緒に保存しておくと、何歩ぶん再生すればよいかが分かる。
   */
  get lastStep(): number {
    return this.#lastStep;
  }

  /**
   * `step` 歩目の命令を記録する。直前と同じ命令なら何も足さない。
   *
   * @throws RangeError `step` が 0 以上の整数でないとき、または前回の記録より進んでいないとき。
   *   同じ歩を2度記録すると、どちらが正しいのかが記録から分からなくなる
   */
  record(step: number, command: C): void {
    checkStep(step);
    if (step <= this.#lastStep) {
      throw new RangeError(`歩が進んでいない: ${this.#lastStep} 歩目のあとに ${step} 歩目`);
    }
    this.#lastStep = step;
    if (this.#equals(this.#latest(), command)) return;
    this.#steps.push(step);
    this.#commands.push(command);
  }

  /**
   * `step` 歩目の命令を返す。最初に変わるより前なら、何もしない命令を返す。
   *
   * @throws RangeError `step` が 0 以上の整数でないとき
   */
  at(step: number): C {
    checkStep(step);
    // 記録は昇順なので、二分探索で「step 以下で最後に変わった位置」を探す。
    let low = 0;
    let high = this.#steps.length - 1;
    let found = -1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      if ((this.#steps[mid] as number) <= step) {
        found = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return found < 0 ? this.#idle : (this.#commands[found] as C);
  }

  /**
   * 変わった歩と命令の一覧。
   *
   * 返した配列を書き換えても、記録は変わらない。中の命令そのものは記録と共有しているので、
   * 命令を書き換えられるオブジェクトで表すなら、書き換えないこと。
   */
  entries(): CommandChange<C>[] {
    return this.#steps.map((step, i) => ({ step, command: this.#commands[i] as C }));
  }

  /** いま有効な命令。まだ何も変わっていなければ、何もしない命令。 */
  #latest(): C {
    const last = this.#commands.length - 1;
    return last < 0 ? this.#idle : (this.#commands[last] as C);
  }
}

/**
 * 記録した命令を流す出どころ。
 *
 * 状態を見ずに、歩の番号だけで命令を決める。だから、記録したときと同じ状態から
 * 始めれば、同じ命令が同じ順に流れる。状態の型を `unknown` にしてあるので、
 * どの状態を扱う処理にも差し込める。
 */
export class ReplaySource<C> implements CommandSource<unknown, C> {
  readonly #log: CommandLog<C>;

  constructor(log: CommandLog<C>) {
    this.#log = log;
  }

  commandAt(step: number): C {
    return this.#log.at(step);
  }
}

/**
 * 流れた命令を記録しながら、包んだ出どころの命令をそのまま返す。
 *
 * 包まれる側は、記録されていることを知らない。記録の有無で振る舞いを変える
 * 分岐が、どの出どころにも要らない。
 */
export class RecordingSource<S, C> implements CommandSource<S, C> {
  readonly #inner: CommandSource<S, C>;
  readonly #log: CommandLog<C>;

  constructor(inner: CommandSource<S, C>, log: CommandLog<C>) {
    this.#inner = inner;
    this.#log = log;
  }

  commandAt(step: number, view: Readonly<S>): C {
    const command = this.#inner.commandAt(step, view);
    this.#log.record(step, command);
    return command;
  }
}

/**
 * 歩の番号が 0 以上の整数かを確かめる。
 *
 * TypeScript の number は整数と小数を区別しないので、型検査では止まらない。
 * 小数の歩を受け付けると、`at(2.5)` が 2 歩目の命令を黙って返す。
 */
function checkStep(step: number): void {
  if (!Number.isInteger(step) || step < 0) {
    throw new RangeError(`歩の番号は 0 以上の整数: ${step}`);
  }
}
