import { describe, expect, it } from 'vitest';
import type { Brand } from '../../src/patterns/brand.js';

/** 区間の中で数えた番号。区間が替わるたびに 0 へ戻る。 */
type SectionIndex = Brand<number, 'SectionIndex'>;
/** 始めから通して数えた番号。戻らない。 */
type OverallIndex = Brand<number, 'OverallIndex'>;

/** 通しの番号だけを受け取る処理。区間の中の番号を渡すと、2つ目の区間から番号が戻って見える。 */
function label(at: OverallIndex): string {
  return `${at} 番目`;
}

/** 区間の中の番号だけを受け取る処理。 */
function sectionLabel(at: SectionIndex): string {
  return `区間の ${at} 番目`;
}

/** ただの数を受け取る処理。 */
function half(value: number): number {
  return value / 2;
}

describe('単位を型で分ける', () => {
  it('印の付いた値は、ただの数を受け取る所へそのまま渡せる', () => {
    const at = 4 as OverallIndex;
    expect(half(at)).toBe(2);
    expect(Math.max(at, 1)).toBe(4);
  });

  it('ただの数を、印の付いた値を受け取る所へ渡すと、型検査が止める', () => {
    // 止めなくなると、@ts-expect-error が使われていないとして型検査が失敗する。
    // @ts-expect-error ただの数には印が無い
    expect(label(3)).toBe('3 番目');
  });

  it('別の印の値は渡せない', () => {
    // この型の目的そのもの。最初の区間では2つの番号が同じ値なので、値を比べるテストでは
    // 取り違えが見つからない。型が違えば、区間の数によらず型検査が止める。
    const inSection = 2 as SectionIndex;
    // @ts-expect-error 区間の中の番号は、通しの番号の所へ渡せない
    expect(label(inSection)).toBe('2 番目');
    // 逆の向きも渡せない。
    const overall = 5 as OverallIndex;
    // @ts-expect-error 通しの番号は、区間の中の番号の所へ渡せない
    expect(sectionLabel(overall)).toBe('区間の 5 番目');
  });

  it('印の付いた値どうしを足すと、ただの数に戻る', () => {
    const at = 4 as OverallIndex;
    const next = at + 1;
    // @ts-expect-error 足した値には印が無い
    expect(label(next)).toBe('5 番目');
    // 次の番号として使うなら、もう一度印を付ける。印を付ける場所を少なくするなら、足し算を1か所に置く。
    expect(label(next as OverallIndex)).toBe('5 番目');
  });

  it('印を付ける書き方は、ただの数を経れば、どの値にも使え、型検査を通る', () => {
    // 型では塞げない穴。区間の中の番号に通しの番号の印を付けても、ただの数を経れば止まらない。
    const inSection = 2 as SectionIndex;
    expect(label(inSection as number as OverallIndex)).toBe('2 番目');
    // 別の印の値に、ただの数を経ずに as で印を付ける形は、2つの型が重ならないとして型検査が止める。
    // @ts-expect-error 別の印の値には、そのまま別の印を付けられない
    expect(label(inSection as OverallIndex)).toBe('2 番目');
  });

  it('同じ文字列の印を別の名前で定義すると、同じ型になる', () => {
    // 印は文字列で見分けるので、2か所で同じ文字列を使うと区別できない。型ごとに違う文字列を付ける。
    type AnotherOverall = Brand<number, 'OverallIndex'>;
    const at = 6 as AnotherOverall;
    expect(label(at)).toBe('6 番目');
  });

  it('実行時には印が残らず、ただの数のまま', () => {
    // 変換の手間はかからない。その代わり、実行時に印で見分けることもできない。
    const at = 7 as OverallIndex;
    expect(typeof at).toBe('number');
    expect(Object.is(at, 7)).toBe(true);
    expect(JSON.stringify({ at })).toBe('{"at":7}');
  });
});
