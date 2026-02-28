/*
 * Ported from tt/src/abagames/tt/enemy.d
 */

import { Actor, ActorPool } from "../util/actor";
import { Rand } from "../util/rand";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector, Vector3 } from "../util/vector";
import type { Collidable, ShipShape } from "./shape";
import { Ship } from "./ship";
import { SliceState, Tunnel } from "./tunnel";
import { Screen } from "./screen";
import { Shot } from "./shot";
import { SoundManager } from "./soundmanager";
import type { ParserParam } from "./bulletimpl";
import type { BulletTarget } from "./bullettarget";
import type { Drawable } from "./shape";

interface ParticleLike {
  set(...args: unknown[]): void;
}

interface ParticlePoolLike {
  getInstance(): ParticleLike | null;
}

export interface BulletLike {
  pos: Vector;
  deg: number;
}

export interface BulletActorLike {
  bullet: BulletLike;
  rootRank: number;
  unsetAimTop(): void;
  removeForced(): void;
}

export interface BulletActorPoolLike {
  addTopBullet(
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
  ): BulletActorLike | null;
}

export interface BarrageLike {
  addTopBullet(pool: BulletActorPoolLike, ship: Ship): BulletActorLike | null;
}

interface ShipSpecLike {
  shield: number;
  isBoss: boolean;
  aimShip: boolean;
  hasLimitY: boolean;
  noFireDepthLimit: boolean;
  bitNum: number;
  score: number;
  shape: ShipShape;
  damagedShape: ShipShape;
  barrage: BarrageLike;
  bitBarrage: BarrageLike;
  createBaseBank(rand: Rand): number;
  setSpeed(speed: number, shipSpeed?: number): number;
  handleLimitY(posY: number, limitY: number): { posY: number; limitY: number };
  getRangeOfMovement(ldOut: (v: number) => void, rdOut: (v: number) => void, pos: Vector, tunnel: Tunnel): boolean;
  tryToMove(bankRef: number, posX: number, targetX: number): number;
  getBitOffset(bitOffset: Vector, dOut: (v: number) => void, i: number, bitCnt: number): void;
}

export class Enemy extends Actor {
  private static readonly OUT_OF_COURSE_BANK = 1.0;
  private static readonly DISAP_DEPTH = -5.0;
  private static rand = new Rand();
  private tunnel!: Tunnel;
  private bullets!: BulletActorPoolLike;
  private ship!: Ship;
  private particles!: ParticlePoolLike;
  private spec!: ShipSpecLike;
  private pos!: Vector;
  private ppos!: Vector;
  private flipMv!: Vector;
  private flipMvCnt = 0;
  private speed = 0;
  private d1 = 0;
  private d2 = 0;
  private baseBank = 0;
  private cnt = 0;
  private bank = 0;
  private topBullet: BulletActorLike | null = null;
  private shield = 0;
  private firstShield = 0;
  private damaged = false;
  private highOrder = true;
  private limitY = 0;
  private bitBullet: BulletActorLike[] | null = null;
  private bitCnt = 0;
  private bitOffset!: Vector;
  private passed = false;
  private passedEnemies: EnemyPool | null = null;

  public static setRandSeed(seed: number): void {
    Enemy.rand.setSeed(seed);
  }

  public override init(args: unknown[] | null): void {
    if (!args || args.length < 4) throw new Error("Enemy.init requires args");
    this.tunnel = args[0] as Tunnel;
    this.bullets = args[1] as BulletActorPoolLike;
    this.ship = args[2] as Ship;
    this.particles = args[3] as ParticlePoolLike;
    this.pos = new Vector();
    this.ppos = new Vector();
    this.flipMv = new Vector();
    this.bitOffset = new Vector();
  }

  public setPassedEnemies(pe: EnemyPool): void {
    this.passedEnemies = pe;
  }

  public set(spec: ShipSpecLike, x: number, y: number, rand: Rand | null, ps = false, baseBank = 0): void {
    this.spec = spec;
    this.pos.x = x;
    this.limitY = this.pos.y = y;
    this.speed = 0;
    this.d1 = 0;
    this.d2 = 0;
    this.cnt = 0;
    this.bank = 0;
    this.firstShield = this.shield = spec.shield;
    if (!ps) this.baseBank = spec.createBaseBank(rand ?? Enemy.rand);
    else this.baseBank = baseBank;
    this.flipMvCnt = 0;
    this.damaged = false;
    this.highOrder = true;
    this.topBullet = null;
    this.bitBullet = null;
    this.passed = ps;
    this.exists = true;
  }

