import { expect } from 'vitest';
import { ReadError } from '../../src/lib/strict-read.js';

/**
 * 外から来た値の読み取りのテストが使う、止めた文の頭の比べ方。テストの補助で、src には対応しない。
 *
 * `read` が ReadError で止まり、その文が `head` で始まることを見る。止まったことだけを見ると、
 * 別の検査が先に止めても通ってしまうので、どの項目か、なぜかまで比べる。止めた例外を返すので、
 * 元の例外（`cause`）も続けて見られる。
 */
export function expectStop(read: () => unknown, head: string): ReadError {
  let caught: unknown = undefined;
  try {
    read();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(ReadError);
  const error = caught as ReadError;
  expect(error.message.slice(0, head.length)).toBe(head);
  return error;
}

/**
 * `call` が呼ぶ側の誤りとして RangeError で止まり、その文が `head` で始まることを見る。
 *
 * 外から来た値の誤り（ReadError）と取り違えていないことも見る。取り違えると、受け取った側が
 * 外から来た値の誤りとして断って続け、どの値も断り続ける。
 */
export function expectCallerError(call: () => unknown, head: string): void {
  let caught: unknown = undefined;
  try {
    call();
  } catch (error) {
    caught = error;
  }
  expect(caught).toBeInstanceOf(RangeError);
  expect(caught).not.toBeInstanceOf(ReadError);
  expect((caught as RangeError).message.slice(0, head.length)).toBe(head);
}
