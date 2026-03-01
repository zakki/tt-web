/*
 * Ported from tt/src/abagames/tt/gamemanager.d
 */

import { Bullet } from "../util/bulletml/bullet";
import { Rand } from "../util/rand";
import { Pad } from "../util/sdl/pad";
import { RecordablePad } from "../util/sdl/recordablepad";
import type { MainLoop } from "../util/sdl/mainloop";
import { GameManager as BaseGameManager } from "../util/sdl/gamemanager";
import { Screen3D } from "../util/sdl/screen3d";
import { getTouchLayout, toGLViewport } from "../util/sdl/touchlayout";
import { Barrage, BarrageManager } from "./barrage";
import { BulletActorPool } from "./bulletactorpool";
import { Enemy, EnemyPool } from "./enemy";
import { FloatLetter, FloatLetterPool } from "./floatletter";
import { Letter } from "./letter";
import { Particle, ParticlePool } from "./particle";
import { PrefManager } from "./prefmanager";
import { ReplayData } from "./replay";
import { Screen } from "./screen";
import { Ship } from "./ship";
import { Shot, ShotPool } from "./shot";
import { SoundManager } from "./soundmanager";
import { StageManager } from "./stagemanager";
import { TitleManager } from "./title";
import { Tunnel } from "./tunnel";

const SDLK_ESCAPE = 27;
const SDLK_p = 80;
const SDL_PRESSED = 1;

/**
 * Manage the game state and actor pools.
 */
export class GameManager extends BaseGameManager {
  private pad!: Pad;
  private prefManager!: PrefManager;
  private screen!: Screen;
  private tunnel!: Tunnel;
  private ship!: Ship;
  private shots!: ShotPool;
  private bullets!: BulletActorPool;
  private enemies!: EnemyPool;
  private particles!: ParticlePool;
  private floatLetters!: FloatLetterPool;
  private stageManager!: StageManager;
  private titleManager!: TitleManager;
  private passedEnemies!: EnemyPool;
  private rand!: Rand;
  private interval = 16;
  private state!: GameState;
  private titleState!: TitleState;
  private inGameState!: InGameState;
  private escPressed = false;
  private mainLoopRef!: MainLoop;

  public override init(): void {
    BarrageManager.load();
    Letter.init();
    Shot.init();
    this.pad = this.input as Pad;
    this.prefManager = this.abstPrefManager as PrefManager;
    this.screen = this.abstScreen as Screen;
    this.mainLoopRef = this.mainLoop as MainLoop;
    this.interval = this.mainLoopRef.INTERVAL_BASE;
    this.tunnel = new Tunnel();
    this.ship = new Ship(this.pad, this.tunnel);
    this.floatLetters = new FloatLetterPool(16, [this.tunnel]);
    this.bullets = new BulletActorPool(512, [this.tunnel, this.ship]);
    this.particles = new ParticlePool(1024, [this.tunnel, this.ship]);
    this.enemies = new EnemyPool(64, [this.tunnel, this.bullets, this.ship, this.particles]);
    this.passedEnemies = new EnemyPool(64, [this.tunnel, this.bullets, this.ship, this.particles]);
    this.enemies.setPassedEnemies(this.passedEnemies);
    this.shots = new ShotPool(64, [this.tunnel, this.enemies, this.bullets, this.floatLetters, this.particles, this.ship]);
    this.ship.setParticles(this.particles);
    this.ship.setShots(this.shots);
    this.stageManager = new StageManager(this.tunnel, this.enemies, this.ship);
    SoundManager.loadSounds();
    this.titleManager = new TitleManager(this.prefManager, this.pad, this.ship, this);
    this.rand = new Rand();
    this.inGameState = new InGameState(
      this.tunnel,
      this.ship,
      this.shots,
      this.bullets,
      this.enemies,
      this.particles,
      this.floatLetters,
      this.stageManager,
      this.pad,
      this.prefManager,
      this,
    );
    this.titleState = new TitleState(
      this.tunnel,
      this.ship,
      this.shots,
      this.bullets,
      this.enemies,
      this.particles,
      this.floatLetters,
      this.stageManager,
      this.pad,
      this.titleManager,
      this.passedEnemies,
      this.inGameState,
    );
    this.inGameState.seed(this.rand.nextInt32());
    this.ship.setGameState(this.inGameState);
  }

