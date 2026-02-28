/*
 * Ported from tt/src/abagames/tt/ship.d
 */

import { Rand } from "../util/rand";
import { Pad } from "../util/sdl/pad";
import { RecordablePad } from "../util/sdl/recordablepad";
import { Vector, Vector3 } from "../util/vector";
import { Letter } from "./letter";
import { Screen } from "./screen";
import { ShipShape } from "./shape";
import type { BulletTarget } from "./bullettarget";
import { SliceState, Tunnel } from "./tunnel";
import { Screen3D } from "../util/sdl/screen3d";
import { Camera } from "./camera";
import { SoundManager } from "./soundmanager";

interface ShotLike {
  set(charge?: boolean, starShell?: boolean, deg?: number): void;
  update(pos: Vector): void;
  release(): void;
  remove(): void;
}

interface ShotPoolLike {
  getInstance(): ShotLike | null;
  getInstanceForced(): ShotLike;
}

interface ParticleLike {
  set(...args: unknown[]): void;
}

interface ParticlePoolLike {
  getInstance(): ParticleLike | null;
  getInstanceForced(): ParticleLike;
}

interface InGameStateLike {
  shipDestroyed(): void;
  addScore(sc: number): void;
  clearVisibleBullets(): void;
  gotoNextZone(): void;
}

interface CameraLike {
  cameraPos: Vector3;
  lookAtPos: Vector3;
  deg: number;
  zoom: number;
  start(): void;
  move(): void;
}

/**
 * My ship.
 */
export class Ship implements BulletTarget {
  public static readonly IN_SIGHT_DEPTH_DEFAULT = 35;
  public static readonly RELPOS_MAX_Y = 10;
  public static readonly Grade = {
    NORMAL: 0,
    HARD: 1,
    EXTREME: 2,
  } as const;
  public static readonly GRADE_NUM = 3;
  public static readonly GRADE_LETTER = ["N", "H", "E"];
  public static readonly GRADE_STR = ["NORMAL", "HARD", "EXTREME"];
  public static replayMode = false;
  public static cameraMode = true;
  public static drawFrontMode = true;
  public isGameOver = false;

  private static readonly RESTART_CNT = 268;
  private static readonly INVINCIBLE_CNT = 228;
  private static readonly HIT_WIDTH = 0.00025;
  private static readonly EYE_HEIGHT = 0.8;
  private static readonly LOOKAT_HEIGHT = 0.9;
  private readonly rand: Rand;
  private readonly pad: RecordablePad;
  private readonly tunnel: Tunnel;
  private shots: ShotPoolLike | null = null;
  private particles: ParticlePoolLike | null = null;
  private gameState: InGameStateLike | null = null;
  private readonly _pos: Vector;
  private readonly _relPos: Vector;
  private readonly _eyePos: Vector;
  private readonly rocketPos: Vector;
  private d1 = 0;
  private d2 = 0;
  private grade = 0;
  private nextStarAppDist = 0;
  private readonly starPos: Vector;
  private lap = 1;
  private static readonly SPEED_DEFAULT = [0.4, 0.6, 0.8];
  private static readonly SPEED_MAX = [0.8, 1.2, 1.6];
  private static readonly ACCEL_RATIO = [0.002, 0.003, 0.004];
  private targetSpeed = 0;
  private _speed = 0;
  private _inSightDepth = Ship.IN_SIGHT_DEPTH_DEFAULT;
  private static readonly BANK_MAX_DEFAULT = [0.8, 1.0, 1.2];
  private static readonly OUT_OF_COURSE_BANK = 1.0;
  private static readonly RELPOS_Y_MOVE = 0.1;
  private bank = 0;
  private bankMax = 0;
  private tunnelOfs = 0;
  private readonly pos3: Vector3;
  private readonly _shape: ShipShape;
  private readonly epos: Vector3;
  private chargingShot: ShotLike | null = null;
  private static readonly FIRE_INTERVAL = 2;
  private static readonly STAR_SHELL_INTERVAL = 7;
  private regenerativeCharge = 0;
  private fireCnt = 0;
  private static readonly GUNPOINT_WIDTH = 0.05;
  private fireShotCnt = 0;
  private sideFireCnt = 0;
  private sideFireShotCnt = 0;
  private readonly gunpointPos: Vector;
  private rank = 0;
  private bossAppRank = 0;
  private bossAppNum = 0;
  private zoneEndRank = 0;
  private _inBossMode = false;
  private _isBossModeEnd = false;
  private cnt = 0;
  private screenShakeCnt = 0;
  private screenShakeIntense = 0;
  private readonly camera: CameraLike;
  private btnPressed = false;

