/*
 * Ported from tt/src/abagames/tt/bulletactor.d
 */

import { Actor } from "../util/actor";
import { Screen3D } from "../util/sdl/screen3d";
import { Vector } from "../util/vector";
import type { BulletMLRunner } from "../util/bulletml/bullet";
import { BulletImpl } from "./bulletimpl";
import type { BulletTarget } from "./bullettarget";
import type { BulletActorLike } from "./enemy";
import { SliceState, Tunnel } from "./tunnel";
import { Ship } from "./ship";
import type { Collidable } from "./shape";
import { Shot } from "./shot";
import { createRunnerFromParser } from "./bulletmlbridge";
import { registerBulletMLRunnerCallbacks } from "./bulletmlcallbacks";

/**
 * Actor of a bullet controlled by BulletML.
 */
export class BulletActor extends Actor implements BulletActorLike {
  private static readonly DISAP_CNT = 45;
  private static nextId = 0;
  public bullet!: BulletImpl;
  public rootRank = 1;
  private tunnel!: Tunnel;
  private ship!: Ship;
  private ppos!: Vector;
  private cnt = 0;
  private isSimple = false;
  private isTop = false;
  private isAimTop = false;
  private isVisible = true;
  private shouldBeRemoved = false;
  private isWait = false;
  private postWait = 0;
  private waitCnt = 0;
  private isMorphSeed = false;
  private disapCnt = 0;

  public override init(args: unknown[] | null): void {
    if (!args || args.length < 2) throw new Error("BulletActor.init requires args");
    this.tunnel = args[0] as Tunnel;
    this.ship = args[1] as Ship;
    this.bullet = new BulletImpl(BulletActor.nextId);
    BulletActor.nextId++;
    this.ppos = new Vector();
  }

  public set(runner: BulletMLRunner, x: number, y: number, deg: number, speed: number): void;
  public set(x: number, y: number, deg: number, speed: number): void;
  public set(a: BulletMLRunner | number, b: number, c: number, d: number, e?: number): void {
    if (typeof a === "number") {
      this.bullet.set(a, b, c, d, 0);
      this.isSimple = true;
      this.start();
      return;
    }
    this.bullet.setWithRunner(a, b, c, d, e ?? 0, 0);
    this.isSimple = false;
    this.start();
  }

  private start(): void {
    this.isTop = false;
    this.isAimTop = false;
    this.isWait = false;
    this.isVisible = true;
    this.isMorphSeed = false;
    this.ppos.x = this.bullet.pos.x;
    this.ppos.y = this.bullet.pos.y;
    this.cnt = 0;
    this.rootRank = 1;
    this.shouldBeRemoved = false;
    this.disapCnt = 0;
    this.exists = true;
  }

  public setInvisible(): void {
    this.isVisible = false;
  }

  public setTop(): void {
    this.isTop = true;
    this.isAimTop = true;
    this.setInvisible();
  }

  public unsetTop(): void {
    this.isTop = false;
    this.isAimTop = false;
  }

  public unsetAimTop(): void {
    this.isAimTop = false;
  }

  public setWait(prvw: number, pstw: number): void {
    this.isWait = true;
    this.waitCnt = prvw;
    this.postWait = pstw;
  }

  public setMorphSeed(): void {
    this.isMorphSeed = true;
  }

  public rewind(): void {
    this.bullet.remove();
    this.bullet.resetParser();
    /*
     * D source:
     *   BulletMLRunner *runner = BulletMLRunner_new_parser(bullet.getParser());
     *   BulletActorPool.registFunctions(runner);
     *   bullet.setRunner(runner);
     */
    const parser = this.bullet.getParser();
    if (parser) {
      const runner = createRunnerFromParser(parser);
      registerBulletMLRunnerCallbacks(runner);
      this.bullet.setRunner(runner);
    }
  }

  public remove(): void {
    this.shouldBeRemoved = true;
  }

  public removeForced(): void {
    if (!this.isSimple) this.bullet.remove();
    this.exists = false;
  }

  public startDisappear(): void {
    if (this.isVisible && this.disapCnt <= 0) this.disapCnt = 1;
  }

