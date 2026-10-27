/**
 * 状態の要約 — 状態を、比べられる 32 ビットの数1つにまとめる。
 *
 * 同じ処理を2回走らせた結果や、2つの環境で走らせた結果が同じかを、状態の全体を比べずに
 * 要約どうしで比べる。ずれは起きた直後には見えず、しばらくたってから原因と離れた所で
 * 見えることが多い。決めた間隔で要約を比べておくと、ずれた直後に気づける。
 *
 * アルゴリズムは FNV-1a の 32 ビット版。値を1バイトずつ混ぜていく。混ぜる順がそのまま
 * 結果を決めるので、何をどの順で混ぜるかは呼ぶ側が決めて固定する。順が変わると、
 * 同じ状態でも別の値になる。
 *
 * Python 版（`python/src/algorithms_and_patterns/lib/state_hash.py`）は、同じ値を同じ順で
 * 混ぜれば同じ要約を出す。混ぜるバイトの並びを、2つの言語で次のとおりに決めている。
 *
 * - 整数：32 ビットの2の補数で、下位のバイトから4バイト
 * - 小数：IEEE 754 の 64 ビットのビット列で、下位のバイトから8バイト
 * - 文字列：UTF-8 のバイト列のあとに、そのバイトの数を整数として
 *
 * 衝突しない保証は無く、改竄を防ぐ用途には使えない。ここで約束するのは、同じ値を
 * 同じ順で混ぜれば同じ要約になることだけ。
 */

/** FNV-1a の 32 ビット版の初期値。 */
const OFFSET_BASIS = 0x811c9dc5;
/** FNV-1a の 32 ビット版で、1バイトごとに掛ける素数。 */
const PRIME = 0x01000193;
/** 混ぜてよい整数の最小（32 ビットの符号つきの最小）。 */
const INT_MIN = -(2 ** 31);
/** 混ぜてよい整数の上限（この値は含まない。32 ビットの符号なしの最大 + 1）。 */
const INT_STOP = 2 ** 32;
/** 小数をビット列に書き出す場所。混ぜるたびに作らずに使い回す。 */
const FLOAT_BYTES = new DataView(new ArrayBuffer(8));

/**
 * 要約を組み立てる。
 *
 * `add` で始まるメソッドは自分を返すので、`new StateHasher().addInt(a).addFloat(b).hex` の
 * ように続けて書ける。範囲の外の値で止まるときは、混ぜる前に止まり、それまでの要約を変えない。
 */
export class StateHasher {
  /** 組み立て中の要約。0 以上 2**32 未満の整数。 */
  #value = OFFSET_BASIS;

  /**
   * -2**31 以上 2**32 未満の整数を混ぜる。
   *
   * 符号つきと符号なしで同じビットの並びになる値（-1 と 0xffffffff）は、同じ値として混ぜる。
   * 符号つきの差と、符号なしの 32 ビットの値の両方を受けるため。
   *
   * @throws RangeError 整数でないとき、または範囲の外のとき。`| 0` や `>>> 0` に通すと、
   *   1.5 は 1 に、NaN は 0 に、範囲の外は下位 32 ビットに黙って変わり、違う値が同じ要約になる
   */
  addInt(value: number): this {
    this.#mix(intBytes(value));
    return this;
  }

  /**
   * 小数を、IEEE 754 の 64 ビットのビット列のまま混ぜる。
   *
   * 丸めたり文字列にしたりしてから混ぜると、わずかなずれを見逃す。0 と -0 は `===` では
   * 等しいが、ビット列が違うので別の要約になる。
   *
   * @throws RangeError NaN のとき。NaN を書き出したときのビット列は、仕様が実装に選ばせている
   */
  addFloat(value: number): this {
    if (Number.isNaN(value)) {
      throw new RangeError('NaN は混ぜられない');
    }
    // Float64Array で書き出すと、バイトの順が実行環境の順になる。DataView で下位のバイトから
    // 並べる順（第3引数の true）を指定する。
    FLOAT_BYTES.setFloat64(0, value, true);
    const bytes: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      bytes.push(FLOAT_BYTES.getUint8(i));
    }
    this.#mix(bytes);
    return this;
  }

  /** 真偽値を、1 か 0 の整数として混ぜる。 */
  addBool(value: boolean): this {
    return this.addInt(value ? 1 : 0);
  }

  /**
   * 文字列を、UTF-8 のバイト列と、そのバイトの数として混ぜる。
   *
   * 数も混ぜるのは、区切りを残すため。混ぜないと 'ab' と 'c' を続けて混ぜた要約と、
   * 'a' と 'bc' を続けて混ぜた要約が同じになる。
   *
   * @throws RangeError 対になっていないサロゲート（'\ud800' など）を含むとき。UTF-8 にできない
   */
  addText(value: string): this {
    const bytes = utf8(value);
    this.#mix([...bytes, ...intBytes(bytes.length)]);
    return this;
  }

  /** 組み立てた要約（0 以上 2**32 未満）。 */
  get value(): number {
    return this.#value;
  }

  /** 要約の、0 で埋めた8桁の16進表記（小文字）。見比べやすい。 */
  get hex(): string {
    return this.#value.toString(16).padStart(8, '0');
  }

  #mix(bytes: readonly number[]): void {
    let value = this.#value;
    for (const byte of bytes) {
      // Math.imul は掛け算の下位 32 ビットを返す。`*` で掛けると 2**53 を超えて丸められる。
      value = Math.imul(value ^ byte, PRIME) >>> 0;
    }
    this.#value = value;
  }
}

/**
 * 整数を、32 ビットの2の補数で下位のバイトから並べた4バイトにする。
 *
 * @throws RangeError 整数でないとき、または -2**31 以上 2**32 未満でないとき
 */
function intBytes(value: number): number[] {
  if (!Number.isInteger(value) || value < INT_MIN || value >= INT_STOP) {
    throw new RangeError(`-2**31 以上 2**32 未満の整数だけを混ぜられる: ${value}`);
  }
  const unsigned = value >>> 0;
  return [unsigned & 0xff, (unsigned >>> 8) & 0xff, (unsigned >>> 16) & 0xff, unsigned >>> 24];
}

/**
 * 文字列を UTF-8 のバイト列にする。
 *
 * TextEncoder は、このリポジトリの型の設定（ES2022 だけ）に無いので、符号位置から手で組む。
 * TextEncoder は対になっていないサロゲートを U+FFFD に置き換えるが、ここでは止める。
 * 置き換えると、違う文字列が同じ要約になる。Python の `str.encode` も止める。
 *
 * @throws RangeError 対になっていないサロゲートを含むとき
 */
function utf8(value: string): number[] {
  const bytes: number[] = [];
  // for...of は文字列を符号位置ごとに取り出す。対になったサロゲートは1つの符号位置になり、
  // 対になっていないものは、それだけで1つになる。
  for (const char of value) {
    // char は空でないので、codePointAt(0) は必ず数を返す。
    const code = char.codePointAt(0) as number;
    if (code >= 0xd800 && code <= 0xdfff) {
      throw new RangeError(`対になっていないサロゲートは混ぜられない: U+${code.toString(16)}`);
    }
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}
