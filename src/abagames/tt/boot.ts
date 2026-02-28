/*
 * Ported from tt/src/abagames/tt/boot.d
 */

import { Logger } from "../util/logger";
import { Tokenizer } from "../util/tokenizer";
import { MainLoop } from "../util/sdl/mainloop";
import { Pad } from "../util/sdl/pad";
import { RecordablePad } from "../util/sdl/recordablepad";
import { SoundManager } from "../util/sdl/sound";
import { GameManager } from "./gamemanager";
import { PrefManager } from "./prefmanager";
import { initializeRuntimeAssetsFromGlobals } from "./runtimeassets";
import { Screen } from "./screen";

let screen: Screen | null = null;
let input: Pad | null = null;
let gameManager: GameManager | null = null;
let prefManager: PrefManager | null = null;
let mainLoop: MainLoop | null = null;

/**
 * Boot the game.
 */
export function boot(args: string[]): number {
  if (screen) return 0;
  initializeRuntimeAssetsFromGlobals();
  screen = new Screen();
  input = new RecordablePad();
  try {
    input.openJoystick();
  } catch {
    // optional in browser environments
  }
  gameManager = new GameManager();
  prefManager = new PrefManager();
  mainLoop = new MainLoop(screen, input, gameManager, prefManager);
  try {
    parseArgs(args);
  } catch {
    return 1;
  }
  try {
    mainLoop.loop();
  } catch (e) {
    try {
      gameManager.saveErrorReplay();
    } catch {
      // ignore
    }
    throw e;
  }
  return 0;
}

function parseArgs(commandArgs: string[]): void {
  const args = readOptionsIniFile();
  for (let i = 1; i < commandArgs.length; i++) args.push(commandArgs[i]);
  Screen.autoResizeToWindow = !args.includes("-res");
  const progName = commandArgs[0] ?? "tt-web";
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "-brightness": {
        if (i >= args.length - 1) throwInvalidOptions(progName);
        i++;
        const b = parseInt(args[i], 10) / 100;
        if (!(b >= 0 && b <= 1)) throwInvalidOptions(progName);
        Screen.brightness = b;
        break;
      }
      case "-luminosity":
      case "-luminous": {
        if (i >= args.length - 1) throwInvalidOptions(progName);
        i++;
        const l = parseInt(args[i], 10) / 100;
        if (!(l >= 0 && l <= 1)) throwInvalidOptions(progName);
        Screen.luminous = l;
        break;
      }
      case "-window":
        Screen.windowMode = true;
        break;
      case "-res": {
        if (i >= args.length - 2) throwInvalidOptions(progName);
        i++;
        const w = parseInt(args[i], 10);
        i++;
        const h = parseInt(args[i], 10);
        Screen.width = w;
        Screen.height = h;
        Screen.autoResizeToWindow = false;
        break;
      }
      case "-nosound":
        SoundManager.noSound = true;
        break;
      case "-reverse":
        if (input) input.buttonReversed = true;
        break;
      case "-accframe":
        if (mainLoop) mainLoop.accframe = 1;
        break;
      default:
        throwInvalidOptions(progName);
    }
  }
}

const OPTIONS_INI_FILE = "options.ini";

function readOptionsIniFile(): string[] {
  try {
    return Tokenizer.readFile(OPTIONS_INI_FILE, " ");
  } catch {
    return [];
  }
}

function usage(progName: string): void {
  Logger.error(`Usage: ${progName} [-brightness [0-100]] [-luminosity [0-100]] [-window] [-res x y] [-nosound]`);
}

function throwInvalidOptions(progName: string): never {
  usage(progName);
  throw new Error("Invalid options");
}
