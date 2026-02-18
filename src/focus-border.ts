import type { FocusedBorderConfig } from "./config.js";
import type { Rect } from "./tree/container.js";

type StWidget = {
  set_style: (style: string) => void;
  set_position: (x: number, y: number) => void;
  set_size: (width: number, height: number) => void;
  show: () => void;
  hide: () => void;
  destroy: () => void;
  visible: boolean;
};

type LayoutManager = {
  addTopChrome: (actor: StWidget) => void;
  removeChrome: (actor: StWidget) => void;
};

type StConstructor = {
  Widget: new (props: {
    reactive: boolean;
    can_focus: boolean;
    track_hover: boolean;
  }) => StWidget;
};

export interface FocusBorderDeps {
  St: StConstructor;
  layoutManager: LayoutManager;
}

export class FocusBorder {
  private actor: StWidget | null = null;
  private deps: FocusBorderDeps;
  private config: FocusedBorderConfig;

  constructor(config: FocusedBorderConfig, deps: FocusBorderDeps) {
    this.config = config;
    this.deps = deps;
  }

  enable(): void {
    if (this.actor) {
      return;
    }

    if (!this.config.color || this.config.width <= 0) {
      return;
    }

    this.actor = new this.deps.St.Widget({
      reactive: false,
      can_focus: false,
      track_hover: false,
    });

    this.applyStyle();
    this.actor.hide();
    this.deps.layoutManager.addTopChrome(this.actor);
  }

  disable(): void {
    if (!this.actor) {
      return;
    }

    this.deps.layoutManager.removeChrome(this.actor);
    this.actor.destroy();
    this.actor = null;
  }

  updateConfig(config: FocusedBorderConfig): void {
    this.config = config;
    if (this.actor) {
      this.applyStyle();
    }
  }

  updatePosition(rect: Rect | null): void {
    if (!this.actor) {
      return;
    }

    if (!rect || !this.config.color || this.config.width <= 0) {
      this.actor.hide();
      return;
    }

    this.actor.set_position(rect.x, rect.y);
    this.actor.set_size(rect.width, rect.height);
    this.actor.show();
  }

  private applyStyle(): void {
    if (!this.actor) {
      return;
    }

    const { color, width } = this.config;
    this.actor.set_style(
      `border: ${width}px solid ${color}; background-color: transparent;`
    );
  }
}
