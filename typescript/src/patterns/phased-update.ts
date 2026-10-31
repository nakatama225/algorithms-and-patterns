/**
 * 二段の更新 — 同じ番のものをすべて進めてから、後の処理を呼ぶ。
 *
 * たくさんのものを1刻みずつ進めるとき、1つずつ「進めてすぐ後の処理（ぶつかったかを見る、など）」を
 * 呼ぶと、先に呼んだものの後の処理が、まだ進んでいないものの古い位置を読む。逆に、あとから進むものの
 * 進める処理が、先に呼んだ後の処理の結果を読むこともある。そこで、同じ番のものをすべて進めてから、
 * 後の処理を呼ぶ。
 *
 * 進める順と、並びの順を分ける。進める順は、呼ぶ側が渡す鍵（番, 番の中の順）で決める。返す並びは、
 * 呼んだ時点の並びの順のまま（状態の要約に混ぜる順などを、進める順で変えない）。
 *
 * 並びは呼んだ時点で写し、写した並びの位置（添字）で扱う。同じものかを比べないので、等しい値が
 * 2つ並んでも別々に進み、片方だけが役目を終えても、もう片方は残る。進めている間に呼ぶ側が自分の
 * 並びへ足したものは、この関数からは見えない。進めず、後の処理も呼ばず、返り値にも含めない。
 * 後ろに付けるのは呼ぶ側の仕事になる。
 *
 * 後の処理が無く、進める処理が並びのほかのものの進めた結果を読まず、起きたことも返さないなら、
 * どの順に進めても結果は同じで、ふつうの for 文で足りる。後の処理が並びのほかのものの進めた結果を
 * 読むか、後の処理が変えた値を、並びのほかのものの進める処理が読むなら、進める処理どうしが互いを
 * 読まなくても、二段に分けることは要る。番の中の順は、同じ番の進める処理が互いの進めた結果を読まず、
 * 起きたことも返さないなら、結果に影響しない。
 */

/**
 * 1つと、その並びの位置（添字）から、進める順の鍵（番, 番の中の順）を返す関数。
 *
 * 番の小さい順に進め、同じ番の中は2つ目の小さい順に進める。新しく並んだものから進めるなら、
 * 2つ目に位置の符号を反転した値（`-index`）を返す。鍵がまったく同じものどうしは、並びの順に進める。
 * どちらも整数にする。
 */
export type Order<T> = (item: T, index: number) => readonly [phase: number, within: number];

/**
 * 1つを1刻み進め、その刻みで役目を終えたかを返す関数。終えたら true。
 *
 * true を返したものは返り値の並びから外し、後の処理（`Settle`）も呼ばない。
 */
export type Advance<T> = (item: T) => boolean;

/**
 * 同じ番のものがすべて進んだあとに、役目を終えなかったものそれぞれに呼ぶ関数。
 *
 * 返り値は使わない。void を返す関数の型は値を返す関数も受け付けるので、後の処理が起きたことの
 * 列を返しても型検査は止めず、その列は黙って捨てられる。起きたことを返すなら、呼ぶ側で包み、
 * 自分の列に足す。
 */
export type Settle<T> = (item: T) => void;

/** 写した並びの1つと、その位置と、進める順の鍵。 */
interface Due<T> {
  readonly item: T;
  readonly index: number;
  readonly phase: number;
  readonly within: number;
}

/**
 * 並びを番の小さい順に1刻み進め、役目を終えなかったものを、元の順で返す。
 *
 * 番ごとに、その番のものをすべて進めてから、役目を終えなかったものの `settle` を並びの順
 * （古いものから）に呼び、次の番へ移る。番の中を新しいものから進めても、`settle` は並びの順に呼ぶ。
 *
 * `picks` と `order` は、何も進める前に、1つにつき1度ずつ呼ぶ（`order` は選んだものだけ）。
 * 進めている間に変わる値で鍵が変わることはない。
 *
 * 呼んだ並びは書き換えない。`order`・`picks`・`advance`・`settle` が例外を出すと、そのまま呼ぶ側へ
 * 伝わり、それまでに役目を終えたものも呼ぶ側の並びに残る。
 *
 * @param items 進めるものの並び。呼んだ時点で写す
 * @param order 進める順の鍵を返す関数（`Order`）
 * @param advance 1刻み進め、役目を終えたら true を返す関数（`Advance`）
 * @param settle 同じ番のものがすべて進んだあとに呼ぶ関数（`Settle`）
 * @param picks この呼び出しで進めるものを選ぶ関数。選ばなかったものは進めず、`settle` も呼ばず、
 *   返り値の元の位置に残す。省くと、すべてを進める
 * @returns 役目を終えなかったものと、選ばなかったもの。呼んだ時点の並びの順。進めている間に
 *   呼ぶ側が足したものは含まないので、呼ぶ側が後ろに付ける。呼んでいる間、呼ぶ側の配列の後ろに
 *   足すだけなら、呼ぶ前の長さを `n` として `[...kept, ...items.slice(n)]` で付けられる。外したり
 *   途中に差し込んだりすると、`items.slice(n)` が増えたものと合わなくなる
 * @throws RangeError `order` が返した番か番の中の順が整数でないとき。何も進める前に止める。
 *   NaN を受け付けると、比べる関数が大小を答えられず、並べる順が実装任せになる
 */
export function advanceInPhases<T>(
  items: readonly T[],
  order: Order<T>,
  advance: Advance<T>,
  settle: Settle<T>,
  picks?: (item: T) => boolean,
): T[] {
  const snapshot = [...items];
  const due: Due<T>[] = [];
  snapshot.forEach((item, index) => {
    if (picks !== undefined && !picks(item)) return;
    // 鍵は1度ずつ求めてから並べる。比べる関数の中で求めると、1つにつき何度も呼ぶ。
    const [phase, within] = order(item, index);
    if (!Number.isInteger(phase) || !Number.isInteger(within)) {
      throw new RangeError(`進める順の鍵は整数の組: ${String(phase)}, ${String(within)}（${index} 番目）`);
    }
    due.push({ item, index, phase, within });
  });
  // sort は写しに当てる（ES2022 の型に toSorted は無い）。sort は安定なので、鍵が同じものは並びの順のまま。
  due.sort((a, b) => compare(a.phase, b.phase) || compare(a.within, b.within));
  const finished = new Set<number>();
  for (const group of samePhaseGroups(due)) {
    for (const { item, index } of group) {
      if (advance(item)) finished.add(index);
    }
    for (const { item, index } of [...group].sort((a, b) => compare(a.index, b.index))) {
      if (!finished.has(index)) settle(item);
    }
  }
  return snapshot.filter((_, index) => !finished.has(index));
}

/** 数の大小を比べる関数の答え。整数だけを受け取る。 */
function compare(a: number, b: number): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** 番の順に並べた列を、同じ番のものごとに区切る。区切った中の並びは保つ。 */
function samePhaseGroups<T>(sorted: readonly Due<T>[]): Due<T>[][] {
  const groups: Due<T>[][] = [];
  for (const entry of sorted) {
    const group = groups.at(-1);
    if (group?.[0]?.phase === entry.phase) group.push(entry);
    else groups.push([entry]);
  }
  return groups;
}
