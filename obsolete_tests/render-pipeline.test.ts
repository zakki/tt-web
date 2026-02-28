import { describe, expect, it, vi, afterEach } from "vitest";
import { InGameState, TitleState } from "../src/abagames/tt/gamemanager";
import { Screen3D } from "../src/abagames/util/sdl/screen3d";
import { Pad } from "../src/abagames/util/sdl/pad";
import { ReplayData } from "../src/abagames/tt/replay";

type FakeCtx = {
  save: () => void;
  restore: () => void;
  beginPath: () => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  stroke: () => void;
  fillRect: (x: number, y: number, w: number, h: number) => void;
  fillText: (text: string, x: number, y: number) => void;
  createLinearGradient: (x0: number, y0: number, x1: number, y1: number) => {
    addColorStop: (offset: number, color: string) => void;
  };
  strokeStyle: string;
  fillStyle: string | { addColorStop: (offset: number, color: string) => void };
  lineWidth: number;
  font: string;
  textBaseline: string;
  globalCompositeOperation: string;
};

function createFakeCtx(): FakeCtx {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    strokeStyle: "",
    fillStyle: "",
    lineWidth: 0,
    font: "",
    textBaseline: "",
    globalCompositeOperation: "source-over",
  };
}

function createInGameStateForDraw(order: string[]) {
  const pad = { keys: {} as Record<number, number>, getButtonState: () => 0 } as unknown as Pad;
  const ship = {
    isGameOver: false,
    draw: () => order.push("ship.draw"),
    drawFront: () => order.push("ship.drawFront"),
    drawLuminous: () => order.push("ship.drawLuminous"),
    setEyepos: () => order.push("ship.setEyepos"),
    inSightDepth: 35,
  };
  return new InGameState(
    { draw: () => order.push("tunnel.draw") } as never,
    ship as never,
    { move: () => {}, clear: () => {}, draw: () => order.push("shots.draw") } as never,
    { move: () => {}, clear: () => {}, draw: () => order.push("bullets.draw"), clearVisible: () => {} } as never,
    { move: () => {}, clear: () => {}, draw: () => order.push("enemies.draw") } as never,
    {
      move: () => {},
      clear: () => {},
      draw: () => order.push("particles.draw"),
      drawLuminous: () => order.push("particles.drawLuminous"),
    } as never,
    { move: () => {}, clear: () => {}, draw: () => order.push("floatLetters.draw") } as never,
    { move: () => {}, start: () => {} } as never,
    pad,
    {} as never,
    {} as never,
  );
}

afterEach(() => {
  Screen3D.ctx2d = null;
});

describe("Render pipeline", () => {
  it("InGameState.draw keeps D-order for world actors", () => {
    const order: string[] = [];
    const state = createInGameStateForDraw(order);
    Screen3D.ctx2d = createFakeCtx() as unknown as CanvasRenderingContext2D;
    Screen3D.width = 640;
    Screen3D.height = 480;

    state.draw();
    expect(order).toEqual([
      "ship.setEyepos",
      "tunnel.draw",
      "ship.draw",
      "enemies.draw",
      "shots.draw",
      "bullets.draw",
      "particles.draw",
      "floatLetters.draw",
    ]);
  });

  it("InGameState drawLuminous/drawFront call expected layers", () => {
    const order: string[] = [];
    const state = createInGameStateForDraw(order);
    const ctx = createFakeCtx();
    Screen3D.ctx2d = ctx as unknown as CanvasRenderingContext2D;

    state.drawLuminous();
    state.drawFront();

    expect(order).toContain("ship.drawLuminous");
    expect(order).toContain("particles.drawLuminous");
    expect(order).toContain("ship.drawFront");
    expect((ctx.fillText as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it("TitleState.drawLuminous executes additive front glow path", () => {
    const ctx = createFakeCtx();
    Screen3D.ctx2d = ctx as unknown as CanvasRenderingContext2D;
    Screen3D.width = 640;
    Screen3D.height = 480;

    const titleManager = {
      start: () => {},
      move: () => {},
      draw: () => {},
      drawFront: () => {},
      close: () => {},
    };
    const state = new TitleState(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      titleManager as never,
      {} as never,
      {} as never,
    );

    state.drawLuminous();
    expect((ctx.createLinearGradient as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1);
  });

  it("TitleState.drawLuminous adds right glow while replay transition is active", () => {
    const ctx = createFakeCtx();
    Screen3D.ctx2d = ctx as unknown as CanvasRenderingContext2D;
    Screen3D.width = 640;
    Screen3D.height = 480;

    const titleManager = {
      start: () => {},
      move: () => {},
      draw: () => {},
      drawFront: () => {},
      close: () => {},
      replayChangeRatio: 0.6,
    };
    const state = new TitleState(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      titleManager as never,
      {} as never,
      {} as never,
    );
    state.setReplayData(new ReplayData());
    state.drawLuminous();

    expect((ctx.createLinearGradient as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
    expect((ctx.fillRect as ReturnType<typeof vi.fn>).mock.calls.length).toBe(2);
  });
});
