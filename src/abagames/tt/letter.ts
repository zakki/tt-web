/*
 * Ported from tt/src/abagames/tt/letter.d
 */

import { DisplayList } from "../util/sdl/displaylist";
import { Screen3D } from "../util/sdl/screen3d";
import { Screen } from "./screen";

/**
 * Letters.
 */
export class Letter {
  public static displayList: DisplayList;
  public static readonly LETTER_WIDTH = 2.1;
  public static readonly LETTER_HEIGHT = 3.0;
  public static readonly COLOR_NUM = 4;
  private static readonly COLOR_RGB: number[][] = [
    [1, 1, 1],
    [0.9, 0.7, 0.5],
  ];
  private static readonly LETTER_NUM = 44;
  private static readonly DISPLAY_LIST_NUM = Letter.LETTER_NUM * Letter.COLOR_NUM;

  public static init(): void {
    Letter.displayList = new DisplayList(Letter.DISPLAY_LIST_NUM);
    Letter.displayList.resetList();
    for (let j = 0; j < Letter.COLOR_NUM; j++) {
      for (let i = 0; i < Letter.LETTER_NUM; i++) {
        Letter.displayList.newList();
        Letter.drawGlyph(i, j);
        Letter.displayList.endList();
      }
    }
  }

  public static close(): void {
    Letter.displayList.close();
  }

  public static getWidth(n: number, s: number): number {
    return n * s * Letter.LETTER_WIDTH;
  }

  public static getHeight(s: number): number {
    return s * Letter.LETTER_HEIGHT;
  }

  private static drawLetter(n: number, x: number, y: number, s: number, d: number, c: number): void {
    glPushMatrix();
    glTranslatef(x, y, 0);
    glScalef(s, s, s);
    glRotatef(d, 0, 0, 1);
    Letter.displayList.call(n + c * Letter.LETTER_NUM);
    glPopMatrix();
  }

  private static drawLetterRev(n: number, x: number, y: number, s: number, d: number, c: number): void {
    glPushMatrix();
    glTranslatef(x, y, 0);
    glScalef(s, -s, s);
    glRotatef(d, 0, 0, 1);
    Letter.displayList.call(n + c * Letter.LETTER_NUM);
    glPopMatrix();
  }

  public static readonly Direction = {
    TO_RIGHT: 0,
    TO_DOWN: 1,
    TO_LEFT: 2,
    TO_UP: 3,
  } as const;

  public static convertCharToInt(c: string): number {
    const cc = c.charCodeAt(0);
    if (cc >= 48 && cc <= 57) return cc - 48;
    if (cc >= 65 && cc <= 90) return cc - 65 + 10;
    if (cc >= 97 && cc <= 122) return cc - 97 + 10;
    if (c === ".") return 36;
    if (c === "-") return 38;
    if (c === "+") return 39;
    if (c === "_") return 37;
    if (c === "!") return 42;
    if (c === "/") return 43;
    return 0;
  }

  public static drawString(str: string, lx: number, y: number, s: number, d: number = Letter.Direction.TO_RIGHT, cl = 0, rev = false, od = 0): void {
    lx += (Letter.LETTER_WIDTH * s) / 2;
    y += (Letter.LETTER_HEIGHT * s) / 2;
    let x = lx;
    let ld = 0;
    switch (d) {
      case Letter.Direction.TO_RIGHT:
        ld = 0;
        break;
      case Letter.Direction.TO_DOWN:
        ld = 90;
        break;
      case Letter.Direction.TO_LEFT:
        ld = 180;
        break;
      case Letter.Direction.TO_UP:
        ld = 270;
        break;
    }
    ld += od;
    for (const c of str) {
      if (c !== " ") {
        const idx = Letter.convertCharToInt(c);
        if (rev) Letter.drawLetterRev(idx, x, y, s, ld, cl);
        else Letter.drawLetter(idx, x, y, s, ld, cl);
      }
      if (od === 0) {
        switch (d) {
          case Letter.Direction.TO_RIGHT:
            x += s * Letter.LETTER_WIDTH;
            break;
          case Letter.Direction.TO_DOWN:
            y += s * Letter.LETTER_WIDTH;
            break;
          case Letter.Direction.TO_LEFT:
            x -= s * Letter.LETTER_WIDTH;
            break;
          case Letter.Direction.TO_UP:
            y -= s * Letter.LETTER_WIDTH;
            break;
        }
      } else {
        x += Math.cos((ld * Math.PI) / 180) * s * Letter.LETTER_WIDTH;
        y += Math.sin((ld * Math.PI) / 180) * s * Letter.LETTER_WIDTH;
      }
    }
  }

