/*
 * Ported from tt/src/abagames/tt/title.d
 */

import { Vector3 } from "../util/vector";
import { DisplayList } from "../util/sdl/displaylist";
import { Texture } from "../util/sdl/texture";
import { Pad } from "../util/sdl/pad";
import { Screen } from "./screen";
import { Letter } from "./letter";
import { Screen3D } from "../util/sdl/screen3d";

interface GradeDataLike {
  hiScore: number;
  startLevel: number;
  endLevel: number;
}

interface PrefDataLike {
  selectedGrade: number;
  selectedLevel: number;
  getMaxLevel(grade: number): number;
  recordStartGame(grade: number, level: number): void;
  getGradeData(grade: number): GradeDataLike;
}

interface PrefManagerLike {
  prefData: PrefDataLike;
}

interface ShipLike {
  cameraMode: boolean;
  drawFrontMode: boolean;
  gradeNum?: number;
  gradeLetter?: string[];
  gradeStr?: string[];
}

interface GameManagerLike {
  startInGame(): void;
}

/**
 * Title screen.
 */
export class TitleManager {
  private static readonly REPLAY_CHANGE_DURATION = 30;
  private static readonly AUTO_REPEAT_START_TIME = 30;
  private static readonly AUTO_REPEAT_CNT = 5;
  private readonly prefManager: PrefManagerLike;
  private readonly pad: Pad;
  private readonly ship: ShipLike;
  private readonly gameManager: GameManagerLike;
  private displayList: DisplayList;
  private cnt = 0;
  private readonly titleTexture: Texture;
  private grade = 0;
  private level = 1;
  private dirPressed = false;
  private btnPressed = false;
  private keyRepeatCnt = 0;
  private replayCnt = 0;
  private _replayMode = false;
  private _replayChangeRatio = 0;

  public constructor(pm: PrefManagerLike, p: Pad, s: ShipLike, gm: GameManagerLike) {
    this.prefManager = pm;
    this.pad = p;
    this.ship = s;
    this.gameManager = gm;
    this.displayList = new DisplayList(3);
    this.createTorusShape();
    this.titleTexture = new Texture("title.bmp");
  }

  public close(): void {
    this.displayList.close();
  }

  public start(): void {
    this.cnt = 0;
    this.grade = this.prefManager.prefData.selectedGrade;
    this.level = this.prefManager.prefData.selectedLevel;
    this.keyRepeatCnt = 0;
    this.dirPressed = true;
    this.btnPressed = true;
    this.replayCnt = 0;
    this._replayMode = false;
  }

  public move(hasReplayData: boolean): void {
    const dir = this.pad.getDirState();
    if (!this.replayMode()) {
      if (dir & (Pad.Dir.RIGHT | Pad.Dir.LEFT)) {
        if (!this.dirPressed) {
          this.dirPressed = true;
          if (dir & Pad.Dir.RIGHT) {
            this.grade++;
            if (this.grade >= this.getGradeNum()) this.grade = 0;
          }
          if (dir & Pad.Dir.LEFT) {
            this.grade--;
            if (this.grade < 0) this.grade = this.getGradeNum() - 1;
          }
          if (this.level > this.prefManager.prefData.getMaxLevel(this.grade)) this.level = this.prefManager.prefData.getMaxLevel(this.grade);
        }
      }
      if (dir & (Pad.Dir.UP | Pad.Dir.DOWN)) {
        let mv = 0;
        if (!this.dirPressed) {
          this.dirPressed = true;
          mv = 1;
        } else {
          this.keyRepeatCnt++;
          if (this.keyRepeatCnt >= TitleManager.AUTO_REPEAT_START_TIME) {
            if (this.keyRepeatCnt % TitleManager.AUTO_REPEAT_CNT === 0) {
              mv = (this.keyRepeatCnt / TitleManager.AUTO_REPEAT_START_TIME) * (this.keyRepeatCnt / TitleManager.AUTO_REPEAT_START_TIME);
            }
          }
        }
        if (dir & Pad.Dir.DOWN) {
          this.level += mv;
          if (this.level > this.prefManager.prefData.getMaxLevel(this.grade)) {
            if (this.keyRepeatCnt >= TitleManager.AUTO_REPEAT_START_TIME) this.level = this.prefManager.prefData.getMaxLevel(this.grade);
            else this.level = 1;
            this.keyRepeatCnt = 0;
          }
        }
        if (dir & Pad.Dir.UP) {
          this.level -= mv;
          if (this.level < 1) {
            if (this.keyRepeatCnt >= TitleManager.AUTO_REPEAT_START_TIME) this.level = 1;
            else this.level = this.prefManager.prefData.getMaxLevel(this.grade);
            this.keyRepeatCnt = 0;
          }
        }
      }
    } else {
      if (dir & (Pad.Dir.RIGHT | Pad.Dir.LEFT)) {
        if (!this.dirPressed) {
          this.dirPressed = true;
          if (dir & Pad.Dir.RIGHT) this.ship.cameraMode = false;
          if (dir & Pad.Dir.LEFT) this.ship.cameraMode = true;
        }
      }
      if (dir & (Pad.Dir.UP | Pad.Dir.DOWN)) {
        if (!this.dirPressed) {
          this.dirPressed = true;
          if (dir & Pad.Dir.UP) this.ship.drawFrontMode = true;
          if (dir & Pad.Dir.DOWN) this.ship.drawFrontMode = false;
        }
      }
    }

    if (dir === 0) {
      this.dirPressed = false;
      this.keyRepeatCnt = 0;
    }

    const btn = this.pad.getButtonState();
    if (btn & Pad.Button.ANY) {
      if (!this.btnPressed) {
        this.btnPressed = true;
        if (btn & Pad.Button.A) {
          if (!this.replayMode()) {
            this.prefManager.prefData.recordStartGame(this.grade, this.level);
            this.gameManager.startInGame();
          }
        }
        if (hasReplayData) {
          if (btn & Pad.Button.B) this._replayMode = !this._replayMode;
        }
      }
    } else {
      this.btnPressed = false;
    }

    this.cnt++;
    if (this._replayMode) {
      if (this.replayCnt < TitleManager.REPLAY_CHANGE_DURATION) this.replayCnt++;
    } else {
      if (this.replayCnt > 0) this.replayCnt--;
    }
    this._replayChangeRatio = this.replayCnt / TitleManager.REPLAY_CHANGE_DURATION;
  }

