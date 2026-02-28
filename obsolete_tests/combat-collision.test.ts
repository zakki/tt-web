import { describe, expect, it } from "vitest";
import { Enemy } from "../src/abagames/tt/enemy";
import { BulletActor } from "../src/abagames/tt/bulletactor";
import { Shot } from "../src/abagames/tt/shot";
import { Vector } from "../src/abagames/util/vector";

describe("Combat collision behavior", () => {
  it("Enemy.checkShotHit removes enemy and adds score when shield is exhausted", () => {
    const e = new Enemy();
    e.init([{}, {}, {}, {}] as never);
    const spec = {
      shield: 1,
      score: 123,
      shape: {
        checkCollision: () => true,
      },
    } as never;
    e.set(spec, 1, 2, null);
    const hitPos = new Vector(1, 2);

    let scored = 0;
    const shot = {
      damage: 1,
      addScore: (s: number) => {
        scored += s;
      },
    } as never;

    e.checkShotHit(hitPos, { checkCollision: () => true } as never, shot);
    expect(e.exists).toBe(false);
    expect(scored).toBe(123);
  });

  it("BulletActor.checkShotHit removes visible bullet and adds fixed score", () => {
    const b = new BulletActor();
    b.init([{}, {}] as never);
    b.set(0.5, 1.5, 0, 0.1);

    let scored = 0;
    const shot = {
      addScore: (s: number) => {
        scored += s;
      },
    } as never;

    b.checkShotHit(new Vector(0.5, 1.5), { checkCollision: () => true } as never, shot);
    expect(b.exists).toBe(false);
    expect(scored).toBe(10);
  });

  it("Shot.move checks both enemy and bullet collisions only for charge shot", () => {
    const calls = { enemies: 0, bullets: 0 };
    const s = new Shot();
    s.init([
      { checkInScreen: () => true },
      { checkShotHit: () => calls.enemies++ },
      { checkShotHit: () => calls.bullets++ },
      {},
      {},
      { inSightDepth: 35 },
    ] as never);

    s.set(true, false, 0);
    s.update(new Vector(0, 0));
    (s as { inCharge: boolean; range: number }).inCharge = false;
    (s as { range: number }).range = 10;
    s.move();
    expect(calls.bullets).toBe(1);
    expect(calls.enemies).toBe(1);

    calls.bullets = 0;
    calls.enemies = 0;
    s.set(false, false, 0);
    s.update(new Vector(0, 0));
    (s as { range: number }).range = 10;
    s.move();
    expect(calls.bullets).toBe(0);
    expect(calls.enemies).toBe(1);
  });
});