  public override start(): void {
    this.loadLastReplay();
    this.startTitle();
  }

  public startTitle(fromGameover = false): void {
    if (fromGameover) this.saveLastReplay();
    this.titleState.setReplayData(this.inGameState.replayData());
    this.state = this.titleState;
    this.startState();
  }

  public startInGame(): void {
    this.state = this.inGameState;
    this.startState();
  }

  private startState(): void {
    this.state.grade(this.prefManager.prefData.selectedGrade);
    this.state.level(this.prefManager.prefData.selectedLevel);
    this.state.seed(this.rand.nextInt32());
    this.state.start();
  }

  public override close(): void {
    this.stageManager.close();
    this.titleState.close();
    this.ship.close();
    Shot.close();
    Letter.close();
    BarrageManager.unload();
  }

  public saveErrorReplay(): void {
    if (this.state === this.inGameState) this.inGameState.saveReplay("error.rpl");
  }

  private saveLastReplay(): void {
    try {
      this.inGameState.saveReplay("last.rpl");
    } catch {
      // no-op
    }
  }

  private loadLastReplay(): void {
    try {
      this.inGameState.loadReplay("last.rpl");
    } catch {
      this.inGameState.resetReplay();
    }
  }

  public override move(): void {
    if (this.pad.keys[SDLK_ESCAPE] === SDL_PRESSED) {
      if (!this.escPressed) {
        this.escPressed = true;
        if (this.state === this.inGameState) this.startTitle();
        else this.mainLoopRef.breakLoop();
        return;
      }
    } else {
      this.escPressed = false;
    }
    this.state.move();
  }

  public override draw(): void {
    const gameViewport = getTouchLayout(Screen.width, Screen.height).gameViewport;
    const glGameViewport = toGLViewport(gameViewport, Screen.height);
    if (this.screen.startRenderToLuminousScreen()) {
      glViewport(glGameViewport.x, glGameViewport.y, glGameViewport.width, glGameViewport.height);
      setPerspectiveForSize(gameViewport.width, gameViewport.height);
      glPushMatrix();
      this.ship.setEyepos();
      this.state.drawLuminous();
      glPopMatrix();
      this.screen.endRenderToLuminousScreen();
    }
    this.screen.clear();
    glViewport(glGameViewport.x, glGameViewport.y, glGameViewport.width, glGameViewport.height);
    setPerspectiveForSize(gameViewport.width, gameViewport.height);
    glPushMatrix();
    this.ship.setEyepos();
    this.state.draw();
    glPopMatrix();
    glViewport(0, 0, Screen.width, Screen.height);
    setPerspectiveForSize(Screen.width, Screen.height);
    this.screen.drawLuminous();
    glViewport(glGameViewport.x, glGameViewport.y, glGameViewport.width, glGameViewport.height);
    Screen.viewOrthoFixed();
    this.state.drawFront();
    Screen.viewPerspective();
    glViewport(0, 0, Screen.width, Screen.height);
    setPerspectiveForSize(Screen.width, Screen.height);
  }
}

/**
 * Manage game states.
 */
abstract class GameState {
  protected readonly tunnel: Tunnel;
  protected readonly ship: Ship;
  protected readonly shots: ShotPool;
  protected readonly bullets: BulletActorPool;
  protected readonly enemies: EnemyPool;
  protected readonly particles: ParticlePool;
  protected readonly floatLetters: FloatLetterPool;
  protected readonly stageManager: StageManager;
  protected _level = 1;
  protected _grade = 0;
  protected _seed = 0;

  public constructor(
    tunnel: Tunnel,
    ship: Ship,
    shots: ShotPool,
    bullets: BulletActorPool,
    enemies: EnemyPool,
    particles: ParticlePool,
    floatLetters: FloatLetterPool,
    stageManager: StageManager,
  ) {
    this.tunnel = tunnel;
    this.ship = ship;
    this.shots = shots;
    this.bullets = bullets;
    this.enemies = enemies;
    this.particles = particles;
    this.floatLetters = floatLetters;
    this.stageManager = stageManager;
  }