  public constructor(pad: Pad, tunnel: Tunnel, camera: CameraLike | null = null) {
    this.rand = new Rand();
    this.pad = pad as RecordablePad;
    this.tunnel = tunnel;
    this._pos = new Vector();
    this._relPos = new Vector();
    this._eyePos = new Vector();
    this.rocketPos = new Vector();
    this.starPos = new Vector();
    this.pos3 = new Vector3();
    this.epos = new Vector3();
    this._shape = new ShipShape(1);
    this._shape.create(ShipShape.Type.SMALL);
    this.gunpointPos = new Vector();
    this.camera = camera ?? new Camera(this);
    Ship.drawFrontMode = true;
    Ship.cameraMode = true;
  }

  public setParticles(particles: ParticlePoolLike): void {
    this.particles = particles;
  }

  public setShots(shots: ShotPoolLike): void {
    this.shots = shots;
  }

  public setGameState(gameState: InGameStateLike): void {
    this.gameState = gameState;
  }

  public start(grd: number, seed: number): void {
    this.rand.setSeed(seed);
    this.grade = grd;
    this.tunnelOfs = 0;
    this._pos.x = 0;
    this._pos.y = 0;
    this._relPos.x = 0;
    this._relPos.y = 0;
    this._eyePos.x = 0;
    this._eyePos.y = 0;
    this.bank = 0;
    this._speed = 0;
    this.d1 = 0;
    this.d2 = 0;
    this.cnt = -Ship.INVINCIBLE_CNT;
    this.fireShotCnt = 0;
    this.sideFireShotCnt = 0;
    this._inSightDepth = Ship.IN_SIGHT_DEPTH_DEFAULT;
    this.rank = 0;
    this.bankMax = Ship.BANK_MAX_DEFAULT[this.grade];
    this.nextStarAppDist = 0;
    this.lap = 1;
    this.isGameOver = false;
    this.restart();
    if (Ship.replayMode) this.camera.start();
    this.btnPressed = true;
  }

  public restart(): void {
    this.targetSpeed = 0;
    this.fireCnt = 0;
    this.sideFireCnt = 99999;
    if (this.chargingShot) {
      this.chargingShot.remove();
      this.chargingShot = null;
    }
    this.regenerativeCharge = 0;
  }

  public close(): void {
    this._shape.close();
  }

