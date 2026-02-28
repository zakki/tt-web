import { afterEach, describe, expect, it, vi } from "vitest";
import { Tunnel } from "../src/abagames/tt/tunnel";
import { Vector } from "../src/abagames/util/vector";
import { Screen3D } from "../src/abagames/util/sdl/screen3d";

afterEach(() => {
  Screen3D.ctx2d = null;
});

describe("Tunnel", () => {
  it("checkInScreen respects near/far bounds", () => {
    const t = new Tunnel();
    t.start({});
    t.setShipPos(0, 0, 100);
    const ship = { inSightDepth: 35 };

    expect(t.checkInScreen(new Vector(0, 95), ship)).toBe(true); // relY = -5
    expect(t.checkInScreen(new Vector(0, 94.9), ship)).toBe(false); // relY < -5
    expect(t.checkInScreen(new Vector(0, 187.5), ship)).toBe(true); // relY = depth*2.5
    expect(t.checkInScreen(new Vector(0, 187.6), ship)).toBe(false); // relY > depth*2.5
  });

  it("checkDegInside handles wrapped and non-wrapped ranges", () => {
    // non-wrapped [ld, rd] = [1, 2]
    expect(Tunnel.checkDegInside(1.5, 1, 2)).toBe(0);
    expect(Tunnel.checkDegInside(0.5, 1, 2)).toBe(-1);
    expect(Tunnel.checkDegInside(2.5, 1, 2)).toBe(1);

    // wrapped range where rd <= ld, example [5.5 .. 0.7] across 2pi
    expect(Tunnel.checkDegInside(0.2, 5.5, 0.7)).toBe(0); // inside wrapped interval
    expect(Tunnel.checkDegInside(3.0, 5.5, 0.7)).not.toBe(0); // outside wrapped interval
  });

  it("draw/drawBackward issue wireframe draw calls", () => {
    const t = new Tunnel();
    const ctx = {
      save: vi.fn(),
      restore: vi.fn(),
      beginPath: vi.fn(),
      ellipse: vi.fn(),
      stroke: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      strokeStyle: "",
      lineWidth: 1,
      globalAlpha: 1,
    };
    Screen3D.ctx2d = ctx as unknown as CanvasRenderingContext2D;
    Screen3D.width = 640;
    Screen3D.height = 480;

    t.draw();
    t.drawBackward();
    expect((ctx.ellipse as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
    expect((ctx.stroke as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(0);
  });
});
