import type Meta from "gi://Meta";

const gi = (globalThis as { imports?: { gi?: Record<string, unknown> } }).imports?.gi;
const St = gi?.St as typeof import("gi://St").default;

type StWidget = InstanceType<typeof import("gi://St").default.Widget>;
type ClutterActor = InstanceType<typeof import("gi://Clutter").default.Actor>;

const makeBar = (color: string): StWidget => {
  const bar = new St.Widget({
    style: `background-color: ${color};`,
    reactive: false,
    can_focus: false,
    track_hover: false,
  });
  bar.hide();
  return bar;
};

export class FocusBorder {
  private readonly width: number;
  private readonly top: StWidget;
  private readonly bottom: StWidget;
  private readonly left: StWidget;
  private readonly right: StWidget;
  private windowActor: ClutterActor | null = null;
  private allocationSignalId: number | null = null;
  private focusedWindow: Meta.Window | null = null;

  constructor(color: string, width: number) {
    this.width = width;
    this.top = makeBar(color);
    this.bottom = makeBar(color);
    this.left = makeBar(color);
    this.right = makeBar(color);

    const group = global.window_group as ClutterActor;
    group.add_child(this.top);
    group.add_child(this.bottom);
    group.add_child(this.left);
    group.add_child(this.right);
  }

  update(metaWindow: Meta.Window | null): void {
    this.disconnectWindowActor();
    this.focusedWindow = metaWindow;

    if (!metaWindow) {
      this.hide();
      return;
    }

    const actor = metaWindow.get_compositor_private() as ClutterActor | null;
    if (!actor) {
      this.hide();
      return;
    }

    this.windowActor = actor;
    this.allocationSignalId = actor.connect("notify::allocation", () => {
      if (this.focusedWindow) {
        this.reposition(this.focusedWindow);
      }
    });

    // Raise bars above all window actors.
    const group = global.window_group as ClutterActor;
    group.set_child_above_sibling(this.top, null);
    group.set_child_above_sibling(this.bottom, null);
    group.set_child_above_sibling(this.left, null);
    group.set_child_above_sibling(this.right, null);

    this.reposition(metaWindow);
    this.show();
  }

  destroy(): void {
    this.disconnectWindowActor();
    this.focusedWindow = null;
    this.top.destroy();
    this.bottom.destroy();
    this.left.destroy();
    this.right.destroy();
  }

  private reposition(metaWindow: Meta.Window): void {
    const rect = metaWindow.get_frame_rect();
    const w = this.width;

    // Inset border: bars sit inside the window frame so they are never
    // clipped by window_group's monitor bounds.
    // Top and bottom bars span the full width; left/right fill the gap.
    this.top.set_position(rect.x, rect.y);
    this.top.set_size(rect.width, w);

    this.bottom.set_position(rect.x, rect.y + rect.height - w);
    this.bottom.set_size(rect.width, w);

    this.left.set_position(rect.x, rect.y + w);
    this.left.set_size(w, rect.height - 2 * w);

    this.right.set_position(rect.x + rect.width - w, rect.y + w);
    this.right.set_size(w, rect.height - 2 * w);
  }

  private show(): void {
    this.top.show();
    this.bottom.show();
    this.left.show();
    this.right.show();
  }

  private hide(): void {
    this.top.hide();
    this.bottom.hide();
    this.left.hide();
    this.right.hide();
  }

  private disconnectWindowActor(): void {
    if (this.windowActor !== null && this.allocationSignalId !== null) {
      this.windowActor.disconnect(this.allocationSignalId);
    }
    this.windowActor = null;
    this.allocationSignalId = null;
  }
}
