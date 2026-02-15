import type { ContainerJSON } from "./container.js";
import { Container, ContainerType } from "./container.js";

export interface WindowJSON extends ContainerJSON {
  windowId: number;
  appId: string;
  title: string;
  floating: boolean;
  fullscreen: boolean;
}

export class WindowContainer extends Container {
  window: unknown;
  windowId: number;
  appId: string;
  title: string;
  floating: boolean;
  fullscreen: boolean;

  constructor(
    id: number,
    window: unknown,
    windowId: number,
    appId: string,
    title: string
  ) {
    super(id, ContainerType.Window);
    this.window = window;
    this.windowId = windowId;
    this.appId = appId;
    this.title = title;
    this.floating = false;
    this.fullscreen = false;
  }

  override toJSON(): WindowJSON {
    return {
      ...super.toJSON(),
      windowId: this.windowId,
      appId: this.appId,
      title: this.title,
      floating: this.floating,
      fullscreen: this.fullscreen,
    };
  }
}
