/**
 * 連鎖の一括処理と最も早い時刻 — 届く関係に沿って、発火を尽きるまでまとめて広げる。
 *
 * 要素の1つが発火する（その要素の処理が起きる）と、そこから届く要素も同じ時刻に発火し、
 * さらにその先へも広がる、という連鎖を扱う。要素は 0 から始まる添字で表し、どの要素から
 * どの要素へ届くかは、添字を受けて届く相手の添字を返す関数（`reaches`）で渡す。
 *
 * - `cascade`：起点から連鎖が尽きるまでたどり、発火した要素を、発火する順に1度ずつ返す
 * - `earliestTimes`：要素ごとに自分で発火する時刻を持つとき、発火が起きる前に、それぞれが
 *   実際に発火する最も早い時刻を見積もる。`cascade` と同じたどり方（`spread`）を使うので、
 *   時刻の見積もりと実際の連鎖が、同じ届く関係と同じたどり方で決まる
 *
 * 計算は、添字の比べと時刻の比べだけで書く。時刻は足し引きせず、渡した値をそのまま返す。
 * 固定値の表は持たず、約束は「同じ入力から、起動のたびに同じ結果を出す」だけ（README の
 * 「決定性を崩す書き方の検査」）。印は添字で読み書きする `Uint8Array` で持つ。
 * Python 版（`python/src/algorithms_and_patterns/lib/cascade.py`）も同じ形。
 *
 * TypeScript の number は整数と小数を区別しないので、要素の数・起点・`reaches` が返す添字が
 * 安全な整数（絶対値が 2**53 未満の整数）かを実行時に確認する。小数の起点は範囲の確認を
 * 通り（0 ≤ 0.5 < 3）、`Uint8Array` の小数の添字は読むと undefined で、書いても要素に
 * ならないので、印が付かないまま積まれる。Python 版は int の型で受けるので、型検査に任せている。
 */

import { checkInteger } from './safe-integer.js';

/** 添字を受けて、その要素が発火したときに届く相手の添字を返す関数。 */
export type Reaches = (index: number) => Iterable<number>;

/**
 * 起点から連鎖が尽きるまでたどり、発火した要素を発火する順に1度ずつ返す。
 *
 * 待ち行列でたどり、積むときに印を付ける。取り出すときに付けると、2つの経路から届いた
 * 要素を2度積み、2度処理する。同じ要素へいくつもの経路で届く形、輪、自分自身へ届く形でも、
 * 1度ずつで止まる。
 *
 * - 起点を渡した順に先に積み、そのあとは積んだ順にたどる。返す順は、起点から何回届いて
 *   発火したか（段）の小さい順で、同じ段の中は積んだ順
 * - `reaches` は、発火した要素にだけ、返す順に1度ずつ呼ぶ
 * - 重なった起点は1度だけ発火する
 *
 * @param count 要素の数。0 以上の安全な整数
 * @param starts 起点の添字。たどり始める前に、すべての範囲を見る
 * @param reaches 届く相手を返す関数
 * @returns 発火した要素の添字。発火する順
 * @throws RangeError `count` が 0 以上の安全な整数でないとき、起点か `reaches` が返した添字が
 *   0 以上 `count` 未満の安全な整数でないとき
 */
export function cascade(count: number, starts: Iterable<number>, reaches: Reaches): number[] {
  checkInteger('要素の数', count);
  if (count < 0) {
    throw new RangeError(`要素の数は 0 以上にする: ${count}`);
  }
  const first = [...starts];
  for (const start of first) checkIndex('起点', start, count);
  return spread(new Uint8Array(count), first, reaches);
}

