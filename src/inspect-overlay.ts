import type { WindowContainer } from "./tree/window-container.js";
import { ContainerType, Layout } from "./tree/container.js";
import { WorkspaceContainer } from "./tree/workspace-container.js";
import type { Container } from "./tree/container.js";
import type { InspectOverlayConfig } from "./config.js";

const gi = (globalThis as { imports?: { gi?: Record<string, unknown> } }).imports?.gi;
const St = gi?.St as typeof import("gi://St").default;

type StWidget = InstanceType<typeof import("gi://St").default.Widget>;
type ClutterActor = InstanceType<typeof import("gi://Clutter").default.Actor>;

const windowTypeName = (type: number): string => {
  const names: Record<number, string> = {
    0: "Normal",
    1: "Desktop",
    2: "Dock",
    3: "Dialog",
    4: "Modal Dialog",
    5: "Toolbar",
    6: "Menu",
    7: "Utility",
    8: "Splashscreen",
    9: "Dropdown Menu",
    10: "Popup Menu",
    11: "Tooltip",
    12: "Notification",
    13: "Combo",
    14: "DND",
    15: "Override Other",
  };
  return names[type] ?? `Unknown (${type})`;
};

const layoutName = (layout: Layout): string => {
  switch (layout) {
    case Layout.SplitH: return "SplitH";
    case Layout.SplitV: return "SplitV";
    case Layout.Stacking: return "Stacking";
    case Layout.Tabbed: return "Tabbed";
    default: return `Layout(${layout as string})`;
  }
};

const containerTypeName = (type: ContainerType): string => {
  switch (type) {
    case ContainerType.Root: return "Root";
    case ContainerType.Output: return "Output";
    case ContainerType.Workspace: return "Workspace";
    case ContainerType.Split: return "Split";
    case ContainerType.Window: return "Window";
    default: return `Type(${type as number})`;
  }
};

const findWorkspace = (container: Container): WorkspaceContainer | null => {
  let current: Container | null = container.parent;
  while (current) {
    if (current instanceof WorkspaceContainer) {
      return current;
    }
    current = current.parent;
  }
  return null;
};

const makeLabel = (text: string, config: InspectOverlayConfig, muted = false): StWidget => {
  const color = muted ? config.headerColor : config.textColor;
  const label = new St.Label({
    text,
    style: `color: ${color}; font-size: 12px; font-family: monospace;`,
  });
  return label;
};

const makeSpacer = (): StWidget =>
  new St.Widget({ style: "height: 6px;", reactive: false, can_focus: false });

export class InspectOverlay {
  private readonly panel: StWidget;
  private readonly config: InspectOverlayConfig;
  private isVisible = false;

  constructor(config: InspectOverlayConfig) {
    this.config = config;
    this.panel = new St.BoxLayout({
      style:
        `background-color: ${config.background}; border-radius: 6px; padding: 12px 14px; min-width: 320px;`,
      vertical: true,
      reactive: false,
      can_focus: false,
      track_hover: false,
    } as object);
    this.panel.hide();

    const group = global.window_group as ClutterActor;
    group.add_child(this.panel);
  }

  show(container: WindowContainer): void {
    this.buildContent(container);

    const group = global.window_group as ClutterActor;
    group.set_child_above_sibling(this.panel, null);

    const meta = container.window as { get_frame_rect?: () => { x: number; y: number } };
    const rect = meta.get_frame_rect?.() ?? container.rect;
    this.panel.set_position(rect.x + 16, rect.y + 16);

    this.panel.show();
    this.isVisible = true;
  }

  hide(): void {
    this.panel.hide();
    this.isVisible = false;
  }

  toggle(container: WindowContainer): void {
    if (this.isVisible) {
      this.hide();
    } else {
      this.show(container);
    }
  }

  destroy(): void {
    this.panel.destroy();
  }

  private buildContent(container: WindowContainer): void {
    const panel = this.panel as unknown as {
      remove_all_children: () => void;
      add_child: (child: StWidget) => void;
    };
    panel.remove_all_children();

    const add = (text: string, muted = false): void => {
      panel.add_child(makeLabel(text, this.config, muted));
    };

    const spacer = (): void => {
      panel.add_child(makeSpacer());
    };

    // Window section
    add("Window", true);
    add(`  Title:      ${container.title || "(no title)"}`);
    add(`  App ID:     ${container.appId}`);
    add(`  Type:       ${windowTypeName(container.window_type)} (${container.window_type})`);
    add(`  Floating:   ${container.floating ? "yes" : "no"}`);
    add(`  Fullscreen: ${container.fullscreen ? "yes" : "no"}`);

    spacer();

    // Geometry section
    add("Geometry", true);
    const r = container.rect;
    add(`  Rect:       ${r.x}, ${r.y}  ${r.width}×${r.height}`);
    add(`  Proportion: ${container.proportion.toFixed(2)}`);

    spacer();

    // Tree section
    add("Tree", true);
    if (container.parent) {
      const p = container.parent;
      const isAutoSplit =
        (p.layout === Layout.SplitH || p.layout === Layout.SplitV) &&
        p.parent?.alternating === true;
      const layoutLabel = p.alternating
        ? `${layoutName(p.layout)} (alt)`
        : isAutoSplit
          ? `${layoutName(p.layout)}, auto`
          : layoutName(p.layout);
      add(
        `  Parent:     ${containerTypeName(p.type)} [${layoutLabel}] — ${p.children.length} child${p.children.length === 1 ? "" : "ren"}`
      );
    } else {
      add(`  Parent:     (none)`);
    }
    const ws = findWorkspace(container);
    if (ws) {
      add(`  Workspace:  ${ws.number} (${ws.name || `ws${ws.number}`})`);
    }

    spacer();

    // IDs section
    add("IDs", true);
    add(`  Container:  ${container.id}`);
    add(`  Window:     ${container.windowId}`);
    if (container.marks.size > 0) {
      add(`  Marks:      ${[...container.marks].join(", ")}`);
    }
  }
}
