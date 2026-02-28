import { describe, expect, it } from "vitest";
import { StageManager } from "../src/abagames/tt/stagemanager";

type SpawnCall = {
  spec: { isBoss?: boolean };
  x: number;
  y: number;
};

function createFixture(speed: number) {
  const spawns: SpawnCall[] = [];
  const enemies = {
    clear: () => {},
    getInstance: () => ({
      set: (spec: { isBoss?: boolean }, x: number, y: number) => {
        spawns.push({ spec, x, y });
      },
    }),
  };
  const ship = {
    speed,
    inSightDepth: 35,
    relPos: { y: 0 },
  };
  const tunnel = {
    start: () => {},
  };
  const stage = new StageManager(tunnel as never, enemies as never, ship as never);
  return { stage, spawns };
}

describe("StageManager spawn schedule", () => {
  it("spawns a small enemy when initial small distance is reached", () => {
    const { stage, spawns } = createFixture(20);
    stage.start(1, 0, 123);
    stage.move();

    expect(spawns.length).toBe(1);
    expect(spawns[0].spec.isBoss).toBe(false);
    expect(spawns[0].y).toBeCloseTo(35 * 1.6, 5);
  });

  it("spawns boss only once after boss distance is reached", () => {
    const { stage, spawns } = createFixture(100);
    stage.start(1, 0, 456);
    for (let i = 0; i < 8; i++) stage.move();

    const bossSpawns = spawns.filter((s) => s.spec.isBoss);
    expect(bossSpawns.length).toBe(1);
  });
});
