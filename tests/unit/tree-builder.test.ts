import { TreeBuilder } from "../../src/tree/tree-builder.ts";
import { ContainerType, Layout } from "../../src/tree/container.ts";
import { RootContainer } from "../../src/tree/root-container.ts";
import { OutputContainer } from "../../src/tree/output-container.ts";
import { WorkspaceContainer } from "../../src/tree/workspace-container.ts";
import { SplitContainer } from "../../src/tree/split-container.ts";

describe("TreeBuilder", () => {
  it("builds multiple workspaces per output", () => {
    const builder = new TreeBuilder();
    const root = builder.build(
      [{ index: 0, workArea: { x: 0, y: 0, width: 1920, height: 1080 } }],
      { workspaceCount: 3, activeWorkspaceIndex: 1 }
    );

    const output = root.children[0] as OutputContainer;
    expect(output.children.length).toBe(3);
    const [ws1, ws2, ws3] = output.children as WorkspaceContainer[];
    expect(ws1.number).toBe(1);
    expect(ws2.number).toBe(2);
    expect(ws3.number).toBe(3);
    expect(ws1.visible).toBe(false);
    expect(ws2.visible).toBe(true);
    expect(ws3.visible).toBe(false);
  });

  it("builds a root tree from monitor info", () => {
    const builder = new TreeBuilder();
    const root = builder.build([
      { index: 0, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
      { index: 1, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } },
    ]);

    expect(root).toBeInstanceOf(RootContainer);
    expect(root.type).toBe(ContainerType.Root);
    expect(root.children.length).toBe(2);

    const output0 = root.children[0] as OutputContainer;
    const output1 = root.children[1] as OutputContainer;

    expect(output0).toBeInstanceOf(OutputContainer);
    expect(output1).toBeInstanceOf(OutputContainer);
    expect(output0.monitorIndex).toBe(0);
    expect(output1.monitorIndex).toBe(1);

    const ws0 = output0.children[0] as WorkspaceContainer;
    const ws1 = output1.children[0] as WorkspaceContainer;

    expect(ws0).toBeInstanceOf(WorkspaceContainer);
    expect(ws1).toBeInstanceOf(WorkspaceContainer);
    expect(ws0.visible).toBe(true);
    expect(ws1.visible).toBe(true);
    expect(ws0.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
    expect(ws1.rect).toEqual({ x: 1920, y: 0, width: 1920, height: 1080 });

    const split0 = ws0.children[0] as SplitContainer;
    const split1 = ws1.children[0] as SplitContainer;

    expect(split0).toBeInstanceOf(SplitContainer);
    expect(split1).toBeInstanceOf(SplitContainer);
    expect(split0.layout).toBe(Layout.Alternating);
    expect(split1.layout).toBe(Layout.Alternating);
    expect(split0.rect).toEqual(ws0.rect);
    expect(split1.rect).toEqual(ws1.rect);
  });

  describe("workspaceOutputs", () => {
    it("assigns workspaces to specific outputs", () => {
      const builder = new TreeBuilder();
      const root = builder.build(
        [
          { index: 0, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
          { index: 1, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } },
        ],
        {
          workspaceCount: 3,
          activeWorkspaceIndex: 0,
          workspaceOutputs: { "1": 0, "2": 0, "3": 1 },
        }
      );

      const output0 = root.children[0] as OutputContainer;
      const output1 = root.children[1] as OutputContainer;

      const ws0Numbers = (output0.children as WorkspaceContainer[]).map(
        (ws) => ws.number
      );
      const ws1Numbers = (output1.children as WorkspaceContainer[]).map(
        (ws) => ws.number
      );

      expect(ws0Numbers).toEqual([1, 2]);
      expect(ws1Numbers).toEqual([3]);
    });

    it("creates all workspaces on each output when no assignments", () => {
      const builder = new TreeBuilder();
      const root = builder.build(
        [
          { index: 0, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
          { index: 1, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } },
        ],
        { workspaceCount: 2, activeWorkspaceIndex: 0 }
      );

      const output0 = root.children[0] as OutputContainer;
      const output1 = root.children[1] as OutputContainer;

      expect(output0.children.length).toBe(2);
      expect(output1.children.length).toBe(2);
    });

    it("creates unassigned workspaces on all outputs", () => {
      const builder = new TreeBuilder();
      const root = builder.build(
        [
          { index: 0, workArea: { x: 0, y: 0, width: 1920, height: 1080 } },
          { index: 1, workArea: { x: 1920, y: 0, width: 1920, height: 1080 } },
        ],
        {
          workspaceCount: 3,
          activeWorkspaceIndex: 0,
          workspaceOutputs: { "1": 0 },
        }
      );

      const output0 = root.children[0] as OutputContainer;
      const output1 = root.children[1] as OutputContainer;

      const ws0Numbers = (output0.children as WorkspaceContainer[]).map(
        (ws) => ws.number
      );
      const ws1Numbers = (output1.children as WorkspaceContainer[]).map(
        (ws) => ws.number
      );

      expect(ws0Numbers).toEqual([1, 2, 3]);
      expect(ws1Numbers).toEqual([2, 3]);
    });
  });
});
