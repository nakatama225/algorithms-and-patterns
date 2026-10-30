/**
 * Command の出どころを組み立てる部品。いくつかを合わせる形と、途中で替える形。
 *
 * どちらも出どころ（`CommandSource`）を受け取り、それ自身も出どころとして振る舞う。
 * 処理の側から見ると出どころは1つのままなので、処理の側は変わらない。
 *
 * - 合わせる … `CombinedSource`。並びの出どころ全部に毎歩聞き、受け取った合わせ方で1つの命令にする
 * - 途中で替える … `HandoverSource`。替わる歩を決めて持つ記録（`Handover`）を読み、決まった歩の次から、
 *   代わりの出どころに任せる。代わりは初めて任せる歩で1度だけ作る
 *
 * 記録と再生（`command.ts`）とはファイルを分けた。記録と再生の約束と、出どころの組み立て方は、
 * 別の理由で変わる。
 */

import type { CommandSource } from './command.js';

/**
 * いくつかの出どころの命令を、1つに合わせる出どころ。
 *
 * 毎歩、並びの順に全部の出どころに聞いてから、`combine` で合わせる。途中で答えが決まっても
 * 打ち切らない。前の歩を覚えている出どころは、聞かれなかった歩のぶん覚えている内容が古くなり、
 * 次に聞かれたときにずれる。記録する出どころ（`RecordingSource`）なら、その歩の記録が抜ける。
 *
 * 合わせ方は呼ぶ側が渡す。たとえば真偽の組なら、項目ごとの OR で「どれかの出どころが真なら真」に
 * できる。同じ出どころを2度並べると、1歩に2度聞く（重なりを見分けない）。
 */
export class CombinedSource<S, C> implements CommandSource<S, C> {
  readonly #sources: readonly CommandSource<S, C>[];
  readonly #combine: (commands: readonly C[]) => C;

  /**
   * @param sources 合わせる出どころ。並びの順に聞く。写して持つので、渡した配列をあとで
   *   書き換えても、合わせる出どころは変わらない
   * @param combine 聞いた命令を、並びの順のまま受け取って1つにする
   * @throws RangeError 出どころが1つも無いとき。出どころを繋ぎ忘れたまま、空の並びを合わせた
   *   命令（真偽の組の OR なら、全部が偽）で黙って進めない
   */
  constructor(sources: readonly CommandSource<S, C>[], combine: (commands: readonly C[]) => C) {
    if (sources.length === 0) throw new RangeError('合わせる出どころが無い');
    this.#sources = [...sources];
    this.#combine = combine;
  }

  commandAt(step: number, view: Readonly<S>): C {
    // 全部に聞き終えてから合わせる。some のように、答えが決まった所で打ち切る書き方にしない。
    const commands = this.#sources.map((source) => source.commandAt(step, view));
    return this.#combine(commands);
  }
}

/**
 * 出どころが途中で替わる歩を、1度だけ決めて持つ記録。
 *
 * 前の出どころを最後に使う歩（`after`）を持ち、その次の歩から「替わった」と答える。
 * 替わったかの判定（`replacedAt`）はここ1か所にあり、`HandoverSource` はこれを読むだけで、
 * 替わる歩を自分では持たない。届いた命令で進める側と、保存した記録を再生する側に同じ歩を
 * 決めた記録を渡せば、どちらも同じ判定で同じ歩に替わる。保存するときは、命令の記録と一緒に
 * `after` を残す。
 *
 * 決めるのは1度だけ。2度目を受け付けて上書きすると、先に読んだ側と後で読んだ側で替わる歩が
 * 食い違いうる。判定は「決めた歩より後か」だけなので、一度替わったら元には戻らない。
 */
export class Handover {
  #after: number | undefined;

  /** 前の出どころを最後に使う歩。まだ決めていなければ undefined。 */
  get after(): number | undefined {
    return this.#after;
  }

