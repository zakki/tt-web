import { describe, expect, it } from "vitest";
import { FrameStats } from "../src/abagames/util/sdl/framestats";

describe("FrameStats", () => {
  it("aggregates frame metrics", () => {
    const stats = new FrameStats();
    stats.reset(0);
    stats.recordFrame(16, 1, 16);
    stats.recordFrame(20, 2, 36);
    stats.recordFrame(14, 1, 50);

    const s = stats.getSnapshot();
    expect(s.frames).toBe(3);
    expect(s.updates).toBe(4);
    expect(s.droppedFrames).toBe(1);
    expect(s.avgFrameMs).toBeCloseTo((16 + 20 + 14) / 3, 5);
    expect(s.worstFrameMs).toBe(20);
    expect(s.avgFps).toBeGreaterThan(0);
    expect(s.updatedAtMs).toBe(50);
  });
});