  public move(): void {
    this.cnt++;
    let btn = 0;
    let dir = 0;
    if (!Ship.replayMode) {
      btn = this.pad.getButtonState();
      dir = this.pad.getDirState();
      this.pad.record();
    } else {
      let ps = this.pad.replay();
      if (ps === RecordablePad.REPLAY_END) {
        ps = 0;
        this.isGameOver = true;
      }
      dir = ps & (Pad.Dir.UP | Pad.Dir.DOWN | Pad.Dir.LEFT | Pad.Dir.RIGHT);
      btn = ps & Pad.Button.ANY;
    }
    if (this.btnPressed) {
      if (btn) btn = 0;
      else this.btnPressed = false;
    }
    if (this.isGameOver) {
      btn = 0;
      dir = 0;
      this._speed *= 0.9;
      this.clearVisibleBullets();
      if (this.cnt < -Ship.INVINCIBLE_CNT) this.cnt = -Ship.RESTART_CNT;
    } else if (this.cnt < -Ship.INVINCIBLE_CNT) {
      btn = 0;
      dir = 0;
      this._relPos.y *= 0.99;
      this.clearVisibleBullets();
    }

    let as = this.targetSpeed;
    if (btn & Pad.Button.B) {
      as *= 0.5;
    } else {
      const acc = this.regenerativeCharge * 0.1;
      this._speed += acc;
      as += acc;
      this.regenerativeCharge -= acc;
    }
    if (this._speed < as) this._speed += (as - this._speed) * 0.015;
    else {
      if (btn & Pad.Button.B) this.regenerativeCharge -= (as - this._speed) * 0.05;
      this._speed += (as - this._speed) * 0.05;
    }
    this._pos.y += this._speed;
    this.tunnelOfs += this._speed;
    const tmv = this.tunnelOfs | 0;
    this.tunnel.goToNextSlice(tmv);
    this.addScore(tmv);
    this.tunnelOfs = this._pos.y - (this._pos.y | 0);
    if (this._pos.y >= this.tunnel.getTorusLength()) {
      this._pos.y -= this.tunnel.getTorusLength();
      this.lap++;
    }

    this.tunnel.setShipPos(this._relPos.x, this.tunnelOfs, this._pos.y);
    this.tunnel.setSlices();
    this.tunnel.setSlicesBackward();
    const sp = this.tunnel.getPos(this._relPos);
    this.pos3.x = sp.x;
    this.pos3.y = sp.y;
    this.pos3.z = sp.z;

    if (dir & Pad.Dir.RIGHT) this.bank += (-this.bankMax - this.bank) * 0.1;
    if (dir & Pad.Dir.LEFT) this.bank += (this.bankMax - this.bank) * 0.1;
    let overAccel = false;
    if (dir & Pad.Dir.UP) {
      if (this._relPos.y < Ship.RELPOS_MAX_Y) {
        this._relPos.y += Ship.RELPOS_Y_MOVE;
      } else {
        this.targetSpeed += Ship.ACCEL_RATIO[this.grade];
        if (!(btn & Pad.Button.B) && !this._inBossMode && !this._isBossModeEnd) overAccel = true;
      }
    }
    if (dir & Pad.Dir.DOWN && this._relPos.y > 0) this._relPos.y -= Ship.RELPOS_Y_MOVE;
    const acc = (this._relPos.y * (Ship.SPEED_MAX[this.grade] - Ship.SPEED_DEFAULT[this.grade])) / Ship.RELPOS_MAX_Y + Ship.SPEED_DEFAULT[this.grade];
    if (overAccel) this.targetSpeed += (acc - this.targetSpeed) * 0.001;
    else if (this.targetSpeed < acc) this.targetSpeed += (acc - this.targetSpeed) * 0.005;
    else this.targetSpeed += (acc - this.targetSpeed) * 0.03;
    this._inSightDepth = Ship.IN_SIGHT_DEPTH_DEFAULT * (1 + this._relPos.y / Ship.RELPOS_MAX_Y);
    if (this._speed > Ship.SPEED_MAX[this.grade]) {
      this._inSightDepth += (Ship.IN_SIGHT_DEPTH_DEFAULT * (this._speed - Ship.SPEED_MAX[this.grade]) / Ship.SPEED_MAX[this.grade]) * 3.0;
    }
    this.bank *= 0.9;
    this._pos.x += this.bank * 0.08 * (SliceState.DEFAULT_RAD / this.tunnel.getRadius(this._relPos.y));
    if (this._pos.x < 0) this._pos.x += Math.PI * 2;
    else if (this._pos.x >= Math.PI * 2) this._pos.x -= Math.PI * 2;
    this._relPos.x = this._pos.x;
    let ox = this._relPos.x - this._eyePos.x;
    if (ox > Math.PI) ox -= Math.PI * 2;
    else if (ox < -Math.PI) ox += Math.PI * 2;
    this._eyePos.x += ox * 0.1;
    if (this._eyePos.x < 0) this._eyePos.x += Math.PI * 2;
    else if (this._eyePos.x >= Math.PI * 2) this._eyePos.x -= Math.PI * 2;

    const sl = this.tunnel.getSlice(this._relPos.y);
    const co = this.tunnel.checkInCourse(this._relPos);
    if (co !== 0) {
      let bm = (-Ship.OUT_OF_COURSE_BANK * co - this.bank) * 0.075;
      if (bm > 1) bm = 1;
      else if (bm < -1) bm = -1;
      this._speed *= 1 - Math.abs(bm);
      this.bank += bm;
      let lo = Math.abs(this._pos.x - sl.getLeftEdgeDeg());
      if (lo > Math.PI) lo = Math.PI * 2 - lo;
      let ro = Math.abs(this._pos.x - sl.getRightEdgeDeg());
      if (ro > Math.PI) ro = Math.PI * 2 - ro;
      if (lo > ro) this._pos.x = sl.getRightEdgeDeg();
      else this._pos.x = sl.getLeftEdgeDeg();
      this._relPos.x = this._pos.x;
    }
    this.d1 += (sl.d1 - this.d1) * 0.05;
    this.d2 += (sl.d2 - this.d2) * 0.05;

    if (btn & Pad.Button.B) {
      if (!this.chargingShot && this.shots) {
        this.chargingShot = this.shots.getInstanceForced();
        this.chargingShot.set(true);
      }
    } else {
      if (this.chargingShot) {
        this.chargingShot.release();
        this.chargingShot = null;
      }
      if ((btn & Pad.Button.A) && this.shots) {
        if (this.fireCnt <= 0) {
          this.fireCnt = Ship.FIRE_INTERVAL;
          const shot = this.shots.getInstance();
          if (shot) {
            if (this.fireShotCnt % Ship.STAR_SHELL_INTERVAL === 0) shot.set(false, true);
            else shot.set();
            this.gunpointPos.x = this._relPos.x + Ship.GUNPOINT_WIDTH * ((this.fireShotCnt % 2) * 2 - 1);
            this.gunpointPos.y = this._relPos.y;
            shot.update(this.gunpointPos);
            this.fireShotCnt++;
          }
        }
        if (this.sideFireCnt <= 0) {
          this.sideFireCnt = 99999;
          const shot = this.shots.getInstance();
          if (shot) {
            let sideFireDeg =
              ((this._speed - Ship.SPEED_DEFAULT[this.grade]) / (Ship.SPEED_MAX[this.grade] - Ship.SPEED_DEFAULT[this.grade])) * 0.1;
            if (sideFireDeg < 0.01) sideFireDeg = 0.01;
            let d = sideFireDeg * (this.sideFireShotCnt % 5) * 0.2;
            if ((this.sideFireShotCnt % 2) === 1) d = -d;
            if (this.sideFireShotCnt % Ship.STAR_SHELL_INTERVAL === 0) shot.set(false, true, d);
            else shot.set(false, false, d);
            this.gunpointPos.x = this._relPos.x + Ship.GUNPOINT_WIDTH * ((this.fireShotCnt % 2) * 2 - 1);
            this.gunpointPos.y = this._relPos.y;
            shot.update(this.gunpointPos);
            this.sideFireShotCnt++;
          }
        }
      }
    }
    if (this.fireCnt > 0) this.fireCnt--;
    let ssc = 99999;
    if (this._speed > Ship.SPEED_DEFAULT[this.grade] * 1.33) {
      ssc = (100000 / (((this._speed - Ship.SPEED_DEFAULT[this.grade] * 1.33) * 99999) / (Ship.SPEED_MAX[this.grade] - Ship.SPEED_DEFAULT[this.grade]) + 1)) | 0;
    }
    if (this.sideFireCnt > ssc) this.sideFireCnt = ssc;
    if (this.sideFireCnt > 0) this.sideFireCnt--;
    this.rocketPos.x = this._relPos.x - this.bank * 0.1;
    this.rocketPos.y = this._relPos.y;
    if (this.chargingShot) this.chargingShot.update(this.rocketPos);
    if (this.cnt >= -Ship.INVINCIBLE_CNT && this.particles) this._shape.addParticles(this.rocketPos, this.particles);
    this.nextStarAppDist -= this._speed;
    if (this.nextStarAppDist <= 0 && this.particles) {
      for (let i = 0; i < 5; i++) {
        const pt = this.particles.getInstance();
        if (!pt) break;
        this.starPos.x = this._relPos.x + this.rand.nextSignedFloat(Math.PI / 2) + Math.PI;
        this.starPos.y = 32;
        pt.set(this.starPos, -8 - this.rand.nextFloat(56), Math.PI, 0, 0, 0.6, 0.7, 0.9, 100, 2);
      }
      this.nextStarAppDist = 1;
    }
    if (this.screenShakeCnt > 0) this.screenShakeCnt--;
    if (Ship.replayMode) this.camera.move();
  }

