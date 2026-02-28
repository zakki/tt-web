import { describe, expect, it } from "vitest";
import { TitleManager } from "../src/abagames/tt/title";
import { Pad } from "../src/abagames/util/sdl/pad";

function createTitleManager() {
  const state = {
    dir: 0,
    btn: 0,
    started: 0,
    replayStarted: 0,
    recorded: [] as Array<{ grade: number; level: number }>,
  };

  const pad = {
    getDirState: () => state.dir,
    getButtonState: () => state.btn,
  } as unknown as Pad;

  const prefManager = {
    prefData: {
      selectedGrade: 0,
      selectedLevel: 3,
      getMaxLevel: (_g: number) => 3,
      getGradeData: (_g: number) => ({ hiScore: 0 }),
      recordStartGame: (grade: number, level: number) => state.recorded.push({ grade, level }),
    },
  };

  const gm = {
    startInGame: () => state.started++,
    startReplayFromTitle: () => state.replayStarted++,
  };

  const tm = new TitleManager(prefManager as never, pad, {} as never, gm as never);
  tm.start();
  return { tm, state };
}

describe("TitleManager input transitions", () => {
  it("changes grade with RIGHT and starts game with A", () => {
    const { tm, state } = createTitleManager();
    tm.move(false); // neutral to release initial input guard

    state.dir = Pad.Dir.RIGHT;
    tm.move(false);
    state.dir = 0;
    tm.move(false);

    state.btn = Pad.Button.A;
    tm.move(false);

    expect(state.started).toBe(1);
    expect(state.recorded.length).toBe(1);
    expect(state.recorded[0]).toEqual({ grade: 1, level: 3 });
  });

  it("toggles replay mode with B and starts replay with A", () => {
    const { tm, state } = createTitleManager();
    tm.move(true); // release initial input guard

    state.btn = Pad.Button.B;
    tm.move(true);
    expect(tm.replayMode).toBe(true);

    state.btn = 0;
    tm.move(true);
    state.btn = Pad.Button.A;
    tm.move(true);

    expect(state.replayStarted).toBe(1);
    expect(state.started).toBe(0);
  });

  it("wraps level on DOWN from max level", () => {
    const { tm, state } = createTitleManager();
    tm.move(false); // release initial input guard

    state.dir = Pad.Dir.DOWN;
    tm.move(false);
    state.dir = 0;
    tm.move(false);
    state.btn = Pad.Button.A;
    tm.move(false);

    expect(state.recorded[0]).toEqual({ grade: 0, level: 1 });
  });
});
