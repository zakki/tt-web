/*
 * Ported from tt/src/abagames/tt/bulletactorpool.d
 */

import { ActorPool } from "../util/actor";
import type { BulletMLRunner, BulletMLState } from "../util/bulletml/bullet";
import { Bullet } from "../util/bulletml/bullet";
import type { BulletsManager } from "../util/bulletml/bulletsmanager";
import { Vector } from "../util/vector";
import { BulletActor } from "./bulletactor";
import { BulletImpl, ParserParam, type BulletMLParser } from "./bulletimpl";
import type { BulletTarget } from "./bullettarget";
import type { Drawable, Collidable } from "./shape";
import type { Shot } from "./shot";
import { createRunnerFromParser, createRunnerFromState } from "./bulletmlbridge";
import { registerBulletMLRunnerCallbacks } from "./bulletmlcallbacks";

/**
 * Bullet actor pool that works as BulletsManager.
 */
export class BulletActorPool extends ActorPool<BulletActor> implements BulletsManager {
  private cnt = 0;

  public constructor(n: number, args: unknown[]) {
    super(undefined, null, () => new BulletActor());
    this.createActors(n, args);
    Bullet.setBulletsManager(this);
    this.cnt = 0;
  }

  public addBullet(deg: number, speed: number): void;
  public addBullet(state: BulletMLState, deg: number, speed: number): void;
  public addBullet(a: number | BulletMLState, b: number, c?: number): void {
    const deg = typeof a === "number" ? a : b;
    const speed = typeof a === "number" ? b : c ?? 0;
    const state = typeof a === "number" ? null : a;
    const rb = (Bullet.now as BulletImpl).rootBullet as BulletActor | null;
    if (rb && rb.rootRank <= 0) return;
    const ba = this.getInstance();
    if (!ba) return;
    const nbi = ba.bullet;
    nbi.setParam(Bullet.now as BulletImpl);
    if (state) {
      const runner = createRunnerFromState(state);
      BulletActorPool.registFunctions(runner);
      ba.set(runner, Bullet.now.pos.x, Bullet.now.pos.y, deg, speed);
      return;
    }
    if (nbi.gotoNextParser()) {
      const runner = createRunnerFromParser(nbi.getParser());
      BulletActorPool.registFunctions(runner);
      ba.set(runner, Bullet.now.pos.x, Bullet.now.pos.y, deg, speed);
      ba.setMorphSeed();
    } else {
      ba.set(Bullet.now.pos.x, Bullet.now.pos.y, deg, speed);
    }
  }

  public addSimpleBullet(deg: number, speed: number): void {
    this.addBullet(deg, speed);
  }

  public addStateBullet(state: BulletMLState, deg: number, speed: number): void {
    this.addBullet(state, deg, speed);
  }

  public addTopBullet(
    parserParam: ParserParam[],
    x: number,
    y: number,
    deg: number,
    speed: number,
    shape: Drawable | null,
    disapShape: Drawable | null,
    xReverse: number,
    yReverse: number,
    longRange: boolean,
    target: BulletTarget,
    prevWait: number,
    postWait: number,
  ): BulletActor | null {
    const ba = this.getInstance();
    if (!ba) return null;
    const nbi = ba.bullet;
    nbi.setParamFirst(parserParam, shape, disapShape, xReverse, yReverse, longRange, target, ba);
    const runner = createRunnerFromParser(nbi.getParser());
    BulletActorPool.registFunctions(runner);
    ba.set(runner, x, y, deg, speed);
    ba.setWait(prevWait, postWait);
    ba.setTop();
    return ba;
  }

  public addMoveBullet(
    parser: BulletMLParser,
    speed: number,
    x: number,
    y: number,
    deg: number,
    target: BulletTarget,
  ): BulletActor | null {
    const ba = this.getInstance();
    if (!ba) return null;
    const bi = ba.bullet;
    bi.setParamFirst(null, null, null, 1, 1, false, target, ba);
    const runner = createRunnerFromParser(parser);
    BulletActorPool.registFunctions(runner);
    ba.set(runner, x, y, deg, speed);
    ba.setInvisible();
    return ba;
  }

  public override move(): void {
    super.move();
    this.cnt++;
  }

  public override draw(): void {
    for (const ba of this.actor) if (ba.exists) ba.draw();
  }

  public getTurn(): number {
    return this.cnt;
  }

  public killMe(bullet: Bullet): void {
    const ba = this.actor[bullet.id];
    if (!ba) return;
    ba.remove();
  }

  public override clear(): void {
    for (const ba of this.actor) if (ba.exists) ba.removeForced();
    this.actorIdx = 0;
    this.cnt = 0;
  }

  public clearVisible(): void {
    for (const ba of this.actor) if (ba.exists) ba.startDisappear();
  }

  public checkShotHit(pos: Vector, shape: Collidable, shot: Shot): void {
    for (const ba of this.actor) if (ba.exists) ba.checkShotHit(pos, shape, shot);
  }

  public static registFunctions(runner: BulletMLRunner): void {
    registerBulletMLRunnerCallbacks(runner);
  }
}
