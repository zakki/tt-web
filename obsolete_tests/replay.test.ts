import { beforeEach, describe, expect, it } from "vitest";
import { ReplayData } from "../src/abagames/tt/replay";

class MockStorage implements Storage {
  private m = new Map<string, string>();
  public get length(): number {
    return this.m.size;
  }
  public clear(): void {
    this.m.clear();
  }
  public getItem(key: string): string | null {
    return this.m.has(key) ? this.m.get(key)! : null;
  }
  public key(index: number): string | null {
    return Array.from(this.m.keys())[index] ?? null;
  }
  public removeItem(key: string): void {
    this.m.delete(key);
  }
  public setItem(key: string, value: string): void {
    this.m.set(key, value);
  }
}

describe("ReplayData", () => {
  beforeEach(() => {
    (globalThis as { localStorage: Storage }).localStorage = new MockStorage();
  });

  it("saves and loads level/grade/seed and padRecord", () => {
    const r = new ReplayData();
    r.level = 7;
    r.grade = 2;
    r.seed = 123456;
    r.padRecord.add(42);
    r.padRecord.add(42);
    r.padRecord.add(9);

    r.save("unit.rpl");

    const loaded = new ReplayData();
    loaded.load("unit.rpl");
    expect(loaded.level).toBe(7);
    expect(loaded.grade).toBe(2);
    expect(loaded.seed).toBe(123456);
    expect(loaded.padRecord.hasNext()).toBe(true);
    expect(loaded.padRecord.next()).toBe(42);
  });

  it("throws on wrong version", () => {
    const key = `${ReplayData.dir}/bad.rpl`;
    globalThis.localStorage.setItem(
      key,
      JSON.stringify({
        version: ReplayData.VERSION_NUM + 1,
        level: 1,
        grade: 0,
        seed: 0,
      }),
    );
    const r = new ReplayData();
    expect(() => r.load("bad.rpl")).toThrow("Wrong version num");
  });
});
