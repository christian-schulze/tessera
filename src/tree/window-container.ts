import type { ContainerJSON } from "./container.js";
import { Container, ContainerType } from "./container.js";

export interface WindowJSON extends ContainerJSON {
  windowId: number;
  appId: string;
  title: string;
  window_type: number;
  floating: boolean;
  fullscreen: boolean;
}

export class WindowContainer extends Container {
  window: unknown;
  windowId: number;
  appId: string;
  title: string;
  window_type: number;
  floating: boolean;
  fullscreen: boolean;

  constructor(
    id: number,
    window: unknown,
    windowId: number,
    appId: string,
    title: string,
    window_type = 0
  ) {
    super(id, ContainerType.Window);
    this.window = window;
    this.windowId = windowId;
    this.appId = appId;
    this.title = title;
    this.window_type = window_type;
    this.floating = false;
    this.fullscreen = false;
  }

  override toJSON(): WindowJSON {
    return {
      ...super.toJSON(),
      windowId: this.windowId,
      appId: this.appId,
      title: this.title,
      window_type: this.window_type,
      floating: this.floating,
      fullscreen: this.fullscreen,
    };
  }
}
