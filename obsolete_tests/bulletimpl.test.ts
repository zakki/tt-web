import { describe, expect, it } from "vitest";
import { BulletImpl } from "../src/abagames/tt/bulletimpl";

describe("BulletImpl rank", () => {
  it("accepts rank setter from base Bullet", () => {
    const b = new BulletImpl(1);
    expect(() => {
      b.rank = 0.7;
    }).not.toThrow();
  });

  it("applies rootRankEffect when parser/rootBullet are set", () => {
    const b = new BulletImpl(1);
    b.addParser({}, 0.8, 1, 1);
    b.rootBullet = { rootRank: 0.5 } as unknown as import("../src/abagames/tt/bulletactor").BulletActor;
    expect(b.rank).toBeCloseTo(0.4, 5);
  });
});
