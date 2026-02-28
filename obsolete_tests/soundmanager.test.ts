import { describe, expect, it, vi } from "vitest";
import { SoundManager } from "../src/abagames/tt/soundmanager";
import { ReplayData } from "../src/abagames/tt/replay";

describe("SoundManager logic", () => {
  it("playBgm chooses a new index when previous index is set", () => {
    const sm = SoundManager as unknown as {
      bgm: Array<{ play: () => void }>;
      prevBgmIdx: number;
      nextIdxMv: number;
      rand: { setSeed: (n: number) => void };
    };

    sm.bgm = [{ play: vi.fn() }, { play: vi.fn() }];
    sm.prevBgmIdx = 0;
    sm.rand.setSeed(1);
    SoundManager.playBgm();

    expect(sm.prevBgmIdx).toBe(1);
    expect((sm.bgm[0].play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(0);
    expect((sm.bgm[1].play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("nextBgm wraps index according to movement", () => {
    const sm = SoundManager as unknown as {
      bgm: Array<{ play: () => void }>;
      prevBgmIdx: number;
      nextIdxMv: number;
    };

    sm.bgm = [{ play: vi.fn() }, { play: vi.fn() }, { play: vi.fn() }];
    sm.prevBgmIdx = 0;
    sm.nextIdxMv = -1;
    SoundManager.nextBgm();

    expect(sm.prevBgmIdx).toBe(2);
    expect((sm.bgm[2].play as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("playSe is suppressed while SE is disabled", () => {
    const sm = SoundManager as unknown as {
      se: Record<string, { play: () => void }>;
    };
    const play = vi.fn();
    sm.se = { "hit.wav": { play } };

    SoundManager.disableSe();
    SoundManager.playSe("hit.wav");
    expect(play).toHaveBeenCalledTimes(0);

    SoundManager.enableSe();
    SoundManager.playSe("hit.wav");
    expect(play).toHaveBeenCalledTimes(1);
  });
});

describe("ReplayData clone", () => {
  it("deep-copies padRecord data", () => {
    const r = new ReplayData();
    r.level = 3;
    r.grade = 1;
    r.seed = 999;
    r.padRecord.add(7);
    r.padRecord.add(7);
    r.padRecord.add(2);

    const c = r.clone();
    expect(c.level).toBe(3);
    expect(c.grade).toBe(1);
    expect(c.seed).toBe(999);

    // mutate original after clone; clone should not change
    r.padRecord.add(100);
    expect(c.padRecord.next()).toBe(7);
  });
});
