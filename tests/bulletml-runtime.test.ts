import { describe, expect, it } from "vitest";
import { BulletMLParserAsset } from "../src/abagames/util/bulletml/runtime";

const NodeType = {
  NONE: 0,
  AIM: 1,
  ABSOLUTE: 2,
  RELATIVE: 3,
  SEQUENCE: 4,
} as const;

const NodeName = {
  BULLET: 0,
  ACTION: 1,
  FIRE: 2,
  REPEAT: 7,
  BULLET_REF: 8,
  ACTION_REF: 9,
  FIRE_REF: 10,
  DIRECTION: 16,
  SPEED: 17,
  PARAM: 18,
  BULLETML: 19,
  TIMES: 15,
} as const;

class FakeNode {
  public type = NodeType.NONE;
  public refID = -1;
  private parent: FakeNode | null = null;
  private readonly children: FakeNode[] = [];

  public constructor(
    public readonly name: number,
    private readonly valueFn: () => number = () => 0,
  ) {}

  public setParent(p: FakeNode | null): void {
    this.parent = p;
  }

  public getParent(): FakeNode | null {
    return this.parent;
  }

  public addChild(c: FakeNode): void {
    c.setParent(this);
    this.children.push(c);
  }

  public childSize(): number {
    return this.children.length;
  }

  public childBegin(): FakeNode | null {
    return this.children[0] ?? null;
  }

  public childList(): FakeNode[] {
    return this.children;
  }

  public getValue(): number {
    return this.valueFn();
  }

  public getChild(name: number): FakeNode | null {
    for (const c of this.children) {
      if (c.name === name) return c;
    }
    return null;
  }

  public getAllChildrenVec(name: number, out: FakeNode[]): void {
    for (const c of this.children) {
      if (c.name === name) out.push(c);
    }
  }

  public next(): FakeNode | null {
    if (!this.parent) return null;
    const siblings = this.parent.childList();
    const idx = siblings.indexOf(this);
    if (idx < 0 || idx + 1 >= siblings.length) return null;
    return siblings[idx + 1];
  }
}

function makeRunnerFromTop(
  top: FakeNode | FakeNode[],
  refs?: { action0?: FakeNode; fire0?: FakeNode; bullet0?: FakeNode },
) {
  const tops = Array.isArray(top) ? top : [top];
  const parser = {
    getTopActions: () => tops,
    isHorizontal: () => false,
    getBulletRef: (id: number) => {
      if (id === 0 && refs?.bullet0) return refs.bullet0;
      throw new Error(`missing bullet ref ${id}`);
    },
    getActionRef: (id: number) => {
      if (id === 0 && refs?.action0) return refs.action0;
      throw new Error(`missing action ref ${id}`);
    },
    getFireRef: (id: number) => {
      if (id === 0 && refs?.fire0) return refs.fire0;
      throw new Error(`missing fire ref ${id}`);
    },
  };

  const asset = new BulletMLParserAsset("test", "test");
  (asset as unknown as { parser: unknown }).parser = parser;
  const runner = asset.createRunner() as {
    run: () => void;
    isEnd: () => boolean;
    callbacks: Record<string, (...args: unknown[]) => unknown>;
  };

  let turn = 0;
  runner.callbacks = {
    getBulletDirection: () => 0,
    getAimDirection: () => 0,
    getBulletSpeed: () => 0,
    getDefaultSpeed: () => 1,
    getRank: () => 0.5,
    getTurn: () => turn,
    getBulletSpeedX: () => 0,
    getBulletSpeedY: () => 0,
    getRand: () => 0,
    doVanish: () => {},
    doChangeDirection: () => {},
    doChangeSpeed: () => {},
    doAccelX: () => {},
    doAccelY: () => {},
  };

  return {
    runner,
    nextTurn: () => {
      turn++;
    },
  };
}

