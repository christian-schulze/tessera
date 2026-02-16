import type { Rect } from "../tree/container.js";

export interface WindowAdapter {
  activate: (window: unknown) => void;
  moveResize: (window: unknown, rect: Rect) => void;
  setFullscreen: (window: unknown, fullscreen: boolean) => void;
  setFloating: (window: unknown, floating: boolean) => void;
  close: (window: unknown) => void;
  exec: (command: string) => void;
}
