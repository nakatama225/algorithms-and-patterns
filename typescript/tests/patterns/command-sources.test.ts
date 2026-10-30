import { describe, expect, it } from 'vitest';
import { CommandLog, RecordingSource, type CommandSource } from '../../src/patterns/command.js';
import { CombinedSource } from '../../src/patterns/command-sources.js';

/*
 * src/patterns/command-sources.ts のうち、出どころを合わせる部品（CombinedSource）のテスト。
 * 途中で替わる出どころ（Handover・HandoverSource）は command-handover.test.ts が見る。
 * 合わせ方の約束（全部に聞く・並びの順）と、替わる歩の約束は、別の理由で変わるので、
 * ファイルを分けた。
 */

/** 左と右のそれぞれへ動くかの組。 */
interface Sides {
  readonly left: boolean;
  readonly right: boolean;
}

const IDLE: Sides = { left: false, right: false };

/** 項目ごとの OR。どれかの出どころが真なら真にする。 */
function either(commands: readonly Sides[]): Sides {
  return {
    left: commands.some((command) => command.left),
    right: commands.some((command) => command.right),
  };
}

/** いつも同じ命令を返し、聞かれた歩と状態を覚える出どころ。 */
class Fixed<C> implements CommandSource<unknown, C> {
  readonly asked: { step: number; view: unknown }[] = [];

  constructor(readonly command: C) {}

  commandAt(step: number, view: unknown): C {
    this.asked.push({ step, view });
    return this.command;
  }
}

/** 歩ごとに決めた命令を返す出どころ。決めていない歩は何もしない命令。 */
function scripted(script: Readonly<Record<number, Sides>>): CommandSource<unknown, Sides> {
  return { commandAt: (step) => script[step] ?? IDLE };
}

/** 何もしない命令を返す出どころ。 */
const idle: CommandSource<unknown, Sides> = { commandAt: () => IDLE };

describe('CombinedSource', () => {
  it('先の出どころで答えが決まっても、毎歩、後ろの出どころまで全部に聞く', () => {
    // 打ち切ると、聞かれなかった出どころの覚えている内容が古くなる。先頭が両方とも真を返すので、
    // OR の答えは先頭だけで決まる。それでも後ろの2つに聞いたことを、聞かれた歩の列で見る。
    const sources = [
      new Fixed<Sides>({ left: true, right: true }),
      new Fixed(IDLE),
      new Fixed<Sides>({ left: false, right: true }),
    ];
    const combined = new CombinedSource(sources, either);
    for (let step = 0; step < 4; step += 1) {
      expect(combined.commandAt(step, 0)).toEqual({ left: true, right: true });
    }
    for (const source of sources) {
      expect(source.asked.map(({ step }) => step)).toEqual([0, 1, 2, 3]);
    }
  });

  it('並びの順に聞き、合わせ方には並びの順のまま渡す', () => {
    // 並べ替えると、順で結果が変わる合わせ方（先頭を優先する、など）が狂う。
    const order: string[] = [];
    const named = (name: string): CommandSource<unknown, string> => ({
      commandAt: () => {
        order.push(name);
        return name;
      },
    });
    const combined = new CombinedSource([named('c'), named('a'), named('b')], (names) => names.join(''));
    expect(combined.commandAt(0, 0)).toBe('cab');
    expect(order).toEqual(['c', 'a', 'b']);
  });

  it('真偽の組は、項目ごとの OR で、どれかの出どころが真なら真にする', () => {
    // 2つの出どころのどちらで指示しても、同じように動けるようにする見本。
    const first = scripted({ 0: { left: true, right: false }, 2: { left: true, right: false } });
    const second = scripted({ 1: { left: false, right: true }, 2: { left: false, right: true } });
    const combined = new CombinedSource([first, second], either);
    expect([0, 1, 2, 3].map((step) => combined.commandAt(step, 0))).toEqual([
      { left: true, right: false },
      { left: false, right: true },
      { left: true, right: true },
      IDLE,
    ]);
  });

  it('何もしない出どころを合わせても、ほかの出どころの命令は消えない', () => {
    // 何もしない出どころを、足りない所の穴埋めでなく、並びに明示して置く見本。
    const both: Sides = { left: true, right: true };
    expect(new CombinedSource([new Fixed(both), idle], either).commandAt(0, 0)).toEqual(both);
    expect(new CombinedSource([idle, idle], either).commandAt(0, 0)).toEqual(IDLE);
  });

  it('出どころが1つでも、そのまま返さずに合わせ方を通す', () => {
    // 1つなら合わせ方を飛ばす作りだと、合わせ方が命令を変える場合に結果が変わる。
    const combined = new CombinedSource([new Fixed(7)], (commands) => commands.length);
    expect(combined.commandAt(0, 0)).toBe(1);
  });

  it('どの出どころにも、同じ歩と状態を渡す', () => {
    const first = new Fixed(IDLE);
    const second = new Fixed(IDLE);
    const combined = new CombinedSource([first, second], either);
    const view = { position: 3 };
    combined.commandAt(5, view);
    combined.commandAt(9, view);
    const expected = [
      { step: 5, view },
      { step: 9, view },
    ];
    expect(first.asked).toEqual(expected);
    expect(second.asked).toEqual(expected);
    expect(first.asked[0]?.view).toBe(view);
  });

  it('渡した配列をあとで書き換えても、合わせる出どころは変わらない', () => {
    // 写さずに持つと、作ったあとで配列を空にされたときに、空の検査をすり抜ける。
    const first = new Fixed<Sides>({ left: true, right: false });
    const sources: CommandSource<unknown, Sides>[] = [first];
    const combined = new CombinedSource(sources, either);
    sources.length = 0;
    sources.push(new Fixed<Sides>({ left: false, right: true }));
    expect(combined.commandAt(0, 0)).toEqual({ left: true, right: false });
    expect(first.asked).toHaveLength(1);
  });

  it('同じ記録する出どころを2度並べると、1歩に2度記録しようとして止まる', () => {
    // 重なりを見分けず、並べたとおり1歩に2度聞く。前の歩を覚えている出どころを2度並べると、
    // 1歩で2歩ぶん進む。記録する出どころなら、同じ歩の2度目の記録を CommandLog が断る。
    const log = new CommandLog<Sides>(IDLE);
    const recording = new RecordingSource(new Fixed<Sides>({ left: true, right: false }), log);
    const combined = new CombinedSource([recording, recording], either);
    expect(() => combined.commandAt(0, 0)).toThrow(/歩が進んでいない/);
    expect(log.lastStep).toBe(0);
  });

  it('合わせる出どころが無ければ作れない', () => {
    // 繋ぎ忘れたまま、空の並びを合わせた命令（OR なら全部が偽）で進めない。
    expect(() => new CombinedSource<unknown, Sides>([], either)).toThrow(RangeError);
    expect(() => new CombinedSource<unknown, Sides>([], either)).toThrow(/合わせる出どころが無い/);
  });
});
