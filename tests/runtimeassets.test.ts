import { beforeEach, describe, expect, it } from "vitest";
import { BarrageManager } from "../src/abagames/tt/barrage";
import { createRunnerFromParser } from "../src/abagames/tt/bulletmlbridge";
import { initializeRuntimeAssetsFromGlobals } from "../src/abagames/tt/runtimeassets";

describe("runtimeassets", () => {
  beforeEach(() => {
    BarrageManager.unload();
    const g = globalThis as unknown as {
      __ttBarrageParsers?: Record<string, Record<string, unknown>>;
      __ttMusicFiles?: string[];
      __ttBulletMLRunnerFactory?: {
        createRunnerFromParser?: (parser: unknown) => unknown;
      };
    };
    delete g.__ttBarrageParsers;
    delete g.__ttMusicFiles;
    delete g.__ttBulletMLRunnerFactory;
  });

  it("loads barrage manifest and runner factory from globals", () => {
    const g = globalThis as unknown as {
      __ttBarrageParsers?: Record<string, Record<string, unknown>>;
      __ttBulletMLRunnerFactory?: {
        createRunnerFromParser?: (parser: unknown) => unknown;
      };
    };
    g.__ttBarrageParsers = {
      middle: {
        "nway.xml": { kind: "mock-parser" },
      },
    };
    g.__ttBulletMLRunnerFactory = {
      createRunnerFromParser: () => ({ end: false, run: () => {} }),
    };

    initializeRuntimeAssetsFromGlobals();

    expect(BarrageManager.getInstanceList("middle").length).toBe(1);
    const runner = createRunnerFromParser({});
    expect(runner.end).toBe(false);
  });
});