  public abstract start(): void;
  public abstract move(): void;
  public abstract draw(): void;
  public abstract drawLuminous(): void;
  public abstract drawFront(): void;

  public level(v: number): number {
    this._level = v;
    return this._level;
  }
  public grade(v: number): number {
    this._grade = v;
    return this._grade;
  }
  public seed(v: number): number {
    this._seed = v;
    return this._seed;
  }
}

class InGameState extends GameState {
  private static readonly DEFAULT_EXTEND_SCORE = 100000;
  private static readonly MAX_EXTEND_SCORE = 500000;
  private static readonly DEFAULT_TIME = 120000;
  private static readonly MAX_TIME = 120000;
  private static readonly SHIP_DESTROYED_PENALTY_TIME = -15000;
  private static readonly SHIP_DESTROYED_PENALTY_TIME_MSG = "-15 SEC.";
  private static readonly EXTEND_TIME = 15000;
  private static readonly EXTEND_TIME_MSG = "+15 SEC.";
  private static readonly NEXT_ZONE_ADDITION_TIME = 30000;
  private static readonly NEXT_ZONE_ADDITION_TIME_MSG = "+30 SEC.";
  private static readonly NEXT_LEVEL_ADDITION_TIME = 45000;
  private static readonly NEXT_LEVEL_ADDITION_TIME_MSG = "+45 SEC.";
  private static readonly BEEP_START_TIME = 15000;
  private readonly pad: Pad;
  private readonly prefManager: PrefManager;
  private readonly gameManager: GameManager;
  private score = 0;
  private nextExtend = 0;
  private time = 0;
  private nextBeepTime = 0;
  private startBgmCnt = 0;
  private timeChangedMsg = "";
  private timeChangedShowCnt = -1;
  private gameOverCnt = 0;
  private btnPressed = false;
  private pauseCnt = 0;
  private pausePressed = false;
  private _replayData: ReplayData | null = null;

  public constructor(
    tunnel: Tunnel,
    ship: Ship,
    shots: ShotPool,
    bullets: BulletActorPool,
    enemies: EnemyPool,
    particles: ParticlePool,
    floatLetters: FloatLetterPool,
    stageManager: StageManager,
    pad: Pad,
    prefManager: PrefManager,
    gameManager: GameManager,
  ) {
    super(tunnel, ship, shots, bullets, enemies, particles, floatLetters, stageManager);
    this.pad = pad;
    this.prefManager = prefManager;
    this.gameManager = gameManager;
  }

  public override start(): void {
    this.ship.replayMode = false;
    this.shots.clear();
    this.bullets.clear();
    this.enemies.clear();
    this.particles.clear();
    this.floatLetters.clear();
    const rp = this.pad as RecordablePad;
    rp.startRecord();
    this._replayData = new ReplayData();
    this._replayData.padRecord = rp.padRecord;
    this._replayData.level = this._level;
    this._replayData.grade = this._grade;
    this._replayData.seed = this._seed;
    Barrage.setRandSeed(this._seed);
    Bullet.setRandSeed(this._seed);
    Enemy.setRandSeed(this._seed);
    FloatLetter.setRandSeed(this._seed);
    Particle.setRandSeed(this._seed);
    Shot.setRandSeed(this._seed);
    SoundManager.setRandSeed(this._seed);
    this.ship.start(this._grade, this._seed);
    this.stageManager.start(this._level, this._grade, this._seed);
    this.initGameState();
    SoundManager.playBgm();
    this.startBgmCnt = -1;
    this.ship.setScreenShake(0, 0);
    this.gameOverCnt = 0;
    this.pauseCnt = 0;
    this.tunnel.setShipPos(0, 0, 0);
    this.tunnel.setSlices();
    SoundManager.enableSe();
  }

  public initGameState(): void {
    this.score = 0;
    this.nextExtend = 0;
    this.setNextExtend();
    this.timeChangedShowCnt = -1;
    this.gotoNextZone(true);
  }