describe("BulletML runtime core", () => {
  it("fires simple bullet from top action", () => {
    const topAction = new FakeNode(NodeName.ACTION);
    const fire = new FakeNode(NodeName.FIRE);
    const bullet = new FakeNode(NodeName.BULLET);
    const dir = new FakeNode(NodeName.DIRECTION, () => 90);
    dir.type = NodeType.ABSOLUTE;
    const speed = new FakeNode(NodeName.SPEED, () => 2);
    bullet.addChild(dir);
    bullet.addChild(speed);
    fire.addChild(bullet);
    topAction.addChild(fire);

    const { runner } = makeRunnerFromTop(topAction);
    const shots: Array<{ dir: number; speed: number }> = [];
    runner.callbacks.createSimpleBullet = (_r: unknown, d: number, s: number) => {
      shots.push({ dir: d, speed: s });
    };
    runner.callbacks.createBullet = () => {
      throw new Error("unexpected createBullet");
    };

    runner.run();

    expect(shots.length).toBeGreaterThanOrEqual(1);
    expect(shots[0]).toEqual({ dir: 90, speed: 2 });
  });

  it("resolves actionRef in repeat", () => {
    const topAction = new FakeNode(NodeName.ACTION);
    const repeat = new FakeNode(NodeName.REPEAT);
    const times = new FakeNode(NodeName.TIMES, () => 2);
    const actionRef = new FakeNode(NodeName.ACTION_REF);
    actionRef.refID = 0;
    repeat.addChild(times);
    repeat.addChild(actionRef);
    topAction.addChild(repeat);

    const refAction = new FakeNode(NodeName.ACTION);
    const fire = new FakeNode(NodeName.FIRE);
    const bullet = new FakeNode(NodeName.BULLET);
    fire.addChild(bullet);
    refAction.addChild(fire);
    const root = new FakeNode(NodeName.BULLETML);
    root.addChild(refAction);

    const { runner, nextTurn } = makeRunnerFromTop(topAction, { action0: refAction });

    let shotCount = 0;
    runner.callbacks.createSimpleBullet = () => {
      shotCount++;
    };
    runner.callbacks.createBullet = () => {
      throw new Error("unexpected createBullet");
    };

    runner.run();
    nextTurn();
    runner.run();
    nextTurn();

    expect(shotCount).toBe(2);
  });

  it("does not end until all top actions are finished", () => {
    const topFire = new FakeNode(NodeName.ACTION);
    const fire = new FakeNode(NodeName.FIRE);
    fire.addChild(new FakeNode(NodeName.BULLET));
    topFire.addChild(fire);

    const topWait = new FakeNode(NodeName.ACTION);
    const wait = new FakeNode(NodeName.WAIT, () => 10);
    topWait.addChild(wait);

    const { runner } = makeRunnerFromTop([topFire, topWait]);

    let shotCount = 0;
    runner.callbacks.createSimpleBullet = () => {
      shotCount++;
    };
    runner.callbacks.createBullet = () => {
      throw new Error("unexpected createBullet");
    };

    runner.run();

    expect(shotCount).toBe(1);
    expect(runner.isEnd()).toBe(false);
  });

  it("resolves fireRef from top action", () => {
    const topAction = new FakeNode(NodeName.ACTION);
    const fireRef = new FakeNode(NodeName.FIRE_REF);
    fireRef.refID = 0;
    topAction.addChild(fireRef);

    const fireDef = new FakeNode(NodeName.FIRE);
    const bullet = new FakeNode(NodeName.BULLET);
    fireDef.addChild(bullet);

    const { runner } = makeRunnerFromTop(topAction, { fire0: fireDef });

    let shotCount = 0;
    runner.callbacks.createSimpleBullet = () => {
      shotCount++;
    };
    runner.callbacks.createBullet = () => {
      throw new Error("unexpected createBullet");
    };

    runner.run();

    expect(shotCount).toBe(1);
  });

  it("resolves bulletRef in fire", () => {
    const topAction = new FakeNode(NodeName.ACTION);
    const fire = new FakeNode(NodeName.FIRE);
    const bulletRef = new FakeNode(NodeName.BULLET_REF);
    bulletRef.refID = 0;
    fire.addChild(bulletRef);
    topAction.addChild(fire);

    const bulletDef = new FakeNode(NodeName.BULLET);
    const dir = new FakeNode(NodeName.DIRECTION, () => 120);
    dir.type = NodeType.ABSOLUTE;
    const speed = new FakeNode(NodeName.SPEED, () => 1.5);
    bulletDef.addChild(dir);
    bulletDef.addChild(speed);

    const { runner } = makeRunnerFromTop(topAction, { bullet0: bulletDef });
    const shots: Array<{ dir: number; speed: number }> = [];
    runner.callbacks.createSimpleBullet = (_r: unknown, d: number, s: number) => {
      shots.push({ dir: d, speed: s });
    };
    runner.callbacks.createBullet = () => {
      throw new Error("unexpected createBullet");
    };

    runner.run();

    expect(shots).toEqual([{ dir: 120, speed: 1.5 }]);
  });
});
