import type Meta from "gi://Meta";

const gi = (globalThis as { imports?: { gi?: Record<string, unknown> } }).imports?.gi;
const St = gi?.St as typeof import("gi://St").default;

type StWidget = InstanceType<typeof import("gi://St").default.Widget>;
type ClutterActor = InstanceType<typeof import("gi://Clutter").default.Actor>;

type ClutterParent = {
  add_child: (child: ClutterActor) => void;
  remove_child: (child: ClutterActor) => void;
  set_child_above_sibling: (child: ClutterActor, sibling: ClutterActor | null) => void;
};

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

const barsFor = (top: StWidget, bottom: StWidget, left: StWidget, right: StWidget): ClutterActor[] => [
  top as unknown as ClutterActor,
  bottom as unknown as ClutterActor,
  left as unknown as ClutterActor,
  right as unknown as ClutterActor,
];

export const attachBorderActors = (
  parent: ClutterParent,
  bars: ClutterActor[]
): void => {
  for (const bar of bars) {
    const currentParent = (bar as unknown as {
      get_parent?: () => ClutterParent | null;
    }).get_parent?.() ?? null;
    if (currentParent && currentParent !== parent) {
      currentParent.remove_child(bar);
    }

    parent.add_child(bar);
    parent.set_child_above_sibling(bar, null);
  }
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

    attachBorderActors(actor as unknown as ClutterParent, barsFor(this.top, this.bottom, this.left, this.right));
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
    const frame = metaWindow.get_frame_rect();
    const buffer = metaWindow.get_buffer_rect();
    const w = this.width;
    const innerHeight = Math.max(0, frame.height - 2 * w);

    // Bars are attached to the compositor actor (buffer space), while frame
    // rect coordinates are in stage space. Compensate by offsetting by
    // frame-vs-buffer origin delta.
    const x = frame.x - buffer.x;
    const y = frame.y - buffer.y;

    this.top.set_position(x, y);
    this.top.set_size(frame.width, w);

    this.bottom.set_position(x, y + frame.height - w);
    this.bottom.set_size(frame.width, w);

    this.left.set_position(x, y + w);
    this.left.set_size(w, innerHeight);

    this.right.set_position(x + frame.width - w, y + w);
    this.right.set_size(w, innerHeight);
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

  private detachBars(): void {
    for (const bar of barsFor(this.top, this.bottom, this.left, this.right)) {
      const parent = (bar as unknown as {
        get_parent?: () => ClutterParent | null;
      }).get_parent?.() ?? null;
      parent?.remove_child(bar);
    }
  }

  private disconnectWindowActor(): void {
    if (this.windowActor !== null && this.allocationSignalId !== null) {
      this.windowActor.disconnect(this.allocationSignalId);
    }
    this.windowActor = null;
    this.allocationSignalId = null;
    this.detachBars();
  }
}
