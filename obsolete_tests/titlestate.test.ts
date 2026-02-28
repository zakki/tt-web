import { describe, expect, it } from "vitest";
import { TitleState } from "../src/abagames/tt/gamemanager";
import { ReplayData } from "../src/abagames/tt/replay";
import { Screen3D } from "../src/abagames/util/sdl/screen3d";

describe("TitleState replay flow", () => {
  it("starts replay world when replayData is set", () => {
    const calls = {
      startReplay: 0,
      shipStart: 0,
      stageStart: 0,
      tunnelBackward: 0,
      worldMove: 0,
    };
    const state = new TitleState(
      {
        setShipPos: () => {},
        setSlices: () => {},
        setSlicesBackward: () => {
          calls.tunnelBackward++;
        },
        draw: () => {},
        drawBackward: () => {},
      } as never,
      {
        isGameOver: false,
        start: () => {
          calls.shipStart++;
        },
        move: () => {
          calls.worldMove++;
        },
        draw: () => {},
        drawFront: () => {},
        setEyepos: () => {},
        setScreenShake: () => {},
      } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      {
        start: () => {
          calls.stageStart++;
        },
        move: () => calls.worldMove++,
      } as never,
      {
        startReplay: () => {
          calls.startReplay++;
        },
      } as never,
      { start: () => {}, move: () => {}, draw: () => {}, drawFront: () => {}, replayChangeRatio: 0, close: () => {} } as never,
      { clear: () => {}, move: () => calls.worldMove++, draw: () => {} } as never,
      { drawFront: () => {}, decrementTime: () => {} } as never,
    );

    const rd = new ReplayData();
    rd.level = 2;
    rd.grade = 1;
    rd.seed = 42;
    rd.padRecord.add(0);
    state.setReplayData(rd);

    state.start();
    state.move();

    expect(calls.startReplay).toBe(1);
    expect(calls.shipStart).toBe(1);
    expect(calls.stageStart).toBe(1);
    expect(calls.tunnelBackward).toBe(1);
    expect(calls.worldMove).toBeGreaterThan(0);
  });

  it("draws replay world before title background when replayData exists", () => {
    const order: string[] = [];
    Screen3D.ctx2d = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      rect: () => {},
      clip: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fillRect: () => {},
      ellipse: () => {},
      globalAlpha: 1,
      lineWidth: 1,
      strokeStyle: "",
    } as unknown as CanvasRenderingContext2D;
    const state = new TitleState(
      { setShipPos: () => {}, setSlices: () => {}, setSlicesBackward: () => {}, draw: () => order.push("tunnel"), drawBackward: () => order.push("backward") } as never,
      { isGameOver: false, start: () => {}, move: () => {}, draw: () => order.push("ship"), drawFront: () => {}, setEyepos: () => order.push("eyepos"), setScreenShake: () => {} } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("shots") } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("bullets") } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("enemies") } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("particles") } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("letters") } as never,
      { start: () => {}, move: () => {} } as never,
      { startReplay: () => {} } as never,
      { start: () => {}, move: () => {}, draw: () => order.push("title"), drawFront: () => {}, replayChangeRatio: 0, close: () => {} } as never,
      { clear: () => {}, move: () => {}, draw: () => order.push("passed") } as never,
      { drawFront: () => {}, decrementTime: () => {} } as never,
    );
    const rd = new ReplayData();
    rd.padRecord.add(0);
    state.setReplayData(rd);
    state.start();
    state.draw();
    Screen3D.ctx2d = null;

    expect(order[0]).toBe("eyepos");
    expect(order).toContain("tunnel");
    expect(order).toContain("title");
    expect(order[order.length - 1]).toBe("title");
  });

  it("drawFront fades in in-game HUD only near replay transition end", () => {
    let inGameFront = 0;
    let titleFront = 0;
    const ctx = {
      save: () => {},
      restore: () => {},
      globalAlpha: 1,
    };
    Screen3D.ctx2d = ctx as unknown as CanvasRenderingContext2D;

    const mkState = (ratio: number) =>
      new TitleState(
        { setShipPos: () => {}, setSlices: () => {}, setSlicesBackward: () => {}, draw: () => {}, drawBackward: () => {} } as never,
        { isGameOver: false, start: () => {}, move: () => {}, draw: () => {}, drawFront: () => {}, setEyepos: () => {}, setScreenShake: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { start: () => {}, move: () => {} } as never,
        { startReplay: () => {} } as never,
        { start: () => {}, move: () => {}, draw: () => {}, drawFront: () => titleFront++, replayChangeRatio: ratio, close: () => {} } as never,
        { clear: () => {}, move: () => {}, draw: () => {} } as never,
        { drawFront: () => inGameFront++, decrementTime: () => {} } as never,
      );

    mkState(0.2).drawFront();
    expect(titleFront).toBe(1);
    expect(inGameFront).toBe(0);

    mkState(0.9).drawFront();
    expect(titleFront).toBe(2);
    expect(inGameFront).toBe(1);
    Screen3D.ctx2d = null;
  });
});
