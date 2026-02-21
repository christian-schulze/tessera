import { ContainerType, Layout } from "./tree/container.js";
import { RootContainer } from "./tree/root-container.js";
import { SplitContainer } from "./tree/split-container.js";
import { WindowContainer } from "./tree/window-container.js";
import { getLayoutStrategy } from "./layout/strategy.js";

type LogFn = (message: string) => void;

export const insertWindowWithStrategy = (options: {
  root: RootContainer;
  split: SplitContainer;
  container: WindowContainer;
  focused: WindowContainer;
  mode: "focused" | "append" | "tail";
  log?: LogFn;
}): void => {
  const { root, split, container, focused, mode, log } = options;
  const strategy = getLayoutStrategy(split);
  log?.(
    `[tessera tracker] onWindowAdded layout=${split.layout} mode=${mode} targetId=${focused.id}`
  );
  const plan = strategy.onWindowAdded?.({
    root,
    parent: split,
    focused,
    mode,
  });

  if (!plan) {
    log?.(`[tessera tracker] add-window fallback reason=no plan`);
    split.addChild(container);
    return;
  }

  if (!plan.wrapTarget) {
    log?.(`[tessera tracker] add-window fallback reason=no target`);
    split.addChild(container);
    return;
  }

  const wrapTarget = plan.wrapTarget;
  const wrapLayout = plan.wrapLayout ?? split.layout;
  const targetParent = wrapTarget.parent;
  if (!targetParent || targetParent.type !== ContainerType.Split) {
    log?.(`[tessera tracker] add-window fallback reason=no parent split`);
    split.addChild(container);
    return;
  }

  const index = targetParent.children.indexOf(wrapTarget);
  if (index === -1) {
    log?.(`[tessera tracker] add-window fallback reason=no parent split`);
    split.addChild(container);
    return;
  }

  const newSplit = new SplitContainer(root.nextId(), wrapLayout);
  targetParent.children[index] = newSplit;
  newSplit.parent = targetParent;
  newSplit.addChild(wrapTarget);
  newSplit.addChild(container);
  const axis = wrapLayout === Layout.SplitH ? "horizontal" : "vertical";
  log?.(
    `[tessera tracker] add-window wrap newSplitId=${newSplit.id} axis=${axis} wrapTargetId=${wrapTarget.id}`
  );
};