  public draw(): void {
    if (this._replayChangeRatio >= 1.0) return;
    glPopMatrix();
    Screen.viewOrthoFixed();
    glDisable(Screen3D.GL_BLEND);
    Screen.setColor(0, 0, 0);
    let rcr = this._replayChangeRatio * 2;
    if (rcr > 1) rcr = 1;
    glBegin(Screen3D.GL_QUADS);
    glVertex3f(450 + (640 - 450) * rcr, 0, 0);
    glVertex3f(640, 0, 0);
    glVertex3f(640, 480, 0);
    glVertex3f(450 + (640 - 450) * rcr, 480, 0);
    glEnd();
    glEnable(Screen3D.GL_BLEND);
    Screen.viewPerspective();
    glPushMatrix();
    gluLookAt(0, 0, -1, 0, 0, 0, 0, 1, 0);
    glPushMatrix();
    glTranslatef(3 - this._replayChangeRatio * 2.4, 1.8, 3.5 - this._replayChangeRatio * 1.5);
    glRotatef(30, 1, 0, 0);
    glRotatef(Math.sin(this.cnt * 0.005) * 12, 0, 1, 0);
    glRotatef(this.cnt * 0.2, 0, 0, 1);
    glDisable(Screen3D.GL_BLEND);
    Screen.setColor(0, 0, 0);
    this.displayList.call(1);
    glEnable(Screen3D.GL_BLEND);
    Screen.setColor(1, 1, 1, 0.5);
    this.displayList.call(0);
    glPopMatrix();
  }

