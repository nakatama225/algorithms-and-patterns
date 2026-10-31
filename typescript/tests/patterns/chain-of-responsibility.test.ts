import { describe, expect, it } from 'vitest';
import { resolve, type Handler } from '../../src/patterns/chain-of-responsibility.js';

/** 検査に使う規則。整数を言葉で分類する。 */
type Rule = Handler<number, string>;

const negative: Rule = { name: 'negative', handle: (n) => (n < 0 ? '負の数' : null) };
const zero: Rule = { name: 'zero', handle: (n) => (n === 0 ? 'ゼロ' : null) };
const even: Rule = { name: 'even', handle: (n) => (n % 2 === 0 ? '偶数' : null) };

const RULES: readonly Rule[] = [negative, zero, even];
const FALLBACK = '奇数';

describe('resolve', () => {
  it('規則が1つも無ければ、あらかじめ決めた答えを採る', () => {
    expect(resolve([], 5, FALLBACK)).toEqual({ result: FALLBACK, handledBy: null });
  });

  it('最初に答えた規則の答えを採り、どの規則が答えたかも返す', () => {
    const resolution = resolve(RULES, -4, FALLBACK);
    // -4 は負の数でも偶数でもあるが、前にある規則が答える。
    expect(resolution.result).toBe('負の数');
    expect(resolution.handledBy).toBe(negative);
    // 並びの先頭でない規則が答えたときも、その規則を返す。
    expect(resolve(RULES, 0, FALLBACK).handledBy).toBe(zero);
  });

  it('どの規則も答えなければ、あらかじめ決めた答えを採る', () => {
    expect(resolve(RULES, 7, FALLBACK)).toEqual({ result: FALLBACK, handledBy: null });
  });

  it('答えが決まったら、後ろの規則は呼ばない', () => {
    // 後ろの規則まで呼ぶ作りだと、重い判断や、呼ぶだけで何かが起きる規則が無駄に動く。
    const called: string[] = [];
    const spy = (rule: Rule): Rule => ({
      name: rule.name,
      handle: (n) => {
        called.push(rule.name);
        return rule.handle(n);
      },
    });
    resolve(RULES.map(spy), 0, FALLBACK);
    expect(called).toEqual(['negative', 'zero']);
  });

  it('並びの順が優先順になる。入れ替えると答えが変わる', () => {
    expect(resolve([zero, even], 0, FALLBACK).result).toBe('ゼロ');
    expect(resolve([even, zero], 0, FALLBACK).result).toBe('偶数');
  });

  it('規則を1つ外すと、その規則が答えていた状況は次の規則に回る', () => {
    // この型の目的そのもの。規則を外すのに、ほかの規則を1行も触らない。
    expect(resolve(RULES, 0, FALLBACK).result).toBe('ゼロ');
    const withoutZero = resolve([negative, even], 0, FALLBACK);
    expect(withoutZero.result).toBe('偶数');
    expect(withoutZero.handledBy).toBe(even);
  });

  it('0 や空文字や false の答えも、答えとして採る', () => {
    // 答えが偽とみなされるかどうかで「譲った」と判断すると、ここで次の規則へ進んでしまう。
    type Answer = number | string | boolean;
    const skipped: Handler<number, Answer> = {
      name: 'never',
      handle: () => 'ここまで来てはいけない',
    };
    for (const answer of [0, '', false]) {
      const first: Handler<number, Answer> = { name: 'first', handle: () => answer };
      expect(resolve([first, skipped], 1, 'fallback').result).toBe(answer);
    }
  });

  it('同じ規則が並びに2度あっても、最初の位置で答える', () => {
    // 答えたら2度目の位置は呼ばれず、答えなければ両方の位置で呼ばれる。
    const calls: number[] = [];
    const counted: Rule = {
      name: 'counted',
      handle: (n) => {
        calls.push(n);
        return zero.handle(n);
      },
    };
    expect(resolve([counted, even, counted], 0, FALLBACK).handledBy).toBe(counted);
    expect(calls).toEqual([0]);
    calls.length = 0;
    expect(resolve([counted, even, counted], 3, FALLBACK).handledBy).toBeNull();
    expect(calls).toEqual([3, 3]);
  });

  it('規則が投げた例外は、握りつぶさずにそのまま伝わる', () => {
    // 例外を「譲った」と見なして次へ進むと、規則の不具合が別の答えに化けて見えなくなる。
    const broken: Rule = {
      name: 'broken',
      handle: () => {
        throw new Error('壊れた規則');
      },
    };
    const called: string[] = [];
    const after: Rule = {
      name: 'after',
      handle: () => {
        called.push('after');
        return '後ろ';
      },
    };
    expect(() => resolve([broken, after], 1, FALLBACK)).toThrow('壊れた規則');
    expect(called).toEqual([]);
  });

  it('答えに null は使えない。型検査で止まる', () => {
    // null は「次に譲る」の意味なので、答えそのものが null だと区別がつかない。
    // `R` の制約（NonNullable<unknown>）を外すと、下の行が型エラーにならなくなる。
    const maybe: Handler<number, string | null> = { name: 'maybe', handle: () => null };
    // @ts-expect-error 答えの型に null を含められない
    expect(resolve([maybe], 1, null).result).toBeNull();
  });

  it('より多くを知っている状況を前提にした規則は、型検査で並べられない', () => {
    // `handle` をメソッドの形で宣言すると状況の型の向きを見なくなり、下の行が型エラーに
    // ならず、`@ts-expect-error` が使われていないとして型検査が失敗する。
    // 片方がもう片方を広げた型にしておく。無関係な2つの型だと、向きを見なくても
    // どちら向きにも代入できないので、メソッドの形でも型エラーになり、区別がつかない。
    interface Plain {
      readonly value: number;
    }
    interface Labeled extends Plain {
      readonly label: string;
    }
    const needsLabel: Handler<Labeled, string> = {
      name: 'label',
      handle: (c) => (c.label.length > 0 ? c.label : null),
    };
    // @ts-expect-error Plain には label が無い
    const chain: readonly Handler<Plain, string>[] = [needsLabel];
    expect(chain).toHaveLength(1);
  });
});
