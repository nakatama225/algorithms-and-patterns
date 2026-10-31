/**
 * 外から来た値の読み取り — JSON の項目を、型と範囲を見ながら取り出す。
 *
 * 通信で届いた文字列や保存した文字列のように、外から来た値を読む。合わない値は、既定値で埋めたり
 * 読み飛ばしたりせず、`ReadError` で止める。読み飛ばすと、足りない項目を待ったまま止まり、原因が
 * 別の所（通信が遅いなど）に見える。既定値で埋めると、同じ値から作るはずの結果が、読んだ側だけ
 * 違うものになる。
 *
 * - `parseJsonObject`：JSON の文字列を読み、外側がオブジェクトであることを見る
 * - `readInt`・`readFloat`・`readString`・`readArray`・`readObject`：項目を1つ、型（と整数は範囲）を
 *   見ながら取り出す。項目が無いときも止める
 * - `readChoice`：文字列の項目を、決めた文字列のどれかとして読む
 *
 * 余分な項目は読み飛ばす。止めるときの文は、どの項目かで始める（`count が無い`）。
 *
 * 10 進の整数を書いた文字列の読み取り（`parseDecimal`）は `decimal-text.ts` に置く。
 * 読んだ値は型と範囲を見て返すだけで（値を変えるのは、`readInt` が -0 を 0 にそろえることだけ）、
 * 固定値の表は持たず、約束は「同じ入力から、起動のたびに同じ結果を出す」だけ（README の「決定性を
 * 崩す書き方の検査」）。Python 版
 * （`python/src/algorithms_and_patterns/lib/strict_read.py`）も同じ形。
 */

import { checkInteger } from './safe-integer.js';

/** JSON のオブジェクトを読んだもの。項目の名前と、型をまだ見ていない値。 */
export type JsonObject = Readonly<Record<string, unknown>>;

/**
 * 外から来た値が、読む側の約束に合わない。文は、どの項目かで始める。
 *
 * 呼ぶ側の誤りに使う `RangeError`（ほかの `lib/` の部品と、この部品の `readInt` の範囲の引数）とは
 * 別にしている。外から来た値の誤りは、受け取った側で断って続けることがあり、呼ぶ側の誤りと同じ
 * `catch` で受けないようにする。
 */
export class ReadError extends Error {
  override readonly name = 'ReadError';
}

/**
 * JSON の文字列を読み、外側のオブジェクトを返す。
 *
 * `JSON.parse` は `1e400` のように小数の範囲を超える数を `Infinity` として読む（整数も小数として
 * 読むので、桁の多い整数も同じ）。どれも断る。
 *
 * @throws ReadError JSON として読めないとき、無限大になる数があるとき、外側がオブジェクトでないとき。
 *   入れ子が深すぎて読めないとき（`RangeError`）も、ReadError にする
 */
export function parseJsonObject(text: string): JsonObject {
  let data: unknown;
  try {
    data = JSON.parse(text, rejectInfinite);
  } catch (error) {
    const reason = error instanceof Error ? error.message : describe(error);
    throw new ReadError(`JSON として読めない: ${reason}`, { cause: error });
  }
  if (!isRecord(data)) throw new ReadError(`JSON の外側がオブジェクトでない: ${describe(data)}`);
  return data;
}

/** `JSON.parse` が値を1つ読むたびに呼ばれ、無限大になった数を断る。 */
function rejectInfinite(_key: string, value: unknown): unknown {
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new RangeError(`小数の範囲を超える数: ${value}`);
  }
  return value;
}

/** `readInt` の範囲。どちらも含む。 */
export interface IntRange {
  readonly minimum: number;
  readonly maximum: number;
}

/**
 * 整数の項目を、`minimum` 以上 `maximum` 以下で読む。
 *
 * 上限も必ず渡す。読む時点で上限を置かないと、受けた値を使う先（32 ビットの数を前提にした計算
 * など）で、別の例外として止まる。JSON の `-0` は 0 として返す（`Object.is` で比べると、-0 と 0 は
 * 別の値になる）。
 *
 * @throws ReadError 項目が無いとき、安全な整数（絶対値が 2**53 未満の整数）でないとき、範囲の外のとき
 * @throws RangeError `minimum` か `maximum` が安全な整数でないとき、`minimum` が `maximum` より大きいとき。
 *   呼ぶ側の誤りなので、ReadError にしない（外から来た値の誤りとして断って続けると、どの値も断り続ける）
 */