  public getTargetPos(): Vector {
    return this._relPos;
  }

  public setEyepos(): void {
    let ex = 0;
    let ey = 0;
    let ez = 0;
    let lx = 0;
    let ly = 0;
    let lz = 0;
    let deg = 0;
    if (!Ship.replayMode || !Ship.cameraMode) {
      this.epos.x = this._eyePos.x;
      this.epos.y = -1.1;
      this.epos.y += this._relPos.y * 0.3;
      this.epos.z = 30.0;
      const ep3 = this.tunnel.getPos(this.epos);
      ex = ep3.x;
      ey = ep3.y;
      ez = ep3.z;
      this.epos.x = this._eyePos.x;
      this.epos.y += 6.0;
      this.epos.y += this._relPos.y * 0.3;
      this.epos.z = 0;
      const lp3 = this.tunnel.getPos(this.epos);
      lx = lp3.x;
      ly = lp3.y;
      lz = lp3.z;
      deg = this._eyePos.x;
    } else {
      const ep3 = this.tunnel.getPos(this.camera.cameraPos);
      ex = ep3.x;
      ey = ep3.y;
      ez = ep3.z;
      const lp3 = this.tunnel.getPos(this.camera.lookAtPos);
      lx = lp3.x;
      ly = lp3.y;
      lz = lp3.z;
      deg = this.camera.deg;
      glMatrixMode(Screen3D.GL_PROJECTION);
      glLoadIdentity();
      const np = Screen.nearPlane * this.camera.zoom;
      glFrustum(-np, np, (-np * Screen.height) / Screen.width, (np * Screen.height) / Screen.width, 0.1, Screen.farPlane);
      glMatrixMode(Screen3D.GL_MODELVIEW);
    }
    if (this.screenShakeCnt > 0) {
      const mx = this.rand.nextSignedFloat(this.screenShakeIntense * (this.screenShakeCnt + 6));
      const my = this.rand.nextSignedFloat(this.screenShakeIntense * (this.screenShakeCnt + 6));
      const mz = this.rand.nextSignedFloat(this.screenShakeIntense * (this.screenShakeCnt + 6));
      ex += mx;
      ey += my;
      ez += mz;
      lx += mx;
      ly += my;
      lz += mz;
    }
    gluLookAt(ex, ey, ez, lx, ly, lz, Math.sin(deg), -Math.cos(deg), 0);
  }