  /**
   * `step` 歩目まで前の出どころを使い、次の歩から代わりに任せると決める。
   *
   * @param step 前の出どころを最後に使う歩。-1 なら、0 歩目から代わりに任せる
   * @throws RangeError `step` が -1 以上の整数でないとき
   * @throws Error もう決めてあるとき（同じ歩でも）。断ったときは、決めてある歩を変えない
   */
  handOverAfter(step: number): void {
    if (!Number.isInteger(step) || step < -1) {
      throw new RangeError(`前の出どころを最後に使う歩は -1 以上の整数: ${step}`);
    }
    if (this.#after !== undefined) {
      throw new Error(`替わる歩はもう決めてある: ${this.#after} 歩目のあと`);
    }
    this.#after = step;
  }

  /**
   * `step` 歩目が、代わりの出どころに任せる歩か。
   *
   * @throws RangeError `step` が 0 以上の整数でないとき。数え間違いの歩に、替わった・替わって
   *   いないのどちらで答えても、誤りが黙って先へ進む
   */
  replacedAt(step: number): boolean {
    if (!Number.isInteger(step) || step < 0) {
      throw new RangeError(`歩の番号は 0 以上の整数: ${step}`);
    }
    return this.#after !== undefined && step > this.#after;
  }
}

/**
 * 記録（`Handover`）が決めた歩の次から、代わりの出どころに任せる出どころ。
 *
 * 替わる歩より前は、前の出どころ（`first`）に聞く。替わる歩からは、代わりの出どころに聞く。
 * 代わりは、初めて任せる歩で `makeNext` を呼んで1度だけ作り、それより前には作らない。
 * 作り直すと、代わりの出どころが覚えている内容（前の歩までの判断）を失う。
 *
 * 処理の側が替わる歩でこの出どころに聞かなければ、代わりを作るのはそれより後の歩になる。
 * 作るときに状態を読まない出どころなら、作る歩がずれても同じ命令を返す。
 *
 * 替わる歩は自分では持たず、毎歩、記録の判定を読む。前の出どころで答えた歩より前を替わる歩に
 * 決めると、その歩を、同じ記録を再生する側は代わりに任せるので、2つの側がずれる。これは、
 * 次に替わったあとの歩を聞かれたときに見つけて止める。前の出どころが例外を出した歩（届いていない
 * 歩を読んだ、など）は、答えた歩に数えない。
 */
export class HandoverSource<S, C> implements CommandSource<S, C> {
  readonly #first: CommandSource<S, C>;
  readonly #makeNext: () => CommandSource<S, C>;
  readonly #handover: Handover;
  #next: CommandSource<S, C> | undefined;
  /** 前の出どころで答えた最後の歩。まだ無ければ -1。 */
  #firstUsedThrough = -1;

  /**
   * @param first 替わる歩より前に任せる出どころ
   * @param makeNext 代わりの出どころを作る関数。届いた命令で進める側と、記録を再生する側に、
   *   同じ出どころを作るものを渡す
   * @param handover 替わる歩を決めて持つ記録
   */
  constructor(first: CommandSource<S, C>, makeNext: () => CommandSource<S, C>, handover: Handover) {
    this.#first = first;
    this.#makeNext = makeNext;
    this.#handover = handover;
  }

  /**
   * `step` 歩目の命令を、前の出どころか代わりの出どころに聞いて返す。
   *
   * @throws RangeError `step` が 0 以上の整数でないとき（`Handover.replacedAt`）
   * @throws Error 前の出どころで答えた歩が、いまの記録では替わったあとの歩になっているとき。
   *   替わる歩を、答えた歩より前に決めた
   */
  commandAt(step: number, view: Readonly<S>): C {
    if (!this.#handover.replacedAt(step)) {
      // 命令を受け取ってから数える。前の出どころが例外を出した歩（届いていない歩を読んだ、など）は
      // 答えていないので、そのあとで決めた歩の検査に使わない。
      const command = this.#first.commandAt(step, view);
      this.#firstUsedThrough = Math.max(this.#firstUsedThrough, step);
      return command;
    }
    const used = this.#firstUsedThrough;
    if (used >= 0 && this.#handover.replacedAt(used)) {
      throw new Error(
        `前の出どころで ${used} 歩目まで答えたあとで、${String(this.#handover.after)} 歩目のあとで替わると決まった`,
      );
    }
    this.#next ??= this.#makeNext();
    return this.#next.commandAt(step, view);
  }
}