  public gotoNextZone(isFirst = false): void {
    this.clearVisibleBullets();
    if (isFirst) {
      this.time = InGameState.DEFAULT_TIME;
      this.nextBeepTime = InGameState.BEEP_START_TIME;
      return;
    }
    if (this.stageManager.middleBossZone()) {
      this.changeTime(InGameState.NEXT_ZONE_ADDITION_TIME, InGameState.NEXT_ZONE_ADDITION_TIME_MSG);
    } else {
      this.changeTime(InGameState.NEXT_LEVEL_ADDITION_TIME, InGameState.NEXT_LEVEL_ADDITION_TIME_MSG);
      this.startBgmCnt = 90;
      SoundManager.fadeBgm();
    }
  }

  public override move(): void {
    if (this.pad.keys[SDLK_p] === SDL_PRESSED) {
      if (!this.pausePressed) {
        if (this.pauseCnt <= 0 && !this.ship.isGameOver) this.pauseCnt = 1;
        else this.pauseCnt = 0;
      }
      this.pausePressed = true;
    } else {
      this.pausePressed = false;
    }
    if (this.pauseCnt > 0) {
      this.pauseCnt++;
      return;
    }
    if (this.startBgmCnt > 0) {
      this.startBgmCnt--;
      if (this.startBgmCnt <= 0) SoundManager.nextBgm();
    }
    this.ship.move();
    this.stageManager.move();
    this.enemies.move();
    this.shots.move();
    this.bullets.move();
    this.particles.move();
    this.floatLetters.move();
    this.decrementTime();
    if (this.time < 0) {
      this.time = 0;
      if (!this.ship.isGameOver) {
        this.ship.isGameOver = true;
        this.btnPressed = true;
        SoundManager.fadeBgm();
        SoundManager.disableSe();
        this.prefManager.prefData.recordResult(this.stageManager.level() | 0, this.score);
      }
      this.gameOverCnt++;
      const btn = this.pad.getButtonState();
      if (btn & Pad.Button.A) {
        if (this.gameOverCnt > 60 && !this.btnPressed) {
          this.gameManager.startTitle(true);
          return;
        }
        this.btnPressed = true;
      } else {
        this.btnPressed = false;
      }
      if (this.gameOverCnt > 1200) this.gameManager.startTitle();
    } else if (this.time <= this.nextBeepTime) {
      SoundManager.playSe("timeup_beep.wav");
      this.nextBeepTime -= 1000;
    }
  }

  public decrementTime(): void {
    this.time -= 17;
    if (this.timeChangedShowCnt >= 0) this.timeChangedShowCnt--;
    if (this.ship.replayMode && this.time < 0 && !this.ship.isGameOver) this.ship.isGameOver = true;
  }

