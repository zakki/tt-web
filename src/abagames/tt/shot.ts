/*
 * Ported from tt/src/abagames/tt/shot.d
 */

import { Actor, ActorPool } from "../util/actor";
import { Rand } from "../util/rand";
import { Vector } from "../util/vector";
import { Screen3D } from "../util/sdl/screen3d";
import { Screen } from "./screen";
import { ResizableDrawable, ShotShape } from "./shape";
import { Ship } from "./ship";
import { Tunnel } from "./tunnel";
import { SoundManager } from "./soundmanager";
import { shouldSuppressSfx } from "../util/sdl/sound";

interface EnemyPoolLike {
  checkShotHit(pos: Vector, shape: ResizableDrawable, shot: Shot): void;
}

interface BulletActorPoolLike {
  checkShotHit(pos: Vector, shape: ResizableDrawable, shot: Shot): void;
}

interface FloatLetterLike {
  set(text: string, pos: Vector, size: number, cnt: number): void;
}

interface FloatLetterPoolLike {
  getInstanceForced(): FloatLetterLike;
}

interface ParticleLike {
  set(...args: unknown[]): void;
}

interface ParticlePoolLike {
  getInstance(): ParticleLike | null;
}

/**
 * Player's shot.
 */
export class Shot extends Actor {
  private static readonly SPEED = 0.75;
  private static readonly RANGE_MIN = 2;
  private static readonly SIZE_MIN = 0.1;
  private static readonly MAX_CHARGE = 90;
  private static readonly SIZE_RATIO = 0.15;
  private static readonly RANGE_RATIO = 0.5;
  private static readonly CHARGE_RELEASE_RATIO = 0.25;
  private static readonly MAX_MULTIPLIER = 100;
  private static shotShape: ShotShape;
  private static chargeShotShape: ShotShape;
  private static rand: Rand;
  private tunnel!: Tunnel;
  private enemies!: EnemyPoolLike;
  private bullets!: BulletActorPoolLike;
  private floatLetters!: FloatLetterPoolLike;
  private particles!: ParticlePoolLike;
  private ship!: Ship;
  private pos!: Vector;
  private chargeCnt = 0;
  private chargeSeCnt = 0;
  private cnt = 0;
  private range = 0;
  private size = 1;
  private trgSize = 1;
  private chargeShot = false;
  private inCharge = false;
  private starShell = false;
  private shape!: ResizableDrawable;
  private multiplier = 1;
  private _damage = 1;
  private deg = 0;

  public static init(): void {
    Shot.shotShape = new ShotShape();
    Shot.shotShape.create(false);
    Shot.chargeShotShape = new ShotShape();
    Shot.chargeShotShape.create(true);
    Shot.rand = new Rand();
  }

  public static setRandSeed(seed: number): void {
    Shot.rand.setSeed(seed);
  }

  public static close(): void {
    Shot.shotShape.close();
  }

  public override init(args: unknown[] | null): void {
    if (!args || args.length < 6) throw new Error("Shot.init requires args");
    this.tunnel = args[0] as Tunnel;
    this.enemies = args[1] as EnemyPoolLike;
    this.bullets = args[2] as BulletActorPoolLike;
    this.floatLetters = args[3] as FloatLetterPoolLike;
    this.particles = args[4] as ParticlePoolLike;
    this.ship = args[5] as Ship;
    this.pos = new Vector();
    this.shape = new ResizableDrawable();
  }

  public set(charge = false, star = false, d = 0): void {
    this.cnt = 0;
    this.multiplier = 1;
    if (charge) {
      this.chargeShot = true;
      this.inCharge = true;
      this.range = 0;
      this.chargeCnt = 0;
      this.chargeSeCnt = 0;
      this.size = 0;
      this.trgSize = 0;
      this._damage = 100;
      this.starShell = false;
      this.deg = d;
      this.shape.shape(Shot.chargeShotShape);
    } else {
      this.chargeShot = false;
      this.inCharge = false;
      this.range = Ship.IN_SIGHT_DEPTH_DEFAULT;
      this.chargeCnt = 0;
      this.chargeSeCnt = 0;
      this.size = 1;
      this.trgSize = 1;
      this._damage = 1;
      this.starShell = star;
      this.deg = d;
      this.shape.shape(Shot.shotShape);
      if (!shouldSuppressSfx()) {
        SoundManager.playSe("shot.wav");
      }
    }
    this.exists = true;
  }