  public setScreenShake(cnt: number, its: number): void {
    this.screenShakeCnt = cnt;
    this.screenShakeIntense = its;
  }

  public checkBulletHit(p: Vector, pp: Vector): boolean {
    if (this.cnt <= 0) return false;
    let bmvx = pp.x - p.x;
    let bmvy = pp.y - p.y;
    if (bmvx > Math.PI) bmvx -= Math.PI * 2;
    else if (bmvx < -Math.PI) bmvx += Math.PI * 2;
    const inaa = bmvx * bmvx + bmvy * bmvy;
    if (inaa > 0.00001) {
      let sofsx = this._relPos.x - p.x;
      let sofsy = this._relPos.y - p.y;
      if (sofsx > Math.PI) sofsx -= Math.PI * 2;
      else if (sofsx < -Math.PI) sofsx += Math.PI * 2;
      const inab = bmvx * sofsx + bmvy * sofsy;
      if (inab >= 0 && inab <= inaa) {
        const hd = sofsx * sofsx + sofsy * sofsy - (inab * inab) / inaa;
        if (hd >= 0 && hd <= Ship.HIT_WIDTH) {
          this.destroyed();
          return true;
        }
      }
    }
    return false;
  }

  private destroyed(): void {
    if (this.cnt <= 0 || !this.particles) return;
    for (let i = 0; i < 256; i++) {
      const pt = this.particles.getInstanceForced();
      pt.set(this._relPos, 1, this.rand.nextSignedFloat(Math.PI / 8), this.rand.nextSignedFloat(2.5), 0.5 + this.rand.nextFloat(1), 1, 0.2 + this.rand.nextFloat(0.8), 0.2, 32);
    }
    this.gameState?.shipDestroyed();
    SoundManager.playSe("myship_dest.wav");
    this.setScreenShake(32, 0.05);
    this.restart();
    this.cnt = -Ship.RESTART_CNT;
  }

  public hasCollision(): boolean {
    return this.cnt >= -Ship.INVINCIBLE_CNT;
  }

  public rankUp(isBoss: boolean): void {
    if ((this._inBossMode && !isBoss) || this.isGameOver) return;
    if (this._inBossMode) {
      this.bossAppNum--;
      if (this.bossAppNum <= 0) {
        this.rank++;
        this.gameState?.gotoNextZone();
        this._inBossMode = false;
        this._isBossModeEnd = true;
        this.bossAppRank = 9999999;
        return;
      }
    }
    this.rank++;
    if (this.rank >= this.bossAppRank) this._inBossMode = true;
  }

