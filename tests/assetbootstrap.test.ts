import { describe, expect, it } from "vitest";
import { BarrageManager } from "../src/abagames/tt/barrage";
import { setupRuntimeAssets } from "../src/abagames/tt/assetbootstrap";
import { SoundManager } from "../src/abagames/tt/soundmanager";

describe("assetbootstrap", () => {
  it("registers static barrage manifest", async () => {
    BarrageManager.unload();
    await setupRuntimeAssets();

    expect(BarrageManager.getInstanceList("basic").length).toBeGreaterThan(0);
    expect(BarrageManager.getInstanceList("middle").length).toBeGreaterThan(0);
    expect(BarrageManager.getInstanceList("morph").length).toBeGreaterThan(0);
  });

  it("keeps pre-registered bgm list after loadSounds", async () => {
    await setupRuntimeAssets();
    SoundManager.loadSounds();
    const bgm = (SoundManager as unknown as { bgm: unknown[] }).bgm;
    expect(bgm.length).toBeGreaterThan(0);
  });
});