  public static drawNum(num: number, lx: number, y: number, s: number, d: number = Letter.Direction.TO_RIGHT, cl = 0, dg = 0): void {
    lx += (Letter.LETTER_WIDTH * s) / 2;
    y += (Letter.LETTER_HEIGHT * s) / 2;
    let n = num;
    let x = lx;
    let ld = 0;
    switch (d) {
      case Letter.Direction.TO_RIGHT:
        ld = 0;
        break;
      case Letter.Direction.TO_DOWN:
        ld = 90;
        break;
      case Letter.Direction.TO_LEFT:
        ld = 180;
        break;
      case Letter.Direction.TO_UP:
        ld = 270;
        break;
    }
    let digit = dg;
    for (;;) {
      Letter.drawLetter(n % 10, x, y, s, ld, cl);
      switch (d) {
        case Letter.Direction.TO_RIGHT:
          x -= s * Letter.LETTER_WIDTH;
          break;
        case Letter.Direction.TO_DOWN:
          y -= s * Letter.LETTER_WIDTH;
          break;
        case Letter.Direction.TO_LEFT:
          x += s * Letter.LETTER_WIDTH;
          break;
        case Letter.Direction.TO_UP:
          y += s * Letter.LETTER_WIDTH;
          break;
      }
      n = Math.floor(n / 10);
      digit--;
      if (n <= 0 && digit <= 0) break;
    }
  }

  public static drawNumSign(num: number, lx: number, ly: number, s: number, cl: number): void {
    let dg: number;
    if (num < 100) dg = 2;
    else if (num < 1000) dg = 3;
    else if (num < 10000) dg = 4;
    else dg = 5;
    let x = lx + ((Letter.LETTER_WIDTH * s * dg) / 2);
    const y = ly + ((Letter.LETTER_HEIGHT * s) / 2);
    let n = num;
    for (;;) {
      Letter.drawLetterRev(n % 10, x, y, s, 0, cl);
      x -= s * Letter.LETTER_WIDTH;
      n = Math.floor(n / 10);
      if (n <= 0) break;
    }
  }

  public static drawTime(time: number, lx: number, y: number, s: number, cl = 0): void {
    let n = time;
    if (n < 0) n = 0;
    let x = lx;
    for (let i = 0; i < 7; i++) {
      if (i !== 4) {
        Letter.drawLetter(n % 10, x, y, s, Letter.Direction.TO_RIGHT, cl);
        n = Math.floor(n / 10);
      } else {
        Letter.drawLetter(n % 6, x, y, s, Letter.Direction.TO_RIGHT, cl);
        n = Math.floor(n / 6);
      }
      if ((i & 1) === 1 || i === 0) {
        switch (i) {
          case 3:
            Letter.drawLetter(41, x + s * 1.16, y, s, Letter.Direction.TO_RIGHT, cl);
            break;
          case 5:
            Letter.drawLetter(40, x + s * 1.16, y, s, Letter.Direction.TO_RIGHT, cl);
            break;
          default:
            break;
        }
        x -= s * Letter.LETTER_WIDTH;
      } else {
        x -= s * Letter.LETTER_WIDTH * 1.3;
      }
      if (n <= 0) break;
    }
  }

  private static drawGlyph(idx: number, c: number): void {
    const glyph = Letter.spData[idx];
    if (!glyph) return;
    for (let i = 0; i < glyph.length; i++) {
      let deg = glyph[i][4] | 0;
      if (deg > 99990) break;
      let x = -glyph[i][0];
      let y = -glyph[i][1];
      let size = glyph[i][2];
      let length = glyph[i][3];
      y *= 0.9;
      size *= 1.4;
      length *= 1.05;
      x = -x;
      deg %= 180;
      if (c === 2) Letter.drawBoxLine(x, y, size, length, deg);
      else if (c === 3) Letter.drawBoxPoly(x, y, size, length, deg);
      else Letter.drawBox(x, y, size, length, deg, Letter.COLOR_RGB[c][0], Letter.COLOR_RGB[c][1], Letter.COLOR_RGB[c][2]);
    }
  }

  private static drawBox(x: number, y: number, width: number, height: number, deg: number, r: number, g: number, b: number): void {
    glPushMatrix();
    glTranslatef(x - width / 2, y - height / 2, 0);
    glRotatef(deg, 0, 0, 1);
    Screen.setColor(r, g, b, 0.5);
    glBegin(Screen3D.GL_TRIANGLE_FAN);
    Letter.drawBoxPart(width, height);
    glEnd();
    Screen.setColor(r, g, b);
    glBegin(Screen3D.GL_LINE_LOOP);
    Letter.drawBoxPart(width, height);
    glEnd();
    glPopMatrix();
  }

