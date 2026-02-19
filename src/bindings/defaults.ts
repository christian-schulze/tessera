import type { BindingMode } from "./mode.js";

const workspaceBindings = (): BindingMode["bindings"] => {
  const bindings: BindingMode["bindings"] = [];

  for (let index = 1; index <= 9; index += 1) {
    const name = String(index);
    bindings.push({ keys: [`<Super>${name}`], command: `workspace ${name}` });
    bindings.push({
      keys: [`<Super><Shift>${name}`],
      command: `move container to workspace ${name}`,
    });
  }

  bindings.push({ keys: ["<Super>0"], command: "workspace 10" });
  bindings.push({ keys: ["<Super><Shift>0"], command: "move container to workspace 10" });

  return bindings;
};

export const buildDefaultBindingModes = (): BindingMode[] => [
  {
    name: "default",
    bindings: [
      { keys: ["<Super>h"], command: "focus left" },
      { keys: ["<Super>j"], command: "focus down" },
      { keys: ["<Super>k"], command: "focus up" },
      { keys: ["<Super>l"], command: "focus right" },
      { keys: ["<Super><Shift>h"], command: "move left" },
      { keys: ["<Super><Shift>j"], command: "move down" },
      { keys: ["<Super><Shift>k"], command: "move up" },
      { keys: ["<Super><Shift>l"], command: "move right" },
      { keys: ["<Super>b"], command: "split horizontal" },
      { keys: ["<Super>v"], command: "split vertical" },
      { keys: ["<Super>e"], command: "layout toggle split" },
      { keys: ["<Super>f"], command: "fullscreen toggle" },
      { keys: ["<Super><Shift>q"], command: "kill" },
      { keys: ["<Super><Shift>r"], command: "reload" },
      { keys: ["<Super><Shift>t"], command: "retile" },
      { keys: ["<Super><Shift>d"], command: "dump debug" },
      { keys: ["<Super><Shift>i"], command: "dump tree" },
      { keys: ["<Super>r"], command: "mode \"resize\"" },
      ...workspaceBindings(),
    ],
  },
  {
    name: "resize",
    bindings: [
      { keys: ["h"], command: "resize shrink width 10 px" },
      { keys: ["l"], command: "resize grow width 10 px" },
      { keys: ["k"], command: "resize shrink height 10 px" },
      { keys: ["j"], command: "resize grow height 10 px" },
      { keys: ["Escape"], command: "mode \"default\"" },
    ],
  },
];