  public override move(): void {
    if (!this.passed) {
      if (this.highOrder) {
        if (this.pos.y <= this.ship.relPos.y) {
          this.ship.rankUp(this.spec.isBoss);
          this.highOrder = false;
        }
      } else if (this.pos.y > this.ship.relPos.y) {
        this.ship.rankDown();
        this.highOrder = true;
      }
    }
    this.ppos.x = this.pos.x;
    this.ppos.y = this.pos.y;
    if (this.ship.isBossModeEnd) {
      this.speed += (0 - this.speed) * 0.05;
      this.flipMvCnt = 0;
    } else if (!this.ship.hasCollision()) {
      this.speed += (1.5 - this.speed) * 0.15;
    }
    if (this.spec.hasLimitY) this.speed = this.spec.setSpeed(this.speed, this.ship.speed);
    else if (this.pos.y > 5 && this.pos.y < Ship.IN_SIGHT_DEPTH_DEFAULT * 2) this.speed = this.spec.setSpeed(this.speed, this.ship.speed);
    else this.speed = this.spec.setSpeed(this.speed);
    let my = this.speed - this.ship.speed;
    if (this.passed && my > 0) my = 0;
    this.pos.y += my;
    if (!this.passed && this.spec.hasLimitY) {
      const limited = this.spec.handleLimitY(this.pos.y, this.limitY);
      this.pos.y = limited.posY;
      this.limitY = limited.limitY;
    }

    let ld = 0;
    let rd = 0;
    let steer = false;
    if (this.spec.getRangeOfMovement((v) => (ld = v), (v) => (rd = v), this.pos, this.tunnel)) {
      const cdf = Tunnel.checkDegInside(this.pos.x, ld, rd);
      if (cdf !== 0) {
        steer = true;
        if (cdf === -1) this.bank = this.spec.tryToMove(this.bank, this.pos.x, ld);
        else if (cdf === 1) this.bank = this.spec.tryToMove(this.bank, this.pos.x, rd);
      }
    }
    if (!steer && this.spec.aimShip) {
      let ox = Math.abs(this.pos.x - this.ship.pos.x);
      if (ox > Math.PI) ox = Math.PI * 2 - ox;
      if (ox > Math.PI / 3) {
        steer = true;
        this.bank = this.spec.tryToMove(this.bank, this.pos.x, this.ship.pos.x);
      }
    }
    if (!steer) this.bank += (this.baseBank - this.bank) * 0.2;
    this.bank *= 0.9;
    this.pos.x += this.bank * 0.08 * (SliceState.DEFAULT_RAD / this.tunnel.getRadius(this.pos.y));
    if (this.flipMvCnt > 0) {
      this.flipMvCnt--;
      this.pos.opAddAssign(this.flipMv);
      this.flipMv.opMulAssign(0.95);
    }
    if (this.pos.x < 0) this.pos.x += Math.PI * 2;
    else if (this.pos.x >= Math.PI * 2) this.pos.x -= Math.PI * 2;

    if (!this.passed && this.flipMvCnt <= 0 && !this.ship.isBossModeEnd) {
      let ax = Math.abs(this.pos.x - this.ship.relPos.x);
      if (ax > Math.PI) ax = Math.PI * 2 - ax;
      ax *= this.tunnel.getRadius(0) / SliceState.DEFAULT_RAD;
      ax *= 3;
      const ay = Math.abs(this.pos.y - this.ship.relPos.y);
      if (this.ship.hasCollision() && this.spec.shape.checkCollision(ax, ay, this.ship.shape, this.ship.speed)) {
        let ox = this.ppos.x - this.ship.pos.x;
        if (ox > Math.PI) ox -= Math.PI * 2;
        else if (ox < -Math.PI) ox += Math.PI * 2;
        const oy = this.ppos.y;
        const od = Math.atan2(ox, oy);
        this.flipMvCnt = 48;
        this.flipMv.x = Math.sin(od) * this.ship.speed * 0.4;
        this.flipMv.y = Math.cos(od) * this.ship.speed * 7;
      }
    }

    const sl = this.tunnel.getSlice(this.pos.y);
    const co = this.tunnel.checkInCourse(this.pos);
    if (co !== 0) {
      let bm = (-Enemy.OUT_OF_COURSE_BANK * co - this.bank) * 0.075;
      if (bm > 1) bm = 1;
      else if (bm < -1) bm = -1;
      this.speed *= 1 - Math.abs(bm);
      this.bank += bm;
      let lo = Math.abs(this.pos.x - sl.getLeftEdgeDeg());
      if (lo > Math.PI) lo = Math.PI * 2 - lo;
      let ro = Math.abs(this.pos.x - sl.getRightEdgeDeg());
      if (ro > Math.PI) ro = Math.PI * 2 - ro;
      if (lo > ro) this.pos.x = sl.getRightEdgeDeg();
      else this.pos.x = sl.getLeftEdgeDeg();
    }
    this.d1 += (sl.d1 - this.d1) * 0.1;
    this.d2 += (sl.d2 - this.d2) * 0.1;

    if (!this.passed && !this.topBullet) {
      this.topBullet = this.spec.barrage.addTopBullet(this.bullets, this.ship);
      for (let i = 0; i < this.spec.bitNum; i++) {
        const ba = this.spec.bitBarrage.addTopBullet(this.bullets, this.ship);
        if (ba) {
          ba.unsetAimTop();
          if (!this.bitBullet) this.bitBullet = [];
          this.bitBullet.push(ba);
        }
      }
    }
    if (this.topBullet) {
      this.topBullet.bullet.pos.x = this.pos.x;
      this.topBullet.bullet.pos.y = this.pos.y;
      this.checkBulletInRange(this.topBullet);
      if (this.bitBullet) {
        for (let i = 0; i < this.bitBullet.length; i++) {
          const bb = this.bitBullet[i];
          let d = 0;
          this.spec.getBitOffset(this.bitOffset, (v) => (d = v), i, this.bitCnt);
          bb.bullet.pos.x = this.bitOffset.x + this.pos.x;
          bb.bullet.pos.y = this.bitOffset.y + this.pos.y;
          bb.bullet.deg = d;
          this.checkBulletInRange(bb);
        }
      }
    }

    if (!this.passed && this.pos.y <= this.ship.inSightDepth) this.spec.shape.addParticles(this.pos, this.particles);
    if (!this.passed) {
      if ((!this.spec.hasLimitY && this.pos.y > Ship.IN_SIGHT_DEPTH_DEFAULT * 5) || this.pos.y < Enemy.DISAP_DEPTH) {
        if (Ship.replayMode && this.pos.y < Enemy.DISAP_DEPTH && this.passedEnemies) {
          const en = this.passedEnemies.getInstance();
          if (en) en.set(this.spec, this.pos.x, this.pos.y, null, true, this.baseBank);
        }
        this.remove();
      }
    } else if (this.pos.y < -Ship.IN_SIGHT_DEPTH_DEFAULT * 3) {
      this.remove();
    }
    this.damaged = false;
    this.bitCnt++;
  }