  private static drawBoxLine(x: number, y: number, width: number, height: number, deg: number): void {
    glPushMatrix();
    glTranslatef(x - width / 2, y - height / 2, 0);
    glRotatef(deg, 0, 0, 1);
    glBegin(Screen3D.GL_LINE_LOOP);
    Letter.drawBoxPart(width, height);
    glEnd();
    glPopMatrix();
  }

  private static drawBoxPoly(x: number, y: number, width: number, height: number, deg: number): void {
    glPushMatrix();
    glTranslatef(x - width / 2, y - height / 2, 0);
    glRotatef(deg, 0, 0, 1);
    glBegin(Screen3D.GL_TRIANGLE_FAN);
    Letter.drawBoxPart(width, height);
    glEnd();
    glPopMatrix();
  }

  private static drawBoxPart(width: number, height: number): void {
    glVertex3f(-width / 2, 0, 0);
    glVertex3f((-width / 3) * 1, -height / 2, 0);
    glVertex3f((width / 3) * 1, -height / 2, 0);
    glVertex3f(width / 2, 0, 0);
    glVertex3f((width / 3) * 1, height / 2, 0);
    glVertex3f((-width / 3) * 1, height / 2, 0);
  }

  private static readonly spData: number[][][] = [
    [[0, 1.15, 0.65, 0.3, 0], [-0.6, 0.55, 0.65, 0.3, 90], [0.6, 0.55, 0.65, 0.3, 90], [-0.6, -0.55, 0.65, 0.3, 90], [0.6, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0.5, 0.55, 0.65, 0.3, 90], [0.5, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [0.65, 0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[-0.18, 1.15, 0.45, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.45, 0.55, 0.65, 0.3, 90], [-0.18, 0, 0.45, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.15, 1.15, 0.45, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.45, 0.45, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.05, 0, 0.3, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 0.55, 0.65, 0.3, 90], [0, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0.65, 0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [-0.7, -0.7, 0.3, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.4, 0.55, 0.65, 0.3, 100], [-0.25, 0, 0.45, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.6, -0.55, 0.65, 0.3, 80], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.5, 1.15, 0.3, 0.3, 0], [0.1, 1.15, 0.3, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, 0.55, 0.65, 0.3, 90], [0, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0.05, -0.55, 0.45, 0.3, 60], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.2, 0, 0.45, 0.3, 0], [-0.65, -0.55, 0.65, 0.3, 90], [0.45, -0.55, 0.65, 0.3, 80], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [-0.65, 0.55, 0.65, 0.3, 90], [0, 0, 0.65, 0.3, 0], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.5, 1.15, 0.55, 0.3, 0], [0.5, 1.15, 0.55, 0.3, 0], [0.1, 0.55, 0.65, 0.3, 90], [0.1, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.5, -0.55, 0.65, 0.3, 90], [0.5, -0.55, 0.65, 0.3, 90], [-0.1, -1.15, 0.45, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.65, 0.55, 0.65, 0.3, 90], [0.65, 0.55, 0.65, 0.3, 90], [-0.65, -0.55, 0.65, 0.3, 90], [0.65, -0.55, 0.65, 0.3, 90], [-0.5, -1.15, 0.3, 0.3, 0], [0.1, -1.15, 0.3, 0.3, 0], [0, 0.55, 0.65, 0.3, 90], [0, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[-0.4, 0.6, 0.85, 0.3, 240], [0.4, 0.6, 0.85, 0.3, 300], [-0.4, -0.6, 0.85, 0.3, 120], [0.4, -0.6, 0.85, 0.3, 60], [0, 0, 0, 0, 99999]],
    [[-0.4, 0.6, 0.85, 0.3, 240], [0.4, 0.6, 0.85, 0.3, 300], [-0.1, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.15, 0.65, 0.3, 0], [0.3, 0.4, 0.65, 0.3, 120], [-0.3, -0.4, 0.65, 0.3, 120], [0, -1.15, 0.65, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, -1.15, 0.3, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, -1.15, 0.8, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[0, 0, 0.9, 0.3, 0], [0, 0, 0, 0, 99999]],
    [[-0.5, 0, 0.45, 0.3, 0], [0.45, 0, 0.45, 0.3, 0], [0.1, 0.55, 0.65, 0.3, 90], [0.1, -0.55, 0.65, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0, 1.0, 0.4, 0.2, 90], [0, 0, 0, 0, 99999]],
    [[-0.19, 1.0, 0.4, 0.2, 90], [0.2, 1.0, 0.4, 0.2, 90], [0, 0, 0, 0, 99999]],
    [[0.56, 0.25, 1.1, 0.3, 90], [0, -1.0, 0.3, 0.3, 90], [0, 0, 0, 0, 99999]],
    [[0.8, 0, 1.75, 0.3, 120], [0, 0, 0, 0, 99999]],
  ];
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