  public gotoNextZoneForced(): void {
    this.bossAppNum = 0;
    this._inBossMode = false;
    this._isBossModeEnd = true;
    this.bossAppRank = 9999999;
  }

  public startNextZone(): void {
    this._isBossModeEnd = false;
  }

  public rankDown(): void {
    if (this._inBossMode) return;
    this.rank--;
  }

  public setBossApp(rank: number, num: number, zoneEndRank: number): void {
    this.bossAppRank = rank;
    this.bossAppNum = num;
    this.zoneEndRank = zoneEndRank;
    this._inBossMode = false;
  }

  public addScore(sc: number): void {
    this.gameState?.addScore(sc);
  }

  public clearVisibleBullets(): void {
    this.gameState?.clearVisibleBullets();
  }

  public draw(): void {
    if (this.cnt < -Ship.INVINCIBLE_CNT || (this.cnt < 0 && (-this.cnt % 32) < 16)) return;
    glPushMatrix();
    glTranslatef(this.pos3.x, this.pos3.y, this.pos3.z);
    glRotatef(((this._pos.x - this.bank) * 180) / Math.PI, 0, 0, 1);
    glRotatef((this.d1 * 180) / Math.PI, 0, 1, 0);
    glRotatef((this.d2 * 180) / Math.PI, 1, 0, 0);
    this._shape.draw();
    glPopMatrix();
  }

  public drawFront(): void {
    Letter.drawNum((this._speed * 2500) | 0, 490, 420, 20);
    Letter.drawString("KM/H", 540, 445, 12);
    Letter.drawNum(this.rank, 150, 432, 16);
    Letter.drawString("/", 185, 448, 10);
    Letter.drawNum(this.zoneEndRank - this.rank, 250, 448, 10);
  }

  public get pos(): Vector {
    return this._pos;
  }
  public get relPos(): Vector {
    return this._relPos;
  }
  public get eyePos(): Vector {
    return this._eyePos;
  }
  public get speed(): number {
    return this._speed;
  }
  public get shape(): ShipShape {
    return this._shape;
  }
  public get inSightDepth(): number {
    return this._inSightDepth;
  }
  public get inBossMode(): boolean {
    return this._inBossMode;
  }
  public get isBossModeEnd(): boolean {
    return this._isBossModeEnd;
  }
  public get replayMode(): boolean {
    return Ship.replayMode;
  }
  public set replayMode(v: boolean) {
    Ship.replayMode = v;
  }
  public get cameraMode(): boolean {
    return Ship.cameraMode;
  }
  public set cameraMode(v: boolean) {
    Ship.cameraMode = v;
  }
  public get drawFrontMode(): boolean {
    return Ship.drawFrontMode;
  }
  public set drawFrontMode(v: boolean) {
    Ship.drawFrontMode = v;
  }
  public get gradeNum(): number {
    return Ship.GRADE_NUM;
  }
  public get gradeLetter(): string[] {
    return Ship.GRADE_LETTER;
  }
  public get gradeStr(): string[] {
    return Ship.GRADE_STR;
  }
}

function glPushMatrix(): void {
  Screen3D.glPushMatrix();
}
function glPopMatrix(): void {
  Screen3D.glPopMatrix();
}
function glTranslatef(x: number, y: number, z: number): void {
  Screen3D.glTranslatef(x, y, z);
}
function glRotatef(angleDeg: number, x: number, y: number, z: number): void {
  Screen3D.glRotatef(angleDeg, x, y, z);
}
function glMatrixMode(mode: number): void {
  Screen3D.glMatrixMode(mode);
}
function glLoadIdentity(): void {
  Screen3D.glLoadIdentity();
}
function glFrustum(left: number, right: number, bottom: number, top: number, nearVal: number, farVal: number): void {
  Screen3D.glFrustum(left, right, bottom, top, nearVal, farVal);
}
function gluLookAt(eyeX: number, eyeY: number, eyeZ: number, centerX: number, centerY: number, centerZ: number, upX: number, upY: number, upZ: number): void {
  Screen3D.gluLookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ);
}