  private checkBulletInRange(ba: BulletActorLike): void {
    if (!this.tunnel.checkInScreen(this.pos, this.ship)) {
      ba.rootRank = 0;
    } else {
      if (this.pos.dist(this.ship.relPos) > 20 + (this.ship.relPos.y * 10) / Ship.RELPOS_MAX_Y && this.pos.y > this.ship.relPos.y && this.flipMvCnt <= 0) {
        if (this.spec.noFireDepthLimit) ba.rootRank = 1;
        else if (this.pos.y <= this.ship.inSightDepth) ba.rootRank = 1;
        else ba.rootRank = 0;
      } else {
        ba.rootRank = 0;
      }
    }
  }

  public checkShotHit(p: Vector, shape: Collidable, shot: Shot): void {
    let ox = Math.abs(this.pos.x - p.x);
    const oy = Math.abs(this.pos.y - p.y);
    if (ox > Math.PI) ox = Math.PI * 2 - ox;
    ox *= this.tunnel.getRadius(this.pos.y) / SliceState.DEFAULT_RAD;
    ox *= 3;
    if (this.spec.shape.checkCollision(ox, oy, shape)) {
      this.shield -= shot.damage();
      if (this.shield <= 0) {
        this.destroyed();
      } else {
        this.damaged = true;
        for (let i = 0; i < 4; i++) {
          let pt = this.particles.getInstance();
          if (pt) pt.set(this.pos, 1, Enemy.rand.nextSignedFloat(0.1), Enemy.rand.nextSignedFloat(1.6), 0.75, 1, 0.4 + Enemy.rand.nextFloat(0.4), 0.3);
          pt = this.particles.getInstance();
          if (pt) pt.set(this.pos, 1, Enemy.rand.nextSignedFloat(0.1) + Math.PI, Enemy.rand.nextSignedFloat(1.6), 0.75, 1, 0.4 + Enemy.rand.nextFloat(0.4), 0.3);
        }
        SoundManager.playSe("hit.wav");
      }
      shot.addScore(this.spec.score, this.pos);
    }
  }