/**
 * 要素ごとの時刻から、連鎖を考えた、それぞれが実際に発火する最も早い時刻を求める。
 *
 * 要素は自分の時刻に発火し、届いた相手は同じ時刻に発火する。添字を時刻の小さい順に並べ
 * （同じ時刻なら添字の小さい順）、まだ発火していない要素から `cascade` と同じたどり方を当て、
 * 届いた要素にその時刻を入れる。
 *
 * 印は、起点を替えても1組だけを使う。前の起点の連鎖で時刻の決まった要素は、印があるので
 * 積まれず、その先もたどり直さない。小さい時刻から決めるので、あとから届く遅い時刻が、
 * 決まった時刻を書き換えることもない。起点ごとに新しい印で `cascade` を呼ぶ形にすると、
 * 決まった要素の先を毎回たどり直し、遅い起点から早い起点へ届く形で、早いほうの時刻が
 * 遅いほうに書き換わる。
 *
 * - 時刻が `Infinity` の要素は、自分では発火しない。ほかから届いたときだけ時刻が入り、
 *   どこからも届かなければ `Infinity` のまま
 * - 負の時刻と `-Infinity` も受ける。比べるだけで足し引きしないので、どの値でも意味が
 *   変わらない
 * - `reaches` は、発火した要素にだけ1度ずつ呼ぶ
 *
 * @param times 要素ごとの、自分で発火する時刻。単位は問わない
 * @param reaches 届く相手を返す関数
 * @returns 要素ごとの、最も早く発火する時刻。どれも `times` のどれかの値そのもの。
 *   `times` は書き換えない
 * @throws RangeError 時刻に NaN があるとき（大小を比べるとどれも偽になり、並べた順が
 *   決まらない）、または `reaches` が返した添字が範囲の外か安全な整数でないとき
 */
export function earliestTimes(times: readonly number[], reaches: Reaches): number[] {
  for (let index = 0; index < times.length; index += 1) {
    // 空きのある配列（[1, , 2]）の空きも、NaN と同じく止める。
    if (Number.isNaN(times[index] ?? NaN)) {
      throw new RangeError(`時刻が NaN: ${index} 番目`);
    }
  }
  const result = [...times];
  const fired = new Uint8Array(times.length);
  // 配列の sort は ES2019 から安定なので、同じ時刻なら添字の小さい順。答えは順によらないが、
  // reaches を呼ぶ順を決めておく。時刻の差（times[a] - times[b]）で比べても無限大どうしは
  // 等しいとされるが、比べる関数が NaN を返したときの扱いに頼らないよう、大小を直に比べる。
  const order = [...times.keys()].sort((a, b) => {
    const [early, late] = [times[a] as number, times[b] as number];
    return early < late ? -1 : early > late ? 1 : 0;
  });
  for (const index of order) {
    const time = times[index] as number;
    // 残りはどれも無限大で、自分では発火しない。
    if (time === Infinity) break;
    for (const reached of spread(fired, [index], reaches)) result[reached] = time;
  }
  return result;
}

/**
 * 印のまだ無い起点から連鎖をたどり、新しく発火した要素を発火する順に返す。
 *
 * `fired` に印を付けていく。呼ぶ側が同じ `fired` を渡し続ければ、前の呼び出しで発火した
 * 要素は積まず、その先もたどらない。起点は範囲の中のものだけを渡す。
 *
 * 返す配列をそのまま待ち行列にし、先頭の添字を進めて読む（配列の shift は残りを前へ詰める
 * ので、要素が多いと遅い）。積んだ順が、そのまま発火する順になる。
 */
function spread(fired: Uint8Array, starts: readonly number[], reaches: Reaches): number[] {
  const order: number[] = [];
  for (const start of starts) {
    if (fired[start] === 1) continue;
    fired[start] = 1;
    order.push(start);
  }
  for (let head = 0; head < order.length; head += 1) {
    const index = order[head] as number;
    for (const target of reaches(index)) {
      checkIndex(`${index} から届く相手`, target, fired.length);
      if (fired[target] === 1) continue;
      fired[target] = 1;
      order.push(target);
    }
  }
  return order;
}

/** 添字が 0 以上 `count` 未満の安全な整数かを確認する。 */
function checkIndex(name: string, index: number, count: number): void {
  checkInteger(name, index);
  if (index < 0 || index >= count) {
    throw new RangeError(`${name}が範囲の外: ${index}（要素の数 ${count}）`);
  }
}
