/*
 * Ported from tt/src/abagames/tt/camera.d
 */

import { Vector3 } from "../util/vector";
import { Rand } from "../util/rand";
import type { Ship } from "./ship";

/**
 * Handle a camera.
 */
export class Camera {
  private static readonly ZOOM_CNT = 24;
  private static readonly MoveType = { FLOAT: 0, FIX: 1 } as const;
  private readonly ship: Ship;
  private readonly rand: Rand;
  private readonly _cameraPos: Vector3;
  private readonly cameraTrg: Vector3;
  private readonly cameraVel: Vector3;
  private readonly _lookAtPos: Vector3;
  private readonly lookAtOfs: Vector3;
  private lookAtCnt = 0;
  private changeCnt = 0;
  private moveCnt = 0;
  private _deg = 0;
  private _zoom = 1;
  private zoomTrg = 1;
  private zoomMin = 0.5;
  private type: number = Camera.MoveType.FLOAT;

  public constructor(ship: Ship) {
    this.ship = ship;
    this._cameraPos = new Vector3();
    this.cameraTrg = new Vector3();
    this.cameraVel = new Vector3();
    this._lookAtPos = new Vector3();
    this.lookAtOfs = new Vector3();
    this._zoom = 1;
    this.zoomTrg = 1;
    this.zoomMin = 0.5;
    this.rand = new Rand();
    this.type = Camera.MoveType.FLOAT;
  }

  public start(): void {
    this.changeCnt = 0;
    this.moveCnt = 0;
  }