export function readInt(obj: JsonObject, key: string, range: IntRange): number {
  // NaN を渡すと大小の比べがどれも偽になり、どの値も範囲の内側に見える。
  checkInteger('最小', range.minimum);
  checkInteger('最大', range.maximum);
  if (range.minimum > range.maximum) {
    throw new RangeError(`範囲の最小は最大以下にする: ${range.minimum} > ${range.maximum}`);
  }
  const raw = field(obj, key);
  // 安全な整数より大きい数は、隣の整数と区別できない（9007199254740993 は 2**53 に丸まる）。
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw)) {
    throw new ReadError(`${key} が安全な整数でない: ${describe(raw)}`);
  }
  if (raw < range.minimum || raw > range.maximum) {
    throw new ReadError(`${key} が ${range.minimum} 以上 ${range.maximum} 以下でない: ${raw}`);
  }
  return raw === 0 ? 0 : raw;
}

/**
 * 数の項目を、有限の数として読む。
 *
 * @throws ReadError 項目が無いとき、数でないとき、NaN か無限大のとき
 */
export function readFloat(obj: JsonObject, key: string): number {
  const raw = field(obj, key);
  if (typeof raw !== 'number') throw new ReadError(`${key} が数でない: ${describe(raw)}`);
  if (!Number.isFinite(raw)) throw new ReadError(`${key} が有限の数でない: ${raw}`);
  return raw;
}

/**
 * 文字列の項目を読む。
 *
 * @throws ReadError 項目が無いとき、文字列でないとき
 */
export function readString(obj: JsonObject, key: string): string {
  const raw = field(obj, key);
  if (typeof raw !== 'string') throw new ReadError(`${key} が文字列でない: ${describe(raw)}`);
  return raw;
}

/**
 * 配列の項目を読み、要素を1つずつ `item` で読む。
 *
 * `item` には、この部品の読み取りの関数（`readString` や、範囲を決めた `readInt`）を渡す。要素は
 * `{ 'names[0]': 要素 }` のような1項目のオブジェクトに入れて渡すので、止めるときの文は `names[0]` で
 * 始まる。型を見ていない要素をそのまま返すと、使う側が要素を読む所で、同じ検査をもう一度書く。
 *
 * @throws ReadError 項目が無いとき、配列でないとき、`item` が要素を断ったとき
 */
export function readArray<T>(obj: JsonObject, key: string, item: (obj: JsonObject, key: string) => T): T[] {
  const raw = field(obj, key);
  if (!Array.isArray(raw)) throw new ReadError(`${key} が配列でない: ${describe(raw)}`);
  const elements: readonly unknown[] = raw;
  const result: T[] = [];
  // map は空き（[1, , 2]）を飛ばすので、添字で読む。空きは undefined として item に渡り、止まる。
  for (let index = 0; index < elements.length; index += 1) {
    const label = `${key}[${index}]`;
    result.push(item({ [label]: elements[index] }, label));
  }
  return result;
}

/**
 * オブジェクトの項目を読む。中の項目は、返したものからこの部品で読む。
 *
 * @throws ReadError 項目が無いとき、オブジェクトでないとき（配列と null を含む）
 */
export function readObject(obj: JsonObject, key: string): JsonObject {
  const raw = field(obj, key);
  if (!isRecord(raw)) throw new ReadError(`${key} がオブジェクトでない: ${describe(raw)}`);
  return raw;
}

/**
 * 文字列の項目を、`choices` のどれかとして読む。
 *
 * 閉じた種類への読み替えは、外から来た所で1度だけ行う。知らない値を既定の種類に倒さずに止める。
 * 止める文は、候補も断った値と同じく引用符つきで並べる（Python 版の `read_enum` と同じ書き方）。
 *
 * @throws ReadError 項目が無いとき、文字列でないとき、`choices` に無い値のとき
 */
export function readChoice<K extends string>(obj: JsonObject, key: string, choices: readonly K[]): K {
  const raw = readString(obj, key);
  if (!(choices as readonly string[]).includes(raw)) {
    const known = choices.map((choice) => JSON.stringify(choice)).join('・');
    throw new ReadError(`${key} が知らない値: ${JSON.stringify(raw)}（${known} のどれか）`);
  }
  return raw as K;
}

/** 項目の値。無ければ止める。 */
function field(obj: JsonObject, key: string): unknown {
  // `in` で有無を見ない。'toString' in {} は真になる（Object.prototype から継いだ項目）。
  // '__proto__' は Object.prototype そのものを返し、オブジェクトとして読めてしまう。
  if (!Object.hasOwn(obj, key)) throw new ReadError(`${key} が無い`);
  return obj[key];
}

/** 配列でもなく null でもない、オブジェクト。 */
function isRecord(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 止めるときの文に入れる、値の書き表し。
 *
 * 数・真偽値・null・undefined は String で、文字列は引用符つきで書く。配列とオブジェクトは種類の
 * 名前だけを書く（大きいものを文に入れない）。プロトタイプを持たないオブジェクトは String に渡すと
 * TypeError になるので、オブジェクトは String に渡さない。
 */
function describe(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  if (Array.isArray(value)) return '配列';
  if (typeof value === 'object' && value !== null) return 'オブジェクト';
  if (typeof value === 'function') return '関数';
  return String(value);
}
