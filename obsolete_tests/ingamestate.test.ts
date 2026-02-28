import { describe, expect, it } from "vitest";
import { InGameState } from "../src/abagames/tt/gamemanager";
import { Pad } from "../src/abagames/util/sdl/pad";

function createState() {
  const counters = {
    shipMove: 0,
    stageMove: 0,
    enemiesMove: 0,
    shotsMove: 0,
    bulletsMove: 0,
    particlesMove: 0,
    floatLettersMove: 0,
    startTitleCalls: 0,
    startTitleArg: false,
  };

  const pad = {
    keys: {} as Record<number, number>,
    getButtonState: () => 0,
  } as unknown as Pad;

  const ship = {
    isGameOver: false,
    move: () => {
      counters.shipMove++;
    },
    draw: () => {},
    drawFront: () => {},
    drawLuminous: () => {},
    clearVisibleBullets: () => {},
    inSightDepth: 35,
  };

  const state = new InGameState(
    {} as never,
    ship as never,
    { move: () => counters.shotsMove++, clear: () => {}, draw: () => {} } as never,
    { move: () => counters.bulletsMove++, clear: () => {}, draw: () => {}, clearVisible: () => {} } as never,
    { move: () => counters.enemiesMove++, clear: () => {}, draw: () => {} } as never,
    { move: () => counters.particlesMove++, clear: () => {}, draw: () => {}, drawLuminous: () => {} } as never,
    { move: () => counters.floatLettersMove++, clear: () => {}, draw: () => {} } as never,
    { move: () => counters.stageMove++, start: () => {} } as never,
    pad,
    {} as never,
    {
      startTitle: (fromGameOver?: boolean) => {
        counters.startTitleCalls++;
        counters.startTitleArg = !!fromGameOver;
      },
    } as never,
  );

  return { state, pad, ship, counters };
}

describe("InGameState transitions", () => {
  it("toggles pause only on edge press and suppresses world updates while paused", () => {
    const { state, pad, counters } = createState();
    (pad.keys as Record<number, number>)[80] = 1; // P

    state.move();
    expect(counters.shipMove).toBe(0);
    expect(counters.stageMove).toBe(0);

    // keep pressed -> no re-toggle, still paused
    state.move();
    expect(counters.shipMove).toBe(0);

    // release then press again to unpause
    (pad.keys as Record<number, number>)[80] = 0;
    state.move();
    (pad.keys as Record<number, number>)[80] = 1;
    state.move();
    expect(counters.shipMove).toBe(1);
    expect(counters.stageMove).toBe(1);
  });

  it("enters game over when timer reaches zero", () => {
    const { state, ship } = createState();
    (state as { time: number }).time = 16;
    state.move();
    expect(ship.isGameOver).toBe(true);
    expect((state as { time: number }).time).toBe(0);
  });

  it("returns to title when A is pressed after game over threshold", () => {
    const { state, pad, ship, counters } = createState();
    ship.isGameOver = true;
    (state as { gameOverCnt: number }).gameOverCnt = 60;
    (state as { btnPressed: boolean }).btnPressed = false;
    pad.getButtonState = () => Pad.Button.A;

    state.move();
    expect(counters.startTitleCalls).toBe(1);
    expect(counters.startTitleArg).toBe(true);
  });
});