  public move(): void {
    this.changeCnt--;
    if (this.changeCnt < 0) {
      this.type = this.rand.nextInt(2);
      switch (this.type) {
        case Camera.MoveType.FLOAT:
          this.changeCnt = 256 + this.rand.nextInt(150);
          this.cameraTrg.x = this.ship.relPos.x + this.rand.nextSignedFloat(1);
          this.cameraTrg.y = this.ship.relPos.y - 12 + this.rand.nextSignedFloat(48);
          this.cameraTrg.z = this.rand.nextInt(32);
          this.cameraVel.x =
            ((this.ship.relPos.x - this.cameraTrg.x) / this.changeCnt) * (1 + this.rand.nextFloat(1));
          this.cameraVel.y =
            ((this.ship.relPos.y - 12 - this.cameraTrg.y) / this.changeCnt) *
            (1.5 + this.rand.nextFloat(0.8));
          this.cameraVel.z = ((16 - this.cameraTrg.z) / this.changeCnt) * this.rand.nextFloat(1);
          this._zoom = this.zoomTrg = 1.2 + this.rand.nextFloat(0.8);
          break;
        case Camera.MoveType.FIX:
          this.changeCnt = 200 + this.rand.nextInt(100);
          this.cameraTrg.x = this.rand.nextSignedFloat(0.3);
          this.cameraTrg.y = -8 - this.rand.nextFloat(12);
          this.cameraTrg.z = 8 + this.rand.nextInt(16);
          this.cameraVel.x =
            ((this.ship.relPos.x - this.cameraTrg.x) / this.changeCnt) * (1 + this.rand.nextFloat(1));
          this.cameraVel.y = this.rand.nextSignedFloat(0.05);
          this.cameraVel.z = ((10 - this.cameraTrg.z) / this.changeCnt) * this.rand.nextFloat(0.5);
          this.zoomTrg = 1.0 + this.rand.nextSignedFloat(0.25);
          this._zoom = 0.2 + this.rand.nextFloat(0.8);
          break;
      }
      this._cameraPos.x = this.cameraTrg.x;
      this._cameraPos.y = this.cameraTrg.y;
      this._cameraPos.z = this.cameraTrg.z;
      this._deg = this.cameraTrg.x;
      this.lookAtOfs.x = 0;
      this.lookAtOfs.y = 0;
      this.lookAtOfs.z = 0;
      this.lookAtCnt = 0;
      this.zoomMin = 1.0 - this.rand.nextFloat(0.9);
    }
    this.lookAtCnt--;
    if (this.lookAtCnt === Camera.ZOOM_CNT) {
      this.lookAtOfs.x = this.rand.nextSignedFloat(0.4);
      this.lookAtOfs.y = this.rand.nextSignedFloat(3);
      this.lookAtOfs.z = this.rand.nextSignedFloat(10);
    } else if (this.lookAtCnt < 0) {
      this.lookAtCnt = 32 + this.rand.nextInt(48);
    }
    this.cameraTrg.opAddAssign(this.cameraVel);
    let cox = 0;
    let coy = 0;
    let coz = 0;
    switch (this.type) {
      case Camera.MoveType.FLOAT:
        cox = this.cameraTrg.x;
        coy = this.cameraTrg.y;
        coz = this.cameraTrg.z;
        break;
      case Camera.MoveType.FIX:
        cox = this.cameraTrg.x + this.ship.relPos.x;
        coy = this.cameraTrg.y + this.ship.relPos.y;
        coz = this.cameraTrg.z;
        let od = this.ship.relPos.x - this._deg;
        while (od >= Math.PI) od -= Math.PI * 2;
        while (od < -Math.PI) od += Math.PI * 2;
        this._deg += od * 0.2;
        break;
    }
    cox -= this._cameraPos.x;
    while (cox >= Math.PI) cox -= Math.PI * 2;
    while (cox < -Math.PI) cox += Math.PI * 2;
    coy -= this._cameraPos.y;
    coz -= this._cameraPos.z;
    this._cameraPos.x += cox * 0.12;
    this._cameraPos.y += coy * 0.12;
    this._cameraPos.z += coz * 0.12;
    let ofsRatio = 1.0;
    if (this.lookAtCnt <= Camera.ZOOM_CNT) ofsRatio = 1.0 + Math.abs(this.zoomTrg - this._zoom) * 2.5;
    let lox = this.ship.relPos.x + this.lookAtOfs.x * ofsRatio - this._lookAtPos.x;
    while (lox >= Math.PI) lox -= Math.PI * 2;
    while (lox < -Math.PI) lox += Math.PI * 2;
    const loy = this.ship.relPos.y + this.lookAtOfs.y * ofsRatio - this._lookAtPos.y;
    const loz = this.lookAtOfs.z * ofsRatio - this._lookAtPos.z;
    if (this.lookAtCnt <= Camera.ZOOM_CNT) {
      this._zoom += (this.zoomTrg - this._zoom) * 0.16;
      this._lookAtPos.x += lox * 0.2;
      this._lookAtPos.y += loy * 0.2;
      this._lookAtPos.z += loz * 0.2;
    } else {
      this._lookAtPos.x += lox * 0.1;
      this._lookAtPos.y += loy * 0.1;
      this._lookAtPos.z += loz * 0.1;
    }
    this.lookAtOfs.opMulAssign(0.985);
    if (Math.abs(this.lookAtOfs.x) < 0.04) this.lookAtOfs.x = 0;
    if (Math.abs(this.lookAtOfs.y) < 0.3) this.lookAtOfs.y = 0;
    if (Math.abs(this.lookAtOfs.z) < 1) this.lookAtOfs.z = 0;
    this.moveCnt--;
    if (this.moveCnt < 0) {
      this.moveCnt = 15 + this.rand.nextInt(15);
      let loxd = Math.abs(this._lookAtPos.x - this._cameraPos.x);
      if (loxd > Math.PI) loxd = Math.PI * 2 - loxd;
      const ofs = loxd * 3 + Math.abs(this._lookAtPos.y - this._cameraPos.y);
      this.zoomTrg = 3.0 / ofs;
      if (this.zoomTrg < this.zoomMin) this.zoomTrg = this.zoomMin;
      else if (this.zoomTrg > 2) this.zoomTrg = 2;
    }
    if (this._lookAtPos.x < 0) this._lookAtPos.x += Math.PI * 2;
    else if (this._lookAtPos.x >= Math.PI * 2) this._lookAtPos.x -= Math.PI * 2;
  }

  public get cameraPos(): Vector3 {
    return this._cameraPos;
  }
  public get lookAtPos(): Vector3 {
    return this._lookAtPos;
  }
  public get deg(): number {
    return this._deg;
  }
  public get zoom(): number {
    return this._zoom;
  }
}