  public drawFront(): void {
    if (this._replayChangeRatio > 0) return;
    glPushMatrix();
    glTranslatef(508, 400, 0);
    glRotatef(-20, 0, 0, 1);
    glScalef(128, 64, 1);
    glLineWidth(2);
    this.displayList.call(2);
    glLineWidth(1);
    glPopMatrix();
    Screen.setColor(1, 1, 1);
    glEnable(Screen3D.GL_TEXTURE_2D);
    this.titleTexture.bind();
    glBegin(Screen3D.GL_TRIANGLE_FAN);
    glTexCoord2f(0, 0);
    glVertex3f(470, 380, 0);
    glTexCoord2f(1, 0);
    glVertex3f(598, 380, 0);
    glTexCoord2f(1, 1);
    glVertex3f(598, 428, 0);
    glTexCoord2f(0, 1);
    glVertex3f(470, 428, 0);
    glEnd();
    glDisable(Screen3D.GL_TEXTURE_2D);

    for (let i = 0; i < this.getGradeNum(); i++) {
      glLineWidth(2);
      const p = this.calcCursorPos(i, 1);
      this.drawCursorRing(p.x, p.y, 15);
      Letter.drawString(this.getGradeLetter(i), p.x - 4, p.y - 10, 7);
      glLineWidth(1);
      const ml = this.prefManager.prefData.getMaxLevel(i);
      if (ml > 1) {
        const ep = this.calcCursorPos(i, ml);
        this.drawCursorRing(ep.x, ep.y, 15);
        Letter.drawNum(ml, ep.x + 7, ep.y - 8, 6);
        const p2 = this.calcCursorPos(i, 2);
        glBegin(Screen3D.GL_LINES);
        glVertex3f(p.x - 29, p.y + 7, 0);
        glVertex3f(p2.x - 29, p2.y + 7, 0);
        glVertex3f(p2.x - 29, p2.y + 7, 0);
        glVertex3f(ep.x - 29, ep.y + 7, 0);
        glVertex3f(p.x + 29, p.y - 7, 0);
        glVertex3f(p2.x + 29, p2.y - 7, 0);
        glVertex3f(p2.x + 29, p2.y - 7, 0);
        glVertex3f(ep.x + 29, ep.y - 7, 0);
        glEnd();
      }
    }

    const gs = this.getGradeStr(this.grade);
    Letter.drawString(gs, 560 - gs.length * 19, 4, 9);
    Letter.drawNum(this.level, 620, 10, 6);
    Letter.drawString("LV", 570, 10, 6);
    const gd = this.prefManager.prefData.getGradeData(this.grade);
    Letter.drawNum(gd.hiScore, 620, 45, 8);
    Letter.drawNum(gd.startLevel, 408, 54, 5);
    Letter.drawNum(gd.endLevel, 453, 54, 5);
    Letter.drawString("-", 423, 54, 5);
    const cp = this.calcCursorPos(this.grade, this.level);
    this.drawCursorRing(cp.x, cp.y, 18 + Math.sin(this.cnt * 0.1) * 3);
  }

  private calcCursorPos(gd: number, lv: number): { x: number; y: number } {
    let x = 460 + gd * 70;
    let y = 90;
    if (lv > 1) {
      y += 30 + lv;
      x -= lv * 0.33;
    }
    return { x, y };
  }

  private drawCursorRing(x: number, y: number, s: number): void {
    glPushMatrix();
    glTranslatef(x, y, 0);
    glRotatef(-20, 0, 0, 1);
    glScalef(s * 2, s, 1);
    this.displayList.call(2);
    glPopMatrix();
  }

