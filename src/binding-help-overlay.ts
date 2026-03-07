import type { Binding } from "./bindings/mode.js";

const gi = (globalThis as { imports?: { gi?: Record<string, unknown> } }).imports?.gi;
const St = gi?.St as typeof import("gi://St").default;

type StWidget = InstanceType<typeof import("gi://St").default.Widget>;
type ClutterActor = InstanceType<typeof import("gi://Clutter").default.Actor>;

type BindingModeSnapshot = {
  name: string;
  bindings: Binding[];
};

type PointerEvent = {
  get_button?: () => number;
  get_coords?: () => [number, number];
};

type Position = {
  x: number;
  y: number;
};

const pointerCoords = (event: PointerEvent): Position => {
  const [x, y] = event.get_coords?.() ?? [0, 0];
  return { x, y };
};

export const computeOverlayDragPosition = (
  pointer: Position,
  offset: Position
): Position => ({
  x: pointer.x - offset.x,
  y: pointer.y - offset.y,
});

const makeLabel = (text: string, muted = false): StWidget => {
  const color = muted ? "#9ca3af" : "#e5e7eb";
  return new St.Label({
    text,
    style: `color: ${color}; font-size: 12px; font-family: monospace;`,
  });
};

const makeSpacer = (): StWidget =>
  new St.Widget({ style: "height: 6px;", reactive: false, can_focus: false });

const formatKeys = (keys: string[]): string => keys.join(" / ");

export class BindingHelpOverlay {
  private readonly panel: StWidget;
  private isVisible = false;
  private dragOffset: Position = { x: 0, y: 0 };
  private dragging = false;
  private hasCustomPosition = false;

  constructor() {
    this.panel = new St.BoxLayout({
      style:
        "background-color: rgba(0, 0, 0, 0.86); border-radius: 6px; padding: 12px 14px; min-width: 420px;",
      vertical: true,
      reactive: true,
      can_focus: false,
      track_hover: true,
    } as object);
    this.panel.hide();

    const group = global.window_group as ClutterActor;
    group.add_child(this.panel);
    this.positionPanel();
    this.connectDragSignals();
  }

  isShown(): boolean {
    return this.isVisible;
  }

  toggle(mode: BindingModeSnapshot): void {
    if (this.isVisible) {
      this.hide();
      return;
    }

    this.show(mode);
  }

  show(mode: BindingModeSnapshot): void {
    this.buildContent(mode);
    if (!this.hasCustomPosition) {
      this.positionPanel();
    }
    const group = global.window_group as ClutterActor;
    group.set_child_above_sibling(this.panel, null);
    this.panel.show();
    this.isVisible = true;
  }

  refresh(mode: BindingModeSnapshot): void {
    if (!this.isVisible) {
      return;
    }

    this.show(mode);
  }

  hide(): void {
    this.panel.hide();
    this.isVisible = false;
  }

  destroy(): void {
    this.dragging = false;
    this.panel.destroy();
  }

  private positionPanel(): void {
    const stage = global.stage as { width?: number };
    const x = Math.max(16, (stage?.width ?? 600) - 460);
    this.panel.set_position(x, 56);
  }

  private connectDragSignals(): void {
    this.panel.connect("button-press-event", (_actor, event) => {
      const pointerEvent = event as PointerEvent;
      const button = pointerEvent.get_button?.() ?? 1;
      if (button !== 1) {
        return false;
      }

      const pointer = pointerCoords(pointerEvent);
      const panel = this.panel as unknown as {
        get_x?: () => number;
        get_y?: () => number;
      };
      const panelPosition = {
        x: panel.get_x?.() ?? 0,
        y: panel.get_y?.() ?? 0,
      };
      this.dragOffset = {
        x: pointer.x - panelPosition.x,
        y: pointer.y - panelPosition.y,
      };
      this.dragging = true;
      return true;
    });

    this.panel.connect("motion-event", (_actor, event) => {
      if (!this.dragging) {
        return false;
      }

      const nextPosition = computeOverlayDragPosition(
        pointerCoords(event as PointerEvent),
        this.dragOffset
      );
      this.panel.set_position(nextPosition.x, nextPosition.y);
      this.hasCustomPosition = true;
      return true;
    });

    this.panel.connect("button-release-event", (_actor, event) => {
      const pointerEvent = event as PointerEvent;
      const button = pointerEvent.get_button?.() ?? 1;
      if (button !== 1) {
        return false;
      }

      this.dragging = false;
      return true;
    });
  }

  private buildContent(mode: BindingModeSnapshot): void {
    const panel = this.panel as unknown as {
      remove_all_children: () => void;
      add_child: (child: StWidget) => void;
    };

    panel.remove_all_children();
    panel.add_child(makeLabel("Keybindings", true));
    panel.add_child(makeLabel(`  Mode: ${mode.name}`));
    panel.add_child(makeSpacer());

    if (mode.bindings.length === 0) {
      panel.add_child(makeLabel("  (No bindings in this mode)", true));
      return;
    }

    for (const binding of mode.bindings) {
      panel.add_child(makeLabel(`  ${formatKeys(binding.keys)}  →  ${binding.command}`));
    }
  }
}