  public update(p: Vector): void {
    this.pos.x = p.x;
    this.pos.y = p.y + 0.3;
  }

  public release(): void {
    if (this.chargeCnt < Shot.MAX_CHARGE * Shot.CHARGE_RELEASE_RATIO) {
      this.remove();
      return;
    }
    this.inCharge = false;
    this.range = Shot.RANGE_MIN + this.chargeCnt * Shot.RANGE_RATIO;
    this.trgSize = Shot.SIZE_MIN + this.chargeCnt * Shot.SIZE_RATIO;
    SoundManager.playSe("charge_shot.wav");
  }

  public remove(): void {
    this.exists = false;
  }

  public override move(): void {
    if (this.inCharge) {
      if (this.chargeCnt < Shot.MAX_CHARGE) {
        this.chargeCnt++;
        this.trgSize = (Shot.SIZE_MIN + this.chargeCnt * Shot.SIZE_RATIO) * 0.33;
      }
      if (this.chargeSeCnt % 52 === 0) SoundManager.playSe("charge.wav");
      this.chargeSeCnt++;
    } else {
      this.pos.x += Math.sin(this.deg) * Shot.SPEED;
      this.pos.y += Math.cos(this.deg) * Shot.SPEED;
      this.range -= Shot.SPEED;
      if (this.range <= 0) this.remove();
      else if (this.range < 10) this.trgSize *= 0.75;
    }
    this.size += (this.trgSize - this.size) * 0.1;
    this.shape.size(this.size);
    if (!this.inCharge) {
      if (this.chargeShot) this.bullets.checkShotHit(this.pos, this.shape, this);
      this.enemies.checkShotHit(this.pos, this.shape, this);
    }
    if (this.starShell || this.chargeCnt > Shot.MAX_CHARGE * Shot.CHARGE_RELEASE_RATIO) {
      let pn = 1;
      if (this.chargeShot) pn = 3;
      for (let i = 0; i < pn; i++) {
        const pt = this.particles.getInstance();
        if (pt) {
          pt.set(
            this.pos,
            1,
            Shot.rand.nextSignedFloat(Math.PI / 2) + Math.PI,
            Shot.rand.nextSignedFloat(0.5),
            0.05,
            0.6,
            1,
            0.8,
            ((this.chargeCnt * 32) / Shot.MAX_CHARGE) | 0 + 4,
          );
        }
      }
    }
    this.cnt++;
  }

  public addScore(sc: number, pos: Vector): void {
    this.ship.addScore(sc * this.multiplier);
    if (this.multiplier > 1) {
      const fl = this.floatLetters.getInstanceForced();
      let fs = 0.07;
      if (sc >= 100) fs = 0.2;
      else if (sc >= 500) fs = 0.4;
      else if (sc >= 2000) fs = 0.7;
      fs *= 1 + this.multiplier * 0.01;
      fl.set(`X${this.multiplier}`, pos, fs * pos.y, (30 + this.multiplier * 0.3) | 0);
    }
    if (this.chargeShot) {
      if (this.multiplier < Shot.MAX_MULTIPLIER) this.multiplier++;
    } else {
      this.remove();
    }
  }

  public override draw(): void {
    const sp = this.tunnel.getPos(this.pos);
    glPushMatrix();
    Screen.glTranslate(sp);
    glRotatef((this.deg * 180) / Math.PI, 0, 1, 10);
    glRotatef(this.cnt * 7, 0, 0, 1);
    this.shape.draw();
    glPopMatrix();
  }

  public damage(): number {
    return this._damage;
  }
}

export class ShotPool extends ActorPool<Shot> {
  public constructor(n: number, args: unknown[]) {
    super(undefined, null, () => new Shot());
    this.createActors(n, args);
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