  public override draw(): void {
    glEnable(Screen3D.GL_CULL_FACE);
    this.tunnel.draw();
    glDisable(Screen3D.GL_CULL_FACE);
    this.particles.draw();
    this.enemies.draw();
    this.ship.draw();
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE_MINUS_SRC_ALPHA);
    this.floatLetters.draw();
    glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
    glDisable(Screen3D.GL_BLEND);
    this.bullets.draw();
    glEnable(Screen3D.GL_BLEND);
    this.shots.draw();
  }

  public override drawLuminous(): void {
    this.particles.drawLuminous();
  }

  public override drawFront(): void {
    this.ship.drawFront();
    Letter.drawNum(this.score, 610, 0, 15);
    Letter.drawString("/", 510, 40, 7);
    Letter.drawNum(this.nextExtend - this.score, 615, 40, 7);
    if (this.time > InGameState.BEEP_START_TIME) Letter.drawTime(this.time, 220, 24, 15);
    else Letter.drawTime(this.time, 220, 24, 15, 1);
    if (this.timeChangedShowCnt >= 0 && this.timeChangedShowCnt % 64 > 32) {
      Letter.drawString(this.timeChangedMsg, 250, 24, 7, Letter.Direction.TO_RIGHT, 1);
    }
    Letter.drawString("LEVEL", 20, 410, 8, Letter.Direction.TO_RIGHT, 1);
    Letter.drawNum(this.stageManager.level() | 0, 135, 410, 8);
    if (this.ship.isGameOver) Letter.drawString("GAME OVER", 140, 180, 20);
    if (this.pauseCnt > 0 && this.pauseCnt % 64 < 32) Letter.drawString("PAUSE", 240, 185, 17);
  }

  public shipDestroyed(): void {
    this.clearVisibleBullets();
    this.changeTime(InGameState.SHIP_DESTROYED_PENALTY_TIME, InGameState.SHIP_DESTROYED_PENALTY_TIME_MSG);
  }

  public clearVisibleBullets(): void {
    this.bullets.clearVisible();
  }

  public addScore(sc: number): void {
    if (this.ship.isGameOver) return;
    this.score += sc;
    while (this.score > this.nextExtend) {
      this.setNextExtend();
      this.extendShip();
    }
  }

  private setNextExtend(): void {
    let es = ((((this.stageManager.level() * 0.5) | 0) + 10) * InGameState.DEFAULT_EXTEND_SCORE) / 10;
    if (es > InGameState.MAX_EXTEND_SCORE) es = InGameState.MAX_EXTEND_SCORE;
    this.nextExtend += es;
  }

  private extendShip(): void {
    this.changeTime(InGameState.EXTEND_TIME, InGameState.EXTEND_TIME_MSG);
    SoundManager.playSe("extend.wav");
  }

  private changeTime(ct: number, msg: string): void {
    this.time += ct;
    if (this.time > InGameState.MAX_TIME) this.time = InGameState.MAX_TIME;
    this.nextBeepTime = ((this.time / 1000) | 0) * 1000;
    if (this.nextBeepTime > InGameState.BEEP_START_TIME) this.nextBeepTime = InGameState.BEEP_START_TIME;
    this.timeChangedShowCnt = 240;
    this.timeChangedMsg = msg;
  }

  public saveReplay(fileName: string): void {
    this._replayData?.save(fileName);
  }

  public loadReplay(fileName: string): void {
    this._replayData = new ReplayData();
    this._replayData.load(fileName);
  }

  public resetReplay(): void {
    this._replayData = null;
  }

  public replayData(): ReplayData | null {
    return this._replayData;
  }
}

class TitleState extends GameState {
  private readonly pad: Pad;
  private readonly titleManager: TitleManager;
  private readonly passedEnemies: EnemyPool;
  private readonly inGameState: InGameState;
  private replayDataRef: ReplayData | null = null;
  private gameOverCnt = 0;

  public constructor(
    tunnel: Tunnel,
    ship: Ship,
    shots: ShotPool,
    bullets: BulletActorPool,
    enemies: EnemyPool,
    particles: ParticlePool,
    floatLetters: FloatLetterPool,
    stageManager: StageManager,
    pad: Pad,
    titleManager: TitleManager,
    passedEnemies: EnemyPool,
    inGameState: InGameState,
  ) {
    super(tunnel, ship, shots, bullets, enemies, particles, floatLetters, stageManager);
    this.pad = pad;
    this.titleManager = titleManager;
    this.passedEnemies = passedEnemies;
    this.inGameState = inGameState;
  }

  public close(): void {
    this.titleManager.close();
  }

  public setReplayData(rd: ReplayData | null): void {
    this.replayDataRef = rd;
  }

  public override start(): void {
    SoundManager.haltBgm();
    SoundManager.disableSe();
    this.titleManager.start();
    this.clearAll();
    if (this.replayDataRef) this.startReplay();
  }

  private clearAll(): void {
    this.shots.clear();
    this.bullets.clear();
    this.enemies.clear();
    this.particles.clear();
    this.floatLetters.clear();
    this.passedEnemies.clear();
  }

