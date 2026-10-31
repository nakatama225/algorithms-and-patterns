import { describe, expect, it } from 'vitest';
import { Registry } from '../../src/patterns/strategy.js';

/** 検査に使う答え方。文字列の整形の仕方を差し替える。 */
type Formatter = (text: string) => string;

const upper: Formatter = (text) => text.toUpperCase();
const lower: Formatter = (text) => text.toLowerCase();

describe('Registry', () => {
  it('何も登録していなければ、名前の一覧は空で、取り出すと止まる', () => {
    const formatters = new Registry<Formatter>('整形の方法');
    expect(formatters.keys()).toEqual([]);
    expect(formatters.has('upper')).toBe(false);
    expect(() => formatters.get('upper')).toThrow('整形の方法「upper」は登録されていない');
  });

  it('登録した答え方を、名前で取り出して使える', () => {
    const formatters = new Registry<Formatter>('整形の方法');
    formatters.add('upper', upper);
    expect(formatters.has('upper')).toBe(true);
    expect(formatters.get('upper')('abc')).toBe('ABC');
  });

  it('名前の一覧は、登録した順に並ぶ', () => {
    // 画面に選択肢として並べるときなど、順番に意味を持たせられるようにする。
    // 名前の並べ替えと区別がつくよう、アルファベット順と逆に登録する。
    const formatters = new Registry<Formatter>('整形の方法');
    formatters.add('upper', upper);
    formatters.add('lower', lower);
    expect(formatters.keys()).toEqual(['upper', 'lower']);
  });

  it('同じ名前で2度登録すると止まり、先に登録したものが残る', () => {
    // 上書きを許すと、2つの答え方に同じ名前を付けた書き間違いに気づけない。
    const formatters = new Registry<Formatter>('整形の方法');
    formatters.add('upper', upper);
    expect(() => formatters.add('upper', lower)).toThrow('整形の方法「upper」はすでに登録されている');
    expect(formatters.get('upper')('Abc')).toBe('ABC');
  });

  it('大文字と小文字が違えば、別の名前として扱う', () => {
    // 名前を黙って揃えない。揃えるなら、使う側が揃えてから取り出す。
    const formatters = new Registry<Formatter>('整形の方法');
    formatters.add('upper', upper);
    formatters.add('Upper', lower);
    expect(formatters.keys()).toEqual(['upper', 'Upper']);
    expect(() => formatters.get('UPPER')).toThrow();
  });

  it('答え方が 0 や空文字や undefined でも、登録されていれば取り出せる', () => {
    // 値が偽とみなされるかどうか、undefined かどうかで「登録されていない」と判断すると、
    // ここで止まる。
    const weights = new Registry<number>('重み');
    weights.add('none', 0);
    const labels = new Registry<string | undefined>('見出し');
    labels.add('blank', '');
    labels.add('missing', undefined);
    expect(weights.get('none')).toBe(0);
    expect(labels.get('blank')).toBe('');
    expect(labels.get('missing')).toBeUndefined();
    expect([weights.has('none'), labels.has('blank'), labels.has('missing')]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it('登録表ごとに、中身は分かれている', () => {
    // 1つの大域の表を共有する作りだと、片方への登録がもう片方に見える。
    const a = new Registry<Formatter>('整形の方法');
    const b = new Registry<Formatter>('整形の方法');
    a.add('upper', upper);
    expect(b.has('upper')).toBe(false);
    b.add('upper', lower);
    expect(a.get('upper')('Abc')).toBe('ABC');
  });

  it('keys の返り値を書き換えても、登録は変わらない', () => {
    const formatters = new Registry<Formatter>('整形の方法');
    formatters.add('upper', upper);
    formatters.keys().push('lower');
    expect(formatters.keys()).toEqual(['upper']);
  });
});