  private destroyed(): void {
    for (let i = 0; i < 30; i++) {
      const pt = this.particles.getInstance();
      if (!pt) break;
      pt.set(this.pos, 1, Enemy.rand.nextFloat(Math.PI * 2), Enemy.rand.nextSignedFloat(1), 0.01 + Enemy.rand.nextFloat(0.1), 1, 0.2 + Enemy.rand.nextFloat(0.8), 0.4, 24);
    }
    this.spec.shape.addFragments(this.pos, this.particles);
    this.ship.rankUp(this.spec.isBoss);
    if (this.firstShield === 1) SoundManager.playSe("small_dest.wav");
    else if (this.firstShield < 20) SoundManager.playSe("middle_dest.wav");
    else {
      SoundManager.playSe("boss_dest.wav");
      this.ship.setScreenShake(56, 0.064);
    }
    this.remove();
  }

  public remove(): void {
    if (this.topBullet) {
      this.topBullet.removeForced();
      this.topBullet = null;
      if (this.bitBullet) {
        for (const bb of this.bitBullet) bb.removeForced();
        this.bitBullet = null;
      }
    }
    this.exists = false;
  }

  public override draw(): void {
    let sp = this.tunnel.getPos(this.pos);
    glPushMatrix();
    Screen.glTranslate(sp);
    glRotatef(((this.pos.x - this.bank) * 180) / Math.PI, 0, 0, 1);
    if (sp.z > 200) {
      const sz = 1 - (sp.z - 200) * 0.0025;
      glScalef(sz, sz, sz);
    }
    glRotatef((this.d1 * 180) / Math.PI, 0, 1, 0);
    glRotatef((this.d2 * 180) / Math.PI, 1, 0, 0);
    if (!this.damaged) this.spec.shape.draw();
    else this.spec.damagedShape.draw();
    glPopMatrix();
    if (this.bitBullet) {
      for (const bb of this.bitBullet) {
        sp = this.tunnel.getPos(bb.bullet.pos);
        glPushMatrix();
        Screen.glTranslate(sp);
        glRotatef(this.bitCnt * 7, 0, 1, 0);
        glRotatef((this.pos.x * 180) / Math.PI, 0, 0, 1);
        // ShipSpec.bitShape draw path is preserved via spec fallback:
        this.spec.shape.draw();
        glPopMatrix();
      }
    }
  }
}

export class EnemyPool extends ActorPool<Enemy> {
  public constructor(n: number, args: unknown[]) {
    super(undefined, null, () => new Enemy());
    this.createActors(n, args);
  }

  public checkShotHit(pos: Vector, shape: Collidable, shot: Shot): void {
    for (const e of this.actor) if (e.exists) e.checkShotHit(pos, shape, shot);
  }

  public getNum(): number {
    let num = 0;
    for (const e of this.actor) if (e.exists) num++;
    return num;
  }

  public setPassedEnemies(pe: EnemyPool): void {
    for (const e of this.actor) e.setPassedEnemies(pe);
  }

  public override clear(): void {
    for (const e of this.actor) if (e.exists) e.remove();
    super.clear();
  }
}

function glPushMatrix(): void {
  Screen3D.glPushMatrix();
}
function glPopMatrix(): void {
  Screen3D.glPopMatrix();
}
function glRotatef(angleDeg: number, x: number, y: number, z: number): void {
  Screen3D.glRotatef(angleDeg, x, y, z);
}
function glScalef(x: number, y: number, z: number): void {
  Screen3D.glScalef(x, y, z);
}
