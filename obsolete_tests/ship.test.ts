import { describe, expect, it } from "vitest";
import { Ship } from "../src/abagames/tt/ship";
import { Pad } from "../src/abagames/util/sdl/pad";
import { Vector } from "../src/abagames/util/vector";

function createFixture() {
  let dirState = 0;
  let btnState = 0;
  let shotSpawnCount = 0;

  const pad = {
    getDirState: () => dirState,
    getButtonState: () => btnState,
  } as unknown as Pad;

  const tunnel = {
    setShipPos: () => {},
    setSlices: () => {},
    getTorusLength: () => 1000,
  };

  const ship = new Ship(pad, tunnel as never);
  ship.setShots({
    getInstance: () => {
      shotSpawnCount++;
      return {
        set: () => {},
        update: () => {},
      };
    },
  } as never);
  ship.start(0, 1234);

  return {
    ship,
    setDir: (v: number) => {
      dirState = v;
    },
    setBtn: (v: number) => {
      btnState = v;
    },
    getShotSpawnCount: () => shotSpawnCount,
  };
}

describe("Ship core behaviors", () => {
  it("applies shot cooldown while A is held", () => {
    const f = createFixture();
    f.setBtn(Pad.Button.A);

    for (let i = 0; i < 10; i++) f.ship.move();

    // FIRE_INTERVAL=4 => spawn on frame 1,5,9
    expect(f.getShotSpawnCount()).toBe(3);
  });

  it("uses lower target speed when B is held", () => {
    const f1 = createFixture();
    f1.setBtn(0);
    for (let i = 0; i < 30; i++) f1.ship.move();
    const fast = f1.ship.speed;

    const f2 = createFixture();
    f2.setBtn(Pad.Button.B);
    for (let i = 0; i < 30; i++) f2.ship.move();
    const slow = f2.ship.speed;

    expect(fast).toBeGreaterThan(slow);
  });

  it("enters game over when bullet hit is detected", () => {
    const f = createFixture();
    const p = new Vector(f.ship.relPos.x, f.ship.relPos.y);

    const hit = f.ship.checkBulletHit(p, p);
    expect(hit).toBe(true);
    expect(f.ship.isGameOver).toBe(true);
  });
});
