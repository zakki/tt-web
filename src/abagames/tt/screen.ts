/*
 * Ported from tt/src/abagames/tt/screen.d
 */

import { LuminousScreen } from "../util/sdl/luminous";
import { Screen3D } from "../util/sdl/screen3d";

/**
 * Initialize an OpenGL and set the caption.
 * Handle the luminous screen.
 */
export class Screen extends Screen3D {
  public static readonly CAPTION = "Torus Trooper";
  public static luminous = 0;
  private luminousScreen: LuminousScreen | null = null;

  protected override init(): void {
    this.setCaption(Screen.CAPTION);
    Screen3D.glLineWidth(1);
    Screen3D.glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
    Screen3D.glEnable(Screen3D.GL_LINE_SMOOTH);
    Screen3D.glEnable(Screen3D.GL_BLEND);
    Screen3D.glDisable(Screen3D.GL_COLOR_MATERIAL);
    Screen3D.glDisable(Screen3D.GL_CULL_FACE);
    Screen3D.glDisable(Screen3D.GL_DEPTH_TEST);
    Screen3D.glDisable(Screen3D.GL_LIGHTING);
    Screen3D.glDisable(Screen3D.GL_TEXTURE_2D);
    Screen3D.setClearColor(0, 0, 0, 1);
    if (Screen.luminous > 0) {
      this.luminousScreen = new LuminousScreen();
      this.luminousScreen.init(Screen.luminous, Screen3D.width, Screen3D.height);
    } else {
      this.luminousScreen = null;
    }
    Screen3D.farPlane = 10000;
    this.screenResized();
  }

  public override close(): void {
    this.luminousScreen?.close();
    this.luminousScreen = null;
  }

  public startRenderToLuminousScreen(): boolean {
    if (!this.luminousScreen) return false;
    this.luminousScreen.startRender();
    return true;
  }

  public endRenderToLuminousScreen(): void {
    this.luminousScreen?.endRender();
  }

  public drawLuminous(): void {
    this.luminousScreen?.draw();
  }

  public override resized(width: number, height: number): void {
    this.luminousScreen?.resized(width, height);
    super.resized(width, height);
  }

  public override clear(): void {
    Screen3D.glClear(Screen3D.GL_COLOR_BUFFER_BIT);
  }

  public static viewOrthoFixed(): void {
    Screen3D.glMatrixMode(Screen3D.GL_PROJECTION);
    Screen3D.glPushMatrix();
    Screen3D.glLoadIdentity();
    Screen3D.glOrtho(0, 640, 480, 0, -1, 1);
    Screen3D.glMatrixMode(Screen3D.GL_MODELVIEW);
    Screen3D.glPushMatrix();
    Screen3D.glLoadIdentity();
  }

  public static viewPerspective(): void {
    Screen3D.glMatrixMode(Screen3D.GL_PROJECTION);
    Screen3D.glPopMatrix();
    Screen3D.glMatrixMode(Screen3D.GL_MODELVIEW);
    Screen3D.glPopMatrix();
  }
}