  private startReplay(): void {
    if (!this.replayDataRef) return;
    this.ship.replayMode = true;
    const rp = this.pad as RecordablePad;
    rp.startReplay(this.replayDataRef.padRecord);
    this._level = this.replayDataRef.level;
    this._grade = this.replayDataRef.grade;
    this._seed = this.replayDataRef.seed;
    Barrage.setRandSeed(this._seed);
    Bullet.setRandSeed(this._seed);
    Enemy.setRandSeed(this._seed);
    FloatLetter.setRandSeed(this._seed);
    Particle.setRandSeed(this._seed);
    Shot.setRandSeed(this._seed);
    SoundManager.setRandSeed(this._seed);
    this.ship.start(this._grade, this._seed);
    this.stageManager.start(this._level, this._grade, this._seed);
    this.inGameState.initGameState();
    this.ship.setScreenShake(0, 0);
    this.gameOverCnt = 0;
    this.tunnel.setShipPos(0, 0, 0);
    this.tunnel.setSlices();
    this.tunnel.setSlicesBackward();
  }

  public override move(): void {
    if (this.ship.isGameOver) {
      this.gameOverCnt++;
      if (this.gameOverCnt > 120) {
        this.clearAll();
        this.startReplay();
      }
    }
    if (this.replayDataRef) {
      this.ship.move();
      this.stageManager.move();
      this.enemies.move();
      this.shots.move();
      this.bullets.move();
      this.particles.move();
      this.floatLetters.move();
      this.passedEnemies.move();
      this.inGameState.decrementTime();
      this.titleManager.move(true);
    } else {
      this.titleManager.move(false);
    }
  }

  public override draw(): void {
    const gameViewport = getTouchLayout(Screen.width, Screen.height).gameViewport;
    if (this.replayDataRef) {
      let rcr = this.titleManager.replayChangeRatio() * 2.4;
      if (rcr > 1) rcr = 1;
      const replayViewport = {
        x: gameViewport.x,
        y: gameViewport.y,
        width: ((gameViewport.width / 4) * (3 + rcr)) | 0,
        height: gameViewport.height,
      };
      const glReplayViewport = toGLViewport(replayViewport, Screen.height);
      glViewport(glReplayViewport.x, glReplayViewport.y, glReplayViewport.width, glReplayViewport.height);
      glEnable(Screen3D.GL_CULL_FACE);
      this.tunnel.draw();
      this.tunnel.drawBackward();
      glDisable(Screen3D.GL_CULL_FACE);
      this.particles.draw();
      this.enemies.draw();
      this.passedEnemies.draw();
      this.ship.draw();
      glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE_MINUS_SRC_ALPHA);
      this.floatLetters.draw();
      glBlendFunc(Screen3D.GL_SRC_ALPHA, Screen3D.GL_ONE);
      glDisable(Screen3D.GL_BLEND);
      this.bullets.draw();
      glEnable(Screen3D.GL_BLEND);
      this.shots.draw();
    }
    const glGameViewport = toGLViewport(gameViewport, Screen.height);
    glViewport(glGameViewport.x, glGameViewport.y, glGameViewport.width, glGameViewport.height);
    setPerspectiveForSize(gameViewport.width, gameViewport.height);
    this.titleManager.draw();
  }

  public override drawLuminous(): void {}

  public override drawFront(): void {
    this.titleManager.drawFront();
    if (!this.ship.drawFrontMode || this.titleManager.replayChangeRatio() < 1) return;
    this.inGameState.drawFront();
  }
}

function glPushMatrix(): void {
  Screen3D.glPushMatrix();
}
function glPopMatrix(): void {
  Screen3D.glPopMatrix();
}
function glEnable(mode: number): void {
  Screen3D.glEnable(mode);
}
function glDisable(mode: number): void {
  Screen3D.glDisable(mode);
}
function glBlendFunc(src: number, dst: number): void {
  Screen3D.glBlendFunc(src, dst);
}
function glViewport(x: number, y: number, w: number, h: number): void {
  Screen3D.glViewport(x, y, w, h);
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

function setPerspectiveForSize(width: number, height: number): void {
  const w = Math.max(1, width);
  const h = Math.max(1, height);
  glMatrixMode(Screen3D.GL_PROJECTION);
  glLoadIdentity();
  glFrustum(
    -Screen.nearPlane,
    Screen.nearPlane,
    (-Screen.nearPlane * h) / w,
    (Screen.nearPlane * h) / w,
    0.1,
    Screen.farPlane,
  );
  glMatrixMode(Screen3D.GL_MODELVIEW);
}