  public override move(): void {
    const target = this.bullet.target as BulletTarget | null;
    const tpos = target ? target.getTargetPos() : this.ship.getTargetPos();
    this.ppos.x = this.bullet.pos.x;
    this.ppos.y = this.bullet.pos.y;
    if (this.isAimTop) {
      let ox = tpos.x - this.bullet.pos.x;
      if (ox > Math.PI) ox -= Math.PI * 2;
      else if (ox < -Math.PI) ox += Math.PI * 2;
      this.bullet.deg =
        (Math.atan2(ox, tpos.y - this.bullet.pos.y) * this.bullet.xReverse + Math.PI / 2) *
          this.bullet.yReverse -
        Math.PI / 2;
    }
    if (this.isWait && this.waitCnt > 0) {
      this.waitCnt--;
      if (this.shouldBeRemoved) this.removeForced();
      return;
    }
    if (!this.isSimple) {
      this.bullet.move();
      if (this.bullet.isEnd()) {
        if (this.isTop) {
          this.rewind();
          if (this.isWait) {
            this.waitCnt = this.postWait;
            return;
          }
        } else if (this.isMorphSeed) {
          this.removeForced();
          return;
        }
      }
    }
    if (this.shouldBeRemoved) {
      this.removeForced();
      return;
    }
    const mx =
      (Math.sin(this.bullet.deg) * this.bullet.speed + this.bullet.acc.x) *
      this.bullet.getSpeedRank() *
      this.bullet.xReverse;
    const my =
      (Math.cos(this.bullet.deg) * this.bullet.speed - this.bullet.acc.y) *
      this.bullet.getSpeedRank() *
      this.bullet.yReverse;
    const d = Math.atan2(mx, my);
    let r = 1 - Math.abs(Math.sin(d)) * 0.999;
    r *= this.ship.speed * 5;
    this.bullet.pos.x += mx * r;
    this.bullet.pos.y += my * r;
    if (this.bullet.pos.x >= Math.PI * 2) this.bullet.pos.x -= Math.PI * 2;
    else if (this.bullet.pos.x < 0) this.bullet.pos.x += Math.PI * 2;
    if (this.isVisible && this.disapCnt <= 0) {
      if (this.ship.checkBulletHit(this.bullet.pos, this.ppos)) this.removeForced();
      if (
        this.bullet.pos.y < -2 ||
        (!this.bullet.longRange && this.bullet.pos.y > this.ship.inSightDepth) ||
        !this.tunnel.checkInScreen(this.bullet.pos, this.ship)
      ) {
        this.startDisappear();
      }
    }
    this.cnt++;
    if (this.disapCnt > 0) {
      this.disapCnt++;
      if (this.disapCnt > BulletActor.DISAP_CNT) this.removeForced();
    } else if (this.cnt > 600) {
      this.startDisappear();
    }
  }

  public checkShotHit(p: Vector, shape: Collidable, shot: Shot): void {
    if (!this.isVisible || this.disapCnt > 0) return;
    let ox = Math.abs(this.bullet.pos.x - p.x);
    const oy = Math.abs(this.bullet.pos.y - p.y);
    if (ox > Math.PI) ox = Math.PI * 2 - ox;
    ox *= this.tunnel.getRadius(this.bullet.pos.y) / SliceState.DEFAULT_RAD;
    ox *= 3;
    if (shape.checkCollision(ox, oy)) {
      this.startDisappear();
      shot.addScore(10, this.bullet.pos);
    }
  }

  public override draw(): void {
    if (!this.isVisible) return;
    const d =
      (this.bullet.deg * this.bullet.xReverse + Math.PI / 2) * this.bullet.yReverse - Math.PI / 2;
    const sp = this.tunnel.getPos(this.bullet.pos);
    glPushMatrix();
    glTranslatef(sp.x, sp.y, sp.z);
    glRotatef((d * 180) / Math.PI, 0, 1, 0);
    glRotatef(this.cnt * 6, 0, 0, 1);
    if (this.disapCnt <= 0) {
      this.bullet.shape?.draw();
    } else {
      const s = 1 - this.disapCnt / BulletActor.DISAP_CNT;
      glScalef(s, s, s);
      this.bullet.disapShape?.draw();
    }
    glPopMatrix();
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
function glScalef(x: number, y: number, z: number): void {
  Screen3D.glScalef(x, y, z);
}