  private createTorusShape(): void {
    const cp = new Vector3();
    const ringOfs = new Vector3();
    const torusRad = 5;
    const ringRad = 0.7;
    this.displayList = new DisplayList(3);
    this.displayList.beginNewList();
    let d1 = 0;
    for (let i = 0; i < 32; i++, d1 += (Math.PI * 2) / 32) {
      let d2 = 0;
      for (let j = 0; j < 16; j++, d2 += (Math.PI * 2) / 16) {
        cp.x = Math.sin(d1) * torusRad;
        cp.y = Math.cos(d1) * torusRad;
        glBegin(Screen3D.GL_LINE_STRIP);
        this.createRingOffset(ringOfs, cp, ringRad, d1, d2);
        Screen3D.glVertex(ringOfs);
        this.createRingOffset(ringOfs, cp, ringRad, d1, d2 + (Math.PI * 2) / 16);
        Screen3D.glVertex(ringOfs);
        cp.x = Math.sin(d1 + (Math.PI * 2) / 32) * torusRad;
        cp.y = Math.cos(d1 + (Math.PI * 2) / 32) * torusRad;
        this.createRingOffset(ringOfs, cp, ringRad, d1 + (Math.PI * 2) / 32, d2 + (Math.PI * 2) / 16);
        Screen3D.glVertex(ringOfs);
        glEnd();
      }
    }

    this.displayList.nextNewList();
    d1 = 0;
    glBegin(Screen3D.GL_QUADS);
    for (let i = 0; i < 32; i++, d1 += (Math.PI * 2) / 32) {
      cp.x = Math.sin(d1) * (torusRad + ringRad);
      cp.y = Math.cos(d1) * (torusRad + ringRad);
      Screen3D.glVertex(cp);
      cp.x = Math.sin(d1) * (torusRad + ringRad * 10);
      cp.y = Math.cos(d1) * (torusRad + ringRad * 10);
      Screen3D.glVertex(cp);
      cp.x = Math.sin(d1 + (Math.PI * 2) / 32) * (torusRad + ringRad * 10);
      cp.y = Math.cos(d1 + (Math.PI * 2) / 32) * (torusRad + ringRad * 10);
      Screen3D.glVertex(cp);
      cp.x = Math.sin(d1 + (Math.PI * 2) / 32) * (torusRad + ringRad);
      cp.y = Math.cos(d1 + (Math.PI * 2) / 32) * (torusRad + ringRad);
      Screen3D.glVertex(cp);
    }
    d1 = 0;
    for (let i = 0; i < 32; i++, d1 += (Math.PI * 2) / 32) {
      let d2 = 0;
      for (let j = 0; j < 16; j++, d2 += (Math.PI * 2) / 16) {
        cp.x = Math.sin(d1) * torusRad;
        cp.y = Math.cos(d1) * torusRad;
        this.createRingOffset(ringOfs, cp, ringRad, d1, d2);
        Screen3D.glVertex(ringOfs);
        this.createRingOffset(ringOfs, cp, ringRad, d1, d2 + (Math.PI * 2) / 16);
        Screen3D.glVertex(ringOfs);
        cp.x = Math.sin(d1 + (Math.PI * 2) / 32) * torusRad;
        cp.y = Math.cos(d1 + (Math.PI * 2) / 32) * torusRad;
        this.createRingOffset(ringOfs, cp, ringRad, d1 + (Math.PI * 2) / 32, d2 + (Math.PI * 2) / 16);
        Screen3D.glVertex(ringOfs);
        this.createRingOffset(ringOfs, cp, ringRad, d1 + (Math.PI * 2) / 32, d2);
        Screen3D.glVertex(ringOfs);
      }
    }
    glEnd();

    this.displayList.nextNewList();
    d1 = 0;
    Screen.setColor(1, 1, 1);
    glBegin(Screen3D.GL_LINE_LOOP);
    for (let i = 0; i < 128; i++, d1 += (Math.PI * 2) / 128) {
      cp.x = Math.sin(d1);
      cp.y = Math.cos(d1);
      Screen3D.glVertex(cp);
    }
    glEnd();
    Screen.setColor(1, 1, 1, 0.3);
    glBegin(Screen3D.GL_TRIANGLE_FAN);
    glVertex3f(0, 0, 0);
    for (let i = 0; i <= 128; i++, d1 += (Math.PI * 2) / 128) {
      cp.x = Math.sin(d1);
      cp.y = Math.cos(d1);
      Screen3D.glVertex(cp);
    }
    glEnd();
    this.displayList.endNewList();
  }

  public createRingOffset(ringOfs: Vector3, centerPos: Vector3, rad: number, d1: number, d2: number): void {
    ringOfs.x = 0;
    ringOfs.y = rad;
    ringOfs.z = 0;
    ringOfs.rollX(d2);
    ringOfs.rollZ(-d1);
    ringOfs.opAddAssign(centerPos);
  }

  public replayMode(): boolean {
    return this._replayMode;
  }

  public replayChangeRatio(): number {
    return this._replayChangeRatio;
  }

  private getGradeNum(): number {
    return this.ship.gradeNum ?? 3;
  }

  private getGradeLetter(i: number): string {
    return this.ship.gradeLetter?.[i] ?? `${i + 1}`;
  }

  private getGradeStr(i: number): string {
    return this.ship.gradeStr?.[i] ?? `GRADE ${i + 1}`;
  }
}

function glBegin(mode: number): void {
  Screen3D.glBegin(mode);
}

function glEnd(): void {
  Screen3D.glEnd();
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

function glScalef(x: number, y: number, z: number): void {
  Screen3D.glScalef(x, y, z);
}

function glRotatef(angleDeg: number, x: number, y: number, z: number): void {
  Screen3D.glRotatef(angleDeg, x, y, z);
}

function glVertex3f(x: number, y: number, z: number): void {
  Screen3D.glVertex3f(x, y, z);
}

function glEnable(cap: number): void {
  Screen3D.glEnable(cap);
}

function glDisable(cap: number): void {
  Screen3D.glDisable(cap);
}

function glLineWidth(width: number): void {
  Screen3D.glLineWidth(width);
}

function glTexCoord2f(u: number, v: number): void {
  Screen3D.glTexCoord2f(u, v);
}

function gluLookAt(eyeX: number, eyeY: number, eyeZ: number, centerX: number, centerY: number, centerZ: number, upX: number, upY: number, upZ: number): void {
  Screen3D.gluLookAt(eyeX, eyeY, eyeZ, centerX, centerY, centerZ, upX, upY, upZ);
}
