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

const reportError = (error: unknown, message: string): void => {
  const logger = (globalThis as {
    logError?: (error: Error, message?: string) => void;
  }).logError;
  if (!logger) {
    return;
  }

  logger(error instanceof Error ? error : new Error(String(error)), message);
};

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

    if (currentParent !== parent) {
      parent.add_child(bar);
    }
  }
};

export const raiseBorderActorsAboveSibling = (
  parent: ClutterParent,
  bars: ClutterActor[],
  sibling: ClutterActor | null
): void => {
  for (const bar of bars) {
    parent.set_child_above_sibling(bar, sibling);
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
  private destroySignalId: number | null = null;
  private focusedWindow: Meta.Window | null = null;

  constructor(color: string, width: number) {
    this.width = width;
    this.top = makeBar(color);
    this.bottom = makeBar(color);
    this.left = makeBar(color);
    this.right = makeBar(color);

    const group = global.window_group as unknown as ClutterParent;
    attachBorderActors(group, barsFor(this.top, this.bottom, this.left, this.right));
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
    this.destroySignalId = actor.connect("destroy", () => {
      if (this.windowActor !== actor) {
        return;
      }

      this.windowActor = null;
      this.allocationSignalId = null;
      this.destroySignalId = null;
      this.hide();
    });

    const group = global.window_group as unknown as ClutterParent;
    const actorParent = (actor as unknown as {
      get_parent?: () => ClutterParent | null;
    }).get_parent?.() ?? null;

    // Keep the bars under a stable shell-owned parent, but stack them just
    // above the focused window actor instead of above the entire window group.
    raiseBorderActorsAboveSibling(
      group,
      barsFor(this.top, this.bottom, this.left, this.right),
      actorParent === group ? actor : null
    );
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
    const w = this.width;
    const innerHeight = Math.max(0, frame.height - 2 * w);

    this.top.set_position(frame.x, frame.y);
    this.top.set_size(frame.width, w);

    this.bottom.set_position(frame.x, frame.y + frame.height - w);
    this.bottom.set_size(frame.width, w);

    this.left.set_position(frame.x, frame.y + w);
    this.left.set_size(w, innerHeight);

    this.right.set_position(frame.x + frame.width - w, frame.y + w);
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

  private disconnectWindowActor(): void {
    const actor = this.windowActor;
    const allocationSignalId = this.allocationSignalId;
    const destroySignalId = this.destroySignalId;

    this.windowActor = null;
    this.allocationSignalId = null;
    this.destroySignalId = null;

    if (!actor) {
      return;
    }

    if (allocationSignalId !== null) {
      try {
        actor.disconnect(allocationSignalId);
      } catch (error) {
        reportError(error, "[tessera] focus border failed to disconnect allocation signal");
      }
    }

    if (destroySignalId !== null) {
      try {
        actor.disconnect(destroySignalId);
      } catch (error) {
        reportError(error, "[tessera] focus border failed to disconnect destroy signal");
      }
    }
  }
}
