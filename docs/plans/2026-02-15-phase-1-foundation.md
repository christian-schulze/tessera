# Phase 1: Foundation — Container Tree, Reflow & Auto-Tiling

**Goal:** Build the container tree model, geometry reflow engine, floating layer, window tracking, extension lifecycle, and auto-tiling so that opening/closing windows in a nested GNOME Shell session produces correct tiled layouts.

**Architecture:** A GNOME Shell extension written in TypeScript, compiled with `tsc` to ESM JavaScript. The core data structure is an N-ary container tree (Root → Output → Workspace → Split → Window) with proportion-based geometry reflow. Windows are tracked via GNOME Shell signals and auto-inserted into the tree. A floating layer is modeled as a first-class concept on each workspace.

**Tech Stack:**
- TypeScript → compiled with `tsc` (no bundler)
- `@girs/gjs`, `@girs/gnome-shell`, `@girs/meta-17`, `@girs/st-17`, `@girs/clutter-17`, `@girs/shell-17`, `@girs/gio-2.0`, `@girs/glib-2.0`, `@girs/gobject-2.0`
- Jasmine for unit tests (pure logic — tree operations, reflow math)
- GJS runtime (GNOME Shell 49)

---

## Task 0: Project Scaffolding

### Files

- **Create** `package.json`
- **Create** `tsconfig.json`
- **Create** `src/ambient.d.ts`
- **Create** `metadata.json`
- **Create** `Makefile`
- **Create** `.gitignore`
- **Create** `eslint.config.mjs`
- **Create** `tests/jasmine.json`

### Steps

1. Initialize git repo:
   ```bash
   cd ~/code/tessera && git init
   ```

2. Create `package.json`:
   ```json
   {
     "name": "tessera",
     "version": "0.1.0",
     "type": "module",
     "description": "i3-like tiling window manager for GNOME Shell",
     "scripts": {
       "build": "tsc",
       "lint": "eslint src/",
       "test": "npx jasmine --config=tests/jasmine.json",
       "check": "npm run lint && npm run build && npm run test"
     },
     "devDependencies": {
       "typescript": "^5.7.0",
       "eslint": "^9.0.0",
       "@eslint/js": "^9.0.0",
       "typescript-eslint": "^8.0.0",
       "jasmine": "^5.5.0",
       "@girs/gjs": "^4.0.0",
       "@girs/gnome-shell": "^49.0.0",
       "@girs/meta-17": "*",
       "@girs/st-17": "*",
       "@girs/clutter-17": "*",
       "@girs/shell-17": "*",
       "@girs/gio-2.0": "*",
       "@girs/glib-2.0": "*",
       "@girs/gobject-2.0": "*"
     }
   }
   ```

3. Create `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "outDir": "./dist",
       "sourceMap": false,
       "strict": true,
       "skipLibCheck": true,
       "target": "ES2023",
       "lib": ["ES2023"],
       "declaration": false,
       "noEmit": false
     },
     "include": ["src/ambient.d.ts", "src/**/*.ts"]
   }
   ```

4. Create `src/ambient.d.ts`:
   ```typescript
   import "@girs/gjs";
   import "@girs/gjs/dom";
   import "@girs/gnome-shell/ambient";
   import "@girs/gnome-shell/extensions/global";
   ```

5. Create `metadata.json`:
   ```json
   {
     "uuid": "tessera@tessera.dev",
     "name": "Tessera",
     "description": "i3-like tiling window manager for GNOME Shell",
     "shell-version": ["49"],
     "url": ""
   }
   ```

6. Create `Makefile`:
   ```makefile
   UUID = tessera@tessera.dev
   INSTALL_DIR = $(HOME)/.local/share/gnome-shell/extensions/$(UUID)
   REPO_DIR = $(CURDIR)
   BUILD_DIR = $(CURDIR)/dist

   .PHONY: help build install uninstall enable disable restart nested lint test check clean

   help: ## Show this help
   	@grep -E '^[a-zA-Z_-]+:.*##' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

   build: ## Compile TypeScript to JavaScript
   	npx tsc
   	cp metadata.json $(BUILD_DIR)/
   	@echo "Build complete: $(BUILD_DIR)/"

   install: build ## Symlink build output into GNOME Shell extensions directory
   	@if [ -L "$(INSTALL_DIR)" ]; then \
   		echo "Symlink already exists: $(INSTALL_DIR)"; \
   	elif [ -e "$(INSTALL_DIR)" ]; then \
   		echo "Error: $(INSTALL_DIR) exists and is not a symlink"; exit 1; \
   	else \
   		ln -s "$(BUILD_DIR)" "$(INSTALL_DIR)"; \
   		echo "Installed: $(INSTALL_DIR) -> $(BUILD_DIR)"; \
   	fi

   uninstall: ## Remove symlink from GNOME Shell extensions directory
   	@if [ -L "$(INSTALL_DIR)" ]; then \
   		rm "$(INSTALL_DIR)"; \
   		echo "Removed symlink: $(INSTALL_DIR)"; \
   	elif [ -e "$(INSTALL_DIR)" ]; then \
   		echo "Error: $(INSTALL_DIR) is not a symlink, refusing to remove"; exit 1; \
   	else \
   		echo "Nothing to remove: $(INSTALL_DIR) does not exist"; \
   	fi

   enable: ## Enable the extension
   	gnome-extensions enable $(UUID)

   disable: ## Disable the extension
   	gnome-extensions disable $(UUID)

   restart: build ## Rebuild and re-enable the extension
   	gnome-extensions disable $(UUID) && gnome-extensions enable $(UUID)

   nested: ## Launch a nested GNOME Shell session
   	dbus-run-session gnome-shell --devkit --wayland

   lint: ## Run ESLint on source files
   	npx eslint src/

   test: ## Run unit tests
   	npx jasmine --config=tests/jasmine.json

   check: lint build test ## Run all checks (lint, build, tests)
   	@echo "All checks passed"

   clean: ## Remove build output
   	rm -rf $(BUILD_DIR)
   ```

7. Create `.gitignore`:
   ```
   node_modules/
   dist/
   *.shell-extension.zip
   ```

8. Create `eslint.config.mjs`:
   ```javascript
   import eslint from "@eslint/js";
   import tseslint from "typescript-eslint";

   export default tseslint.config(
     eslint.configs.recommended,
     ...tseslint.configs.recommended,
     {
       ignores: ["dist/", "node_modules/", "tests/"],
     }
   );
   ```

9. Create `tests/jasmine.json`:
   ```json
   {
     "spec_dir": "tests",
     "spec_files": ["unit/**/*.test.js"],
     "env": {
       "stopSpecOnExpectationFailure": false,
       "random": false
     }
   }
   ```

10. Install dependencies and verify:
    ```bash
    npm install
    npx tsc --version
    # Expected: Version 5.x.x
    ```

11. Commit:
    ```bash
    git add -A && git commit -m "chore: scaffold project with TS, Makefile, and test harness"
    ```

---

## Task 1: Container Types & Base Class

### Files

- **Create** `src/tree/types.ts`
- **Create** `src/tree/container.ts`
- **Create** `tests/unit/container.test.js`

### Steps

1. Write the failing test `tests/unit/container.test.js`:
   ```javascript
   // Tests for Container base class
   // Import from compiled output
   const { Container, ContainerType, Layout } = await import("../../dist/tree/container.js");
   const { Rect } = await import("../../dist/tree/types.js");

   describe("Container", () => {
     it("should create with an id and type", () => {
       const c = new Container(ContainerType.Split);
       expect(c.id).toBeDefined();
       expect(c.type).toBe(ContainerType.Split);
       expect(c.parent).toBeNull();
       expect(c.children).toEqual([]);
     });

     it("should generate unique ids", () => {
       const a = new Container(ContainerType.Split);
       const b = new Container(ContainerType.Split);
       expect(a.id).not.toBe(b.id);
     });

     it("should add a child and set parent", () => {
       const parent = new Container(ContainerType.Split);
       const child = new Container(ContainerType.Window);
       parent.addChild(child);
       expect(parent.children.length).toBe(1);
       expect(child.parent).toBe(parent);
     });

     it("should add a child at a specific index", () => {
       const parent = new Container(ContainerType.Split);
       const a = new Container(ContainerType.Window);
       const b = new Container(ContainerType.Window);
       const c = new Container(ContainerType.Window);
       parent.addChild(a);
       parent.addChild(c);
       parent.addChild(b, 1);
       expect(parent.children[0]).toBe(a);
       expect(parent.children[1]).toBe(b);
       expect(parent.children[2]).toBe(c);
     });

     it("should remove a child and clear parent", () => {
       const parent = new Container(ContainerType.Split);
       const child = new Container(ContainerType.Window);
       parent.addChild(child);
       parent.removeChild(child);
       expect(parent.children.length).toBe(0);
       expect(child.parent).toBeNull();
     });

     it("should set layout", () => {
       const c = new Container(ContainerType.Split);
       c.setLayout(Layout.SplitH);
       expect(c.layout).toBe(Layout.SplitH);
       c.setLayout(Layout.SplitV);
       expect(c.layout).toBe(Layout.SplitV);
     });

     it("should track focus state", () => {
       const c = new Container(ContainerType.Window);
       expect(c.focused).toBe(false);
       c.focused = true;
       expect(c.focused).toBe(true);
     });

     it("should find focused child", () => {
       const parent = new Container(ContainerType.Split);
       const a = new Container(ContainerType.Window);
       const b = new Container(ContainerType.Window);
       parent.addChild(a);
       parent.addChild(b);
       b.focused = true;
       expect(parent.focusedChild()).toBe(b);
     });

     it("should return null when no child is focused", () => {
       const parent = new Container(ContainerType.Split);
       const a = new Container(ContainerType.Window);
       parent.addChild(a);
       expect(parent.focusedChild()).toBeNull();
     });

     it("should serialize to JSON", () => {
       const c = new Container(ContainerType.Split);
       c.setLayout(Layout.SplitH);
       c.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       const json = c.toJSON();
       expect(json.id).toBe(c.id);
       expect(json.type).toBe(ContainerType.Split);
       expect(json.layout).toBe(Layout.SplitH);
       expect(json.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
       expect(json.children).toEqual([]);
     });

     it("should serialize children recursively", () => {
       const parent = new Container(ContainerType.Split);
       const child = new Container(ContainerType.Window);
       parent.addChild(child);
       const json = parent.toJSON();
       expect(json.children.length).toBe(1);
       expect(json.children[0].id).toBe(child.id);
     });

     it("should manage marks", () => {
       const c = new Container(ContainerType.Window);
       c.marks.add("term");
       c.marks.add("main");
       expect(c.marks.has("term")).toBe(true);
       expect(c.marks.size).toBe(2);
     });
   });
   ```

2. Run the test to verify it fails:
   ```bash
   npm run build && npm test
   # Expected: failures (module not found)
   ```

3. Create `src/tree/types.ts`:
   ```typescript
   export enum ContainerType {
     Root = "root",
     Output = "output",
     Workspace = "workspace",
     Split = "split",
     Window = "window",
   }

   export enum Layout {
     SplitH = "splith",
     SplitV = "splitv",
     Stacking = "stacking",
     Tabbed = "tabbed",
   }

   export interface Rect {
     x: number;
     y: number;
     width: number;
     height: number;
   }

   export interface ContainerJSON {
     id: string;
     type: ContainerType;
     layout: Layout | null;
     rect: Rect;
     focused: boolean;
     marks: string[];
     proportion: number;
     children: ContainerJSON[];
   }
   ```

4. Create `src/tree/container.ts`:
   ```typescript
   import { ContainerType, Layout, Rect, ContainerJSON } from "./types.js";

   let nextId = 1;

   export { ContainerType, Layout };
   export type { Rect };

   export class Container {
     readonly id: string;
     readonly type: ContainerType;
     parent: Container | null = null;
     children: Container[] = [];
     layout: Layout | null = null;
     rect: Rect = { x: 0, y: 0, width: 0, height: 0 };
     focused = false;
     proportion = 1.0;
     marks: Set<string> = new Set();

     constructor(type: ContainerType) {
       this.id = `con_${nextId++}`;
       this.type = type;
     }

     addChild(child: Container, index?: number): void {
       if (child.parent) {
         child.parent.removeChild(child);
       }
       child.parent = this;
       if (index !== undefined) {
         this.children.splice(index, 0, child);
       } else {
         this.children.push(child);
       }
     }

     removeChild(child: Container): void {
       const idx = this.children.indexOf(child);
       if (idx !== -1) {
         this.children.splice(idx, 1);
         child.parent = null;
       }
     }

     setLayout(layout: Layout): void {
       this.layout = layout;
     }

     focusedChild(): Container | null {
       return this.children.find((c) => c.focused) ?? null;
     }

     findByMark(mark: string): Container | null {
       if (this.marks.has(mark)) return this;
       for (const child of this.children) {
         const found = child.findByMark(mark);
         if (found) return found;
       }
       return null;
     }

     toJSON(): ContainerJSON {
       return {
         id: this.id,
         type: this.type,
         layout: this.layout,
         rect: { ...this.rect },
         focused: this.focused,
         marks: [...this.marks],
         proportion: this.proportion,
         children: this.children.map((c) => c.toJSON()),
       };
     }
   }
   ```

5. Run tests to verify they pass:
   ```bash
   npm run build && npm test
   # Expected: all tests pass
   ```

6. Commit:
   ```bash
   git add -A && git commit -m "feat: add Container base class with tree operations"
   ```

---

## Task 2: RootContainer & OutputContainer

### Files

- **Create** `src/tree/root-container.ts`
- **Create** `src/tree/output-container.ts`
- **Create** `tests/unit/root-container.test.js`
- **Create** `tests/unit/output-container.test.js`

### Steps

1. Write the failing test `tests/unit/root-container.test.js`:
   ```javascript
   const { RootContainer } = await import("../../dist/tree/root-container.js");
   const { OutputContainer } = await import("../../dist/tree/output-container.js");

   describe("RootContainer", () => {
     it("should create with type root", () => {
       const root = new RootContainer();
       expect(root.type).toBe("root");
       expect(root.children).toEqual([]);
     });

     it("should add and retrieve outputs", () => {
       const root = new RootContainer();
       const output = new OutputContainer(0, { x: 0, y: 0, width: 1920, height: 1080 });
       root.addOutput(output);
       expect(root.children.length).toBe(1);
       expect(root.getOutput(0)).toBe(output);
     });

     it("should return null for unknown monitor index", () => {
       const root = new RootContainer();
       expect(root.getOutput(5)).toBeNull();
     });

     it("should serialize with type root", () => {
       const root = new RootContainer();
       const json = root.toJSON();
       expect(json.type).toBe("root");
     });
   });
   ```

2. Write the failing test `tests/unit/output-container.test.js`:
   ```javascript
   const { OutputContainer } = await import("../../dist/tree/output-container.js");

   describe("OutputContainer", () => {
     it("should create with monitor index and work area", () => {
       const workArea = { x: 0, y: 32, width: 1920, height: 1048 };
       const output = new OutputContainer(0, workArea);
       expect(output.type).toBe("output");
       expect(output.monitorIndex).toBe(0);
       expect(output.workArea).toEqual(workArea);
       expect(output.rect).toEqual(workArea);
     });

     it("should update work area and rect together", () => {
       const output = new OutputContainer(0, { x: 0, y: 32, width: 1920, height: 1048 });
       const newArea = { x: 0, y: 32, width: 2560, height: 1408 };
       output.updateWorkArea(newArea);
       expect(output.workArea).toEqual(newArea);
       expect(output.rect).toEqual(newArea);
     });

     it("should serialize with monitorIndex", () => {
       const output = new OutputContainer(1, { x: 1920, y: 0, width: 1920, height: 1080 });
       const json = output.toJSON();
       expect(json.type).toBe("output");
       expect(json.monitorIndex).toBe(1);
       expect(json.workArea).toEqual({ x: 1920, y: 0, width: 1920, height: 1080 });
     });
   });
   ```

3. Run to verify failures:
   ```bash
   npm run build && npm test
   # Expected: module not found failures
   ```

4. Create `src/tree/root-container.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { ContainerType } from "./types.js";
   import type { OutputContainer } from "./output-container.js";

   export class RootContainer extends Container {
     constructor() {
       super(ContainerType.Root);
     }

     addOutput(output: OutputContainer): void {
       this.addChild(output);
     }

     getOutput(monitorIndex: number): OutputContainer | null {
       return (
         (this.children.find(
           (c) => (c as OutputContainer).monitorIndex === monitorIndex
         ) as OutputContainer) ?? null
       );
     }
   }
   ```

5. Create `src/tree/output-container.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { ContainerType, Rect } from "./types.js";

   export class OutputContainer extends Container {
     monitorIndex: number;
     workArea: Rect;

     constructor(monitorIndex: number, workArea: Rect) {
       super(ContainerType.Output);
       this.monitorIndex = monitorIndex;
       this.workArea = { ...workArea };
       this.rect = { ...workArea };
     }

     updateWorkArea(workArea: Rect): void {
       this.workArea = { ...workArea };
       this.rect = { ...workArea };
     }

     override toJSON() {
       return {
         ...super.toJSON(),
         monitorIndex: this.monitorIndex,
         workArea: { ...this.workArea },
       };
     }
   }
   ```

6. Run tests to verify pass:
   ```bash
   npm run build && npm test
   # Expected: all tests pass
   ```

7. Commit:
   ```bash
   git add -A && git commit -m "feat: add RootContainer and OutputContainer"
   ```

---

## Task 3: WorkspaceContainer

### Files

- **Create** `src/tree/workspace-container.ts`
- **Create** `tests/unit/workspace-container.test.js`

### Steps

1. Write the failing test `tests/unit/workspace-container.test.js`:
   ```javascript
   const { WorkspaceContainer } = await import("../../dist/tree/workspace-container.js");

   describe("WorkspaceContainer", () => {
     it("should create with name and number", () => {
       const ws = new WorkspaceContainer("1", 0);
       expect(ws.type).toBe("workspace");
       expect(ws.name).toBe("1");
       expect(ws.number).toBe(0);
       expect(ws.visible).toBe(false);
       expect(ws.urgent).toBe(false);
     });

     it("should track visibility", () => {
       const ws = new WorkspaceContainer("1", 0);
       ws.visible = true;
       expect(ws.visible).toBe(true);
     });

     it("should track urgency", () => {
       const ws = new WorkspaceContainer("1", 0);
       ws.urgent = true;
       expect(ws.urgent).toBe(true);
     });

     it("should count tiled windows (excluding floating)", () => {
       const { WindowContainer } = await import("../../dist/tree/window-container.js");
       const { SplitContainer } = await import("../../dist/tree/split-container.js");
       const ws = new WorkspaceContainer("1", 0);
       ws.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       const split = new SplitContainer();
       ws.addChild(split);
       const win = new WindowContainer(null, 1, "app", "title");
       split.addChild(win);
       const floatWin = new WindowContainer(null, 2, "app2", "title2");
       floatWin.floating = true;
       ws.addFloatingWindow(floatWin);
       expect(ws.tiledWindowCount()).toBe(1);
     });

     it("should serialize with workspace properties", () => {
       const ws = new WorkspaceContainer("dev", 2);
       ws.visible = true;
       const json = ws.toJSON();
       expect(json.type).toBe("workspace");
       expect(json.name).toBe("dev");
       expect(json.number).toBe(2);
       expect(json.visible).toBe(true);
       expect(json.urgent).toBe(false);
     });
   });
   ```
   Note: the floating window test depends on Task 5/6 — it may need to be deferred or use stubs. Write it now as a placeholder; mark it `xit` if WindowContainer doesn't exist yet.

2. Run to verify failures:
   ```bash
   npm run build && npm test
   ```

3. Create `src/tree/workspace-container.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { ContainerType } from "./types.js";
   import type { WindowContainer } from "./window-container.js";

   export class WorkspaceContainer extends Container {
     name: string;
     number: number;
     visible = false;
     urgent = false;
     private floatingWindows: WindowContainer[] = [];

     constructor(name: string, number: number) {
       super(ContainerType.Workspace);
       this.name = name;
       this.number = number;
     }

     addFloatingWindow(win: WindowContainer): void {
       win.floating = true;
       this.floatingWindows.push(win);
       win.parent = this;
     }

     removeFloatingWindow(win: WindowContainer): void {
       const idx = this.floatingWindows.indexOf(win);
       if (idx !== -1) {
         this.floatingWindows.splice(idx, 1);
         win.parent = null;
       }
     }

     getFloatingWindows(): readonly WindowContainer[] {
       return this.floatingWindows;
     }

     tiledWindowCount(): number {
       return this.countTiledWindows(this);
     }

     private countTiledWindows(container: Container): number {
       let count = 0;
       for (const child of container.children) {
         if (child.type === ContainerType.Window) {
           count++;
         } else {
           count += this.countTiledWindows(child);
         }
       }
       return count;
     }

     override toJSON() {
       return {
         ...super.toJSON(),
         name: this.name,
         number: this.number,
         visible: this.visible,
         urgent: this.urgent,
         floatingWindows: this.floatingWindows.map((w) => w.toJSON()),
       };
     }
   }
   ```

4. Run tests (the floating test may be `xit` until Task 5):
   ```bash
   npm run build && npm test
   ```

5. Commit:
   ```bash
   git add -A && git commit -m "feat: add WorkspaceContainer with floating window tracking"
   ```

---

## Task 4: SplitContainer & Reflow Engine

### Files

- **Create** `src/tree/split-container.ts`
- **Create** `src/tree/reflow.ts`
- **Create** `tests/unit/split-container.test.js`
- **Create** `tests/unit/reflow.test.js`

### Steps

1. Write `tests/unit/split-container.test.js`:
   ```javascript
   const { SplitContainer } = await import("../../dist/tree/split-container.js");
   const { Container } = await import("../../dist/tree/container.js");
   const { ContainerType, Layout } = await import("../../dist/tree/types.js");

   describe("SplitContainer", () => {
     it("should default to splith layout", () => {
       const split = new SplitContainer();
       expect(split.type).toBe("split");
       expect(split.layout).toBe(Layout.SplitH);
     });

     it("should accept a layout parameter", () => {
       const split = new SplitContainer(Layout.SplitV);
       expect(split.layout).toBe(Layout.SplitV);
     });

     it("should toggle between splith and splitv", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.toggleLayout();
       expect(split.layout).toBe(Layout.SplitV);
       split.toggleLayout();
       expect(split.layout).toBe(Layout.SplitH);
     });
   });
   ```

2. Write `tests/unit/reflow.test.js`:
   ```javascript
   const { reflow } = await import("../../dist/tree/reflow.js");
   const { SplitContainer } = await import("../../dist/tree/split-container.js");
   const { Container } = await import("../../dist/tree/container.js");
   const { ContainerType, Layout } = await import("../../dist/tree/types.js");

   function makeWindow() {
     return new Container(ContainerType.Window);
   }

   describe("reflow", () => {
     it("should give a single child the full rect", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       const win = makeWindow();
       split.addChild(win);
       reflow(split);
       expect(win.rect).toEqual({ x: 0, y: 0, width: 1920, height: 1080 });
     });

     it("should split horizontally with equal proportions", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       const a = makeWindow();
       const b = makeWindow();
       split.addChild(a);
       split.addChild(b);
       reflow(split);
       expect(a.rect).toEqual({ x: 0, y: 0, width: 960, height: 1080 });
       expect(b.rect).toEqual({ x: 960, y: 0, width: 960, height: 1080 });
     });

     it("should split vertically with equal proportions", () => {
       const split = new SplitContainer(Layout.SplitV);
       split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       const a = makeWindow();
       const b = makeWindow();
       split.addChild(a);
       split.addChild(b);
       reflow(split);
       expect(a.rect).toEqual({ x: 0, y: 0, width: 1920, height: 540 });
       expect(b.rect).toEqual({ x: 0, y: 540, width: 1920, height: 540 });
     });

     it("should respect custom proportions", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 1000, height: 500 };
       const a = makeWindow();
       const b = makeWindow();
       a.proportion = 2;
       b.proportion = 1;
       split.addChild(a);
       split.addChild(b);
       reflow(split);
       // 2/(2+1) = 666.67, rounded: 667 and 333
       expect(a.rect.width + b.rect.width).toBe(1000);
       expect(a.rect.width).toBeGreaterThan(b.rect.width);
     });

     it("should handle three children horizontally", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 900, height: 600 };
       const a = makeWindow();
       const b = makeWindow();
       const c = makeWindow();
       split.addChild(a);
       split.addChild(b);
       split.addChild(c);
       reflow(split);
       expect(a.rect).toEqual({ x: 0, y: 0, width: 300, height: 600 });
       expect(b.rect).toEqual({ x: 300, y: 0, width: 300, height: 600 });
       expect(c.rect).toEqual({ x: 600, y: 0, width: 300, height: 600 });
     });

     it("should reflow nested splits recursively", () => {
       const outer = new SplitContainer(Layout.SplitH);
       outer.rect = { x: 0, y: 0, width: 1000, height: 500 };
       const left = makeWindow();
       const right = new SplitContainer(Layout.SplitV);
       outer.addChild(left);
       outer.addChild(right);
       const topRight = makeWindow();
       const bottomRight = makeWindow();
       right.addChild(topRight);
       right.addChild(bottomRight);
       reflow(outer);
       expect(left.rect).toEqual({ x: 0, y: 0, width: 500, height: 500 });
       expect(right.rect).toEqual({ x: 500, y: 0, width: 500, height: 500 });
       expect(topRight.rect).toEqual({ x: 500, y: 0, width: 500, height: 250 });
       expect(bottomRight.rect).toEqual({ x: 500, y: 250, width: 500, height: 250 });
     });

     it("should handle empty container", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 1920, height: 1080 };
       reflow(split);
       // No error, no children to reflow
     });

     it("should apply gaps when provided", () => {
       const split = new SplitContainer(Layout.SplitH);
       split.rect = { x: 0, y: 0, width: 1000, height: 500 };
       const a = makeWindow();
       const b = makeWindow();
       split.addChild(a);
       split.addChild(b);
       reflow(split, { inner: 10 });
       // Each window should be inset by half the gap
       expect(a.rect.width).toBe(495);
       expect(b.rect.width).toBe(495);
       expect(b.rect.x).toBe(505);
     });
   });
   ```

3. Run to verify failures:
   ```bash
   npm run build && npm test
   ```

4. Create `src/tree/split-container.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { ContainerType, Layout } from "./types.js";

   export class SplitContainer extends Container {
     constructor(layout: Layout = Layout.SplitH) {
       super(ContainerType.Split);
       this.layout = layout;
     }

     toggleLayout(): void {
       this.layout =
         this.layout === Layout.SplitH ? Layout.SplitV : Layout.SplitH;
     }
   }
   ```

5. Create `src/tree/reflow.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { Layout, Rect } from "./types.js";

   export interface GapConfig {
     inner?: number;
     outer?: number;
   }

   export function reflow(container: Container, gaps?: GapConfig): void {
     const { children, layout, rect } = container;
     if (children.length === 0) return;

     const innerGap = gaps?.inner ?? 0;
     const isHorizontal = layout === Layout.SplitH;
     const totalSize = isHorizontal ? rect.width : rect.height;
     const totalGaps = innerGap * (children.length - 1);
     const available = totalSize - totalGaps;

     const totalProportion = children.reduce(
       (sum, c) => sum + c.proportion,
       0
     );

     let offset = isHorizontal ? rect.x : rect.y;

     for (let i = 0; i < children.length; i++) {
       const child = children[i];
       const ratio = child.proportion / totalProportion;
       const size = Math.round(available * ratio);

       if (isHorizontal) {
         child.rect = {
           x: offset,
           y: rect.y,
           width: size,
           height: rect.height,
         };
       } else {
         child.rect = {
           x: rect.x,
           y: offset,
           width: rect.width,
           height: size,
         };
       }

       offset += size + innerGap;

       // Recursively reflow children that have their own children
       if (child.children.length > 0) {
         reflow(child, gaps);
       }
     }

     // Fix rounding errors on the last child
     const last = children[children.length - 1];
     if (isHorizontal) {
       last.rect.width = rect.x + rect.width - last.rect.x;
     } else {
       last.rect.height = rect.y + rect.height - last.rect.y;
     }
   }
   ```

6. Run tests:
   ```bash
   npm run build && npm test
   # Expected: all pass
   ```

7. Commit:
   ```bash
   git add -A && git commit -m "feat: add SplitContainer and proportion-based reflow engine"
   ```

---

## Task 5: WindowContainer

### Files

- **Create** `src/tree/window-container.ts`
- **Create** `tests/unit/window-container.test.js`

### Steps

1. Write `tests/unit/window-container.test.js`:
   ```javascript
   const { WindowContainer } = await import("../../dist/tree/window-container.js");

   describe("WindowContainer", () => {
     it("should create with window metadata", () => {
       const win = new WindowContainer(null, 42, "org.gnome.Terminal", "Terminal");
       expect(win.type).toBe("window");
       expect(win.windowId).toBe(42);
       expect(win.appId).toBe("org.gnome.Terminal");
       expect(win.title).toBe("Terminal");
       expect(win.floating).toBe(false);
       expect(win.fullscreen).toBe(false);
     });

     it("should toggle floating state", () => {
       const win = new WindowContainer(null, 1, "app", "title");
       expect(win.floating).toBe(false);
       win.floating = true;
       expect(win.floating).toBe(true);
     });

     it("should toggle fullscreen state", () => {
       const win = new WindowContainer(null, 1, "app", "title");
       win.fullscreen = true;
       expect(win.fullscreen).toBe(true);
     });

     it("should serialize with window properties", () => {
       const win = new WindowContainer(null, 99, "firefox", "Mozilla Firefox");
       win.floating = true;
       const json = win.toJSON();
       expect(json.type).toBe("window");
       expect(json.windowId).toBe(99);
       expect(json.appId).toBe("firefox");
       expect(json.title).toBe("Mozilla Firefox");
       expect(json.floating).toBe(true);
     });
   });
   ```

2. Run to verify failures:
   ```bash
   npm run build && npm test
   ```

3. Create `src/tree/window-container.ts`:
   ```typescript
   import { Container } from "./container.js";
   import { ContainerType } from "./types.js";

   export class WindowContainer extends Container {
     /** The Meta.Window reference — null in unit tests */
     window: unknown;
     windowId: number;
     appId: string;
     title: string;
     floating = false;
     fullscreen = false;

     constructor(
       window: unknown,
       windowId: number,
       appId: string,
       title: string
     ) {
       super(ContainerType.Window);
       this.window = window;
       this.windowId = windowId;
       this.appId = appId;
       this.title = title;
     }

     override toJSON() {
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
   ```

4. Run tests:
   ```bash
   npm run build && npm test
   # Expected: all pass
   ```

5. Now enable the `xit` test from Task 3 (workspace floating window count) and run again:
   ```bash
   npm run build && npm test
   # Expected: all pass including the workspace floating test
   ```

6. Commit:
   ```bash
   git add -A && git commit -m "feat: add WindowContainer with floating/fullscreen state"
   ```

---

## Task 6: Floating Layer

### Files

- **Create** `src/tree/floating-layer.ts`
- **Create** `tests/unit/floating-layer.test.js`

### Steps

1. Write `tests/unit/floating-layer.test.js`:
   ```javascript
   const { FloatingLayer } = await import("../../dist/tree/floating-layer.js");
   const { WindowContainer } = await import("../../dist/tree/window-container.js");

   describe("FloatingLayer", () => {
     let layer;

     beforeEach(() => {
       layer = new FloatingLayer();
     });

     it("should start empty", () => {
       expect(layer.windows).toEqual([]);
       expect(layer.focusedWindow()).toBeNull();
     });

     it("should add a window and mark it floating", () => {
       const win = new WindowContainer(null, 1, "app", "title");
       layer.addWindow(win);
       expect(layer.windows.length).toBe(1);
       expect(win.floating).toBe(true);
     });

     it("should remove a window", () => {
       const win = new WindowContainer(null, 1, "app", "title");
       layer.addWindow(win);
       layer.removeWindow(win);
       expect(layer.windows.length).toBe(0);
     });

     it("should maintain z-order (last added = top)", () => {
       const a = new WindowContainer(null, 1, "a", "A");
       const b = new WindowContainer(null, 2, "b", "B");
       layer.addWindow(a);
       layer.addWindow(b);
       expect(layer.topWindow()).toBe(b);
     });

     it("should raise a window to the top", () => {
       const a = new WindowContainer(null, 1, "a", "A");
       const b = new WindowContainer(null, 2, "b", "B");
       layer.addWindow(a);
       layer.addWindow(b);
       layer.raise(a);
       expect(layer.topWindow()).toBe(a);
     });

     it("should lower a window to the bottom", () => {
       const a = new WindowContainer(null, 1, "a", "A");
       const b = new WindowContainer(null, 2, "b", "B");
       const c = new WindowContainer(null, 3, "c", "C");
       layer.addWindow(a);
       layer.addWindow(b);
       layer.addWindow(c);
       layer.lower(c);
       expect(layer.windows[0]).toBe(c);
       expect(layer.topWindow()).toBe(b);
     });

     it("should track focused floating window", () => {
       const a = new WindowContainer(null, 1, "a", "A");
       const b = new WindowContainer(null, 2, "b", "B");
       layer.addWindow(a);
       layer.addWindow(b);
       layer.focus(b);
       expect(layer.focusedWindow()).toBe(b);
       expect(b.focused).toBe(true);
       expect(a.focused).toBe(false);
     });

     it("should cycle focus among floating windows", () => {
       const a = new WindowContainer(null, 1, "a", "A");
       const b = new WindowContainer(null, 2, "b", "B");
       const c = new WindowContainer(null, 3, "c", "C");
       layer.addWindow(a);
       layer.addWindow(b);
       layer.addWindow(c);
       layer.focus(a);
       expect(layer.focusNext()).toBe(b);
       expect(layer.focusNext()).toBe(c);
       expect(layer.focusNext()).toBe(a); // wraps around
     });
   });
   ```

2. Run to verify failures:
   ```bash
   npm run build && npm test
   ```

3. Create `src/tree/floating-layer.ts`:
   ```typescript
   import { WindowContainer } from "./window-container.js";

   export class FloatingLayer {
     /** Z-ordered: index 0 = bottom, last = top */
     windows: WindowContainer[] = [];

     addWindow(win: WindowContainer): void {
       win.floating = true;
       this.windows.push(win);
     }

     removeWindow(win: WindowContainer): void {
       const idx = this.windows.indexOf(win);
       if (idx !== -1) {
         this.windows.splice(idx, 1);
       }
     }

     topWindow(): WindowContainer | null {
       return this.windows.length > 0
         ? this.windows[this.windows.length - 1]
         : null;
     }

     raise(win: WindowContainer): void {
       this.removeWindow(win);
       this.windows.push(win);
     }

     lower(win: WindowContainer): void {
       this.removeWindow(win);
       this.windows.unshift(win);
     }

     focus(win: WindowContainer): void {
       for (const w of this.windows) {
         w.focused = false;
       }
       win.focused = true;
     }

     focusedWindow(): WindowContainer | null {
       return this.windows.find((w) => w.focused) ?? null;
     }

     focusNext(): WindowContainer | null {
       if (this.windows.length === 0) return null;
       const currentIdx = this.windows.findIndex((w) => w.focused);
       const nextIdx =
         currentIdx === -1 ? 0 : (currentIdx + 1) % this.windows.length;
       this.focus(this.windows[nextIdx]);
       return this.windows[nextIdx];
     }

     toJSON() {
       return this.windows.map((w) => w.toJSON());
     }
   }
   ```

4. Run tests:
   ```bash
   npm run build && npm test
   ```

5. Commit:
   ```bash
   git add -A && git commit -m "feat: add FloatingLayer with z-order and focus cycling"
   ```

---

## Task 7: Tree Builder Utility & Barrel Export

### Files

- **Create** `src/tree/tree-builder.ts`
- **Create** `src/tree/index.ts`
- **Create** `tests/unit/tree-builder.test.js`

### Steps

1. Write `tests/unit/tree-builder.test.js`:
   ```javascript
   const { TreeBuilder } = await import("../../dist/tree/tree-builder.js");

   describe("TreeBuilder", () => {
     it("should build a tree for a single monitor", () => {
       const monitors = [
         { index: 0, workArea: { x: 0, y: 32, width: 1920, height: 1048 } },
       ];
       const tree = TreeBuilder.build(monitors);
       expect(tree.type).toBe("root");
       expect(tree.children.length).toBe(1);
       const output = tree.children[0];
       expect(output.type).toBe("output");
       expect(output.monitorIndex).toBe(0);
       expect(output.children.length).toBe(1);
       const workspace = output.children[0];
       expect(workspace.type).toBe("workspace");
       expect(workspace.children.length).toBe(1);
       const split = workspace.children[0];
       expect(split.type).toBe("split");
       expect(split.layout).toBe("splith");
     });

     it("should build a tree for multiple monitors", () => {
       const monitors = [
         { index: 0, workArea: { x: 0, y: 32, width: 1920, height: 1048 } },
         { index: 1, workArea: { x: 1920, y: 0, width: 2560, height: 1440 } },
       ];
       const tree = TreeBuilder.build(monitors);
       expect(tree.children.length).toBe(2);
       expect(tree.children[0].monitorIndex).toBe(0);
       expect(tree.children[1].monitorIndex).toBe(1);
     });

     it("should set correct rects through the tree", () => {
       const monitors = [
         { index: 0, workArea: { x: 0, y: 32, width: 1920, height: 1048 } },
       ];
       const tree = TreeBuilder.build(monitors);
       const split = tree.children[0].children[0].children[0];
       expect(split.rect).toEqual({ x: 0, y: 32, width: 1920, height: 1048 });
     });
   });
   ```

2. Run to verify failures:
   ```bash
   npm run build && npm test
   ```

3. Create `src/tree/tree-builder.ts`:
   ```typescript
   import { RootContainer } from "./root-container.js";
   import { OutputContainer } from "./output-container.js";
   import { WorkspaceContainer } from "./workspace-container.js";
   import { SplitContainer } from "./split-container.js";
   import type { Rect } from "./types.js";

   export interface MonitorInfo {
     index: number;
     workArea: Rect;
   }

   export class TreeBuilder {
     static build(monitors: MonitorInfo[]): RootContainer {
       const root = new RootContainer();

       for (const monitor of monitors) {
         const output = new OutputContainer(
           monitor.index,
           monitor.workArea
         );

         const workspace = new WorkspaceContainer(
           String(monitor.index + 1),
           monitor.index
         );
         workspace.visible = true;
         workspace.rect = { ...monitor.workArea };

         const split = new SplitContainer();
         split.rect = { ...monitor.workArea };

         workspace.addChild(split);
         output.addChild(workspace);
         root.addOutput(output);
       }

       return root;
     }
   }
   ```

4. Create `src/tree/index.ts`:
   ```typescript
   export { Container } from "./container.js";
   export { ContainerType, Layout } from "./types.js";
   export type { Rect, ContainerJSON } from "./types.js";
   export { RootContainer } from "./root-container.js";
   export { OutputContainer } from "./output-container.js";
   export { WorkspaceContainer } from "./workspace-container.js";
   export { SplitContainer } from "./split-container.js";
   export { WindowContainer } from "./window-container.js";
   export { FloatingLayer } from "./floating-layer.js";
   export { TreeBuilder } from "./tree-builder.js";
   export type { MonitorInfo } from "./tree-builder.js";
   export { reflow } from "./reflow.js";
   export type { GapConfig } from "./reflow.js";
   ```

5. Run tests:
   ```bash
   npm run build && npm test
   ```

6. Commit:
   ```bash
   git add -A && git commit -m "feat: add TreeBuilder utility and barrel export"
   ```

---

## Task 8: Window Tracker

### Files

- **Create** `src/window-tracker.ts`
- **Modify** `src/tree/workspace-container.ts` — integrate FloatingLayer

### Steps

1. This task creates the GNOME Shell integration layer. It cannot be unit tested with Jasmine (depends on `Meta.Window`, `global.display` signals, etc.). Instead, this code will be verified via Looking Glass in the nested shell (Task 10).

2. Create `src/window-tracker.ts`:
   ```typescript
   import Meta from "gi://Meta";
   import Shell from "gi://Shell";
   import * as Main from "resource:///org/gnome/shell/ui/main.js";

   import { RootContainer } from "./tree/root-container.js";
   import { WorkspaceContainer } from "./tree/workspace-container.js";
   import { SplitContainer } from "./tree/split-container.js";
   import { WindowContainer } from "./tree/window-container.js";
   import { reflow } from "./tree/reflow.js";
   import type { Rect } from "./tree/types.js";

   export class WindowTracker {
     private root: RootContainer;
     private signalIds: number[] = [];
     private windowMap: Map<Meta.Window, WindowContainer> = new Map();

     constructor(root: RootContainer) {
       this.root = root;
     }

     enable(): void {
       const display = global.display;

       this.signalIds.push(
         display.connect("window-created", (_display: unknown, window: Meta.Window) => {
           this.onWindowCreated(window);
         })
       );

       // Track existing windows
       const windowActors = global.get_window_actors();
       for (const actor of windowActors) {
         const window = actor.get_meta_window();
         if (this.shouldTrack(window)) {
           this.onWindowCreated(window);
         }
       }
     }

     disable(): void {
       const display = global.display;
       for (const id of this.signalIds) {
         display.disconnect(id);
       }
       this.signalIds = [];
       this.windowMap.clear();
     }

     private shouldTrack(window: Meta.Window): boolean {
       const type = window.get_window_type();
       return (
         type === Meta.WindowType.NORMAL ||
         type === Meta.WindowType.DIALOG
       );
     }

     private onWindowCreated(window: Meta.Window): void {
       if (!this.shouldTrack(window)) return;
       if (this.windowMap.has(window)) return;

       // Wait for the window to be ready
       const id = window.connect("first-frame", () => {
         window.disconnect(id);
         this.trackWindow(window);
       });
     }

     private trackWindow(window: Meta.Window): void {
       const app = Shell.WindowTracker.get_default().get_window_app(window);
       const appId = app ? app.get_id() : "unknown";
       const title = window.get_title() ?? "untitled";
       const windowId = window.get_stable_sequence();

       const winContainer = new WindowContainer(
         window,
         windowId,
         appId,
         title
       );

       this.windowMap.set(window, winContainer);

       // Find the active workspace's split container
       const workspace = this.getActiveWorkspace();
       if (!workspace) return;

       // Insert into the first (root) split container of the workspace
       const split = workspace.children[0] as SplitContainer;
       if (split) {
         split.addChild(winContainer);
         reflow(split);
         this.applyGeometry(split);
       }

       // Listen for window close
       window.connect("unmanaging", () => {
         this.onWindowRemoved(window);
       });

       // Listen for title changes
       window.connect("notify::title", () => {
         winContainer.title = window.get_title() ?? "untitled";
       });

       console.log(
         `[tessera] tracked window: ${appId} "${title}" (id=${windowId})`
       );
     }

     private onWindowRemoved(window: Meta.Window): void {
       const winContainer = this.windowMap.get(window);
       if (!winContainer) return;

       const parent = winContainer.parent;
       if (parent) {
         parent.removeChild(winContainer);
         if (parent.children.length > 0) {
           reflow(parent);
           this.applyGeometry(parent);
         }
       }

       this.windowMap.delete(window);
       console.log(
         `[tessera] untracked window: ${winContainer.appId} "${winContainer.title}"`
       );
     }

     private getActiveWorkspace(): WorkspaceContainer | null {
       // Use primary monitor (index 0) for now
       const output = this.root.getOutput(0);
       if (!output) return null;
       // Return the first visible workspace
       return (
         (output.children.find(
           (c) => (c as WorkspaceContainer).visible
         ) as WorkspaceContainer) ?? null
       );
     }

     private applyGeometry(container: { children: { rect: Rect; window?: unknown }[] } & { rect: Rect }): void {
       for (const child of container.children) {
         if ("window" in child && child.window) {
           const win = child.window as Meta.Window;
           const { x, y, width, height } = child.rect;
           win.move_resize_frame(false, x, y, width, height);
         }
         if ("children" in child && (child as any).children.length > 0) {
           this.applyGeometry(child as any);
         }
       }
     }

     getWindowContainer(window: Meta.Window): WindowContainer | undefined {
       return this.windowMap.get(window);
     }

     get trackedWindowCount(): number {
       return this.windowMap.size;
     }
   }
   ```

3. Commit:
   ```bash
   git add -A && git commit -m "feat: add WindowTracker for GNOME Shell window signal integration"
   ```

---

## Task 9: Extension Lifecycle

### Files

- **Create** `src/extension.ts`

### Steps

1. Create `src/extension.ts`:
   ```typescript
   import { Extension } from "resource:///org/gnome/shell/extensions/extension.js";
   import * as Main from "resource:///org/gnome/shell/ui/main.js";
   import Meta from "gi://Meta";

   import { TreeBuilder } from "./tree/tree-builder.js";
   import { RootContainer } from "./tree/root-container.js";
   import { WindowTracker } from "./window-tracker.js";
   import type { MonitorInfo } from "./tree/tree-builder.js";

   export default class TesseraExtension extends Extension {
     private root: RootContainer | null = null;
     private windowTracker: WindowTracker | null = null;

     enable(): void {
       console.log("[tessera] enabling extension");

       // Build initial tree from monitors
       const monitors = this.getMonitors();
       this.root = TreeBuilder.build(monitors);

       // Start window tracking
       this.windowTracker = new WindowTracker(this.root);
       this.windowTracker.enable();

       // Expose for Looking Glass debugging
       (globalThis as any).__tessera = {
         root: this.root,
         tracker: this.windowTracker,
         tree: () => JSON.stringify(this.root!.toJSON(), null, 2),
       };

       console.log(
         `[tessera] enabled with ${monitors.length} monitor(s)`
       );
     }

     disable(): void {
       console.log("[tessera] disabling extension");

       if (this.windowTracker) {
         this.windowTracker.disable();
         this.windowTracker = null;
       }

       // TODO: restore original window positions

       this.root = null;
       delete (globalThis as any).__tessera;

       console.log("[tessera] disabled");
     }

     private getMonitors(): MonitorInfo[] {
       const monitors: MonitorInfo[] = [];
       const n = Main.layoutManager.monitors.length;

       for (let i = 0; i < n; i++) {
         const workArea = Main.layoutManager.getWorkAreaForMonitor(i);
         monitors.push({
           index: i,
           workArea: {
             x: workArea.x,
             y: workArea.y,
             width: workArea.width,
             height: workArea.height,
           },
         });
       }

       return monitors;
     }
   }
   ```

2. Verify the project builds cleanly:
   ```bash
   make build
   # Expected: "Build complete: dist/"
   ```

3. Commit:
   ```bash
   git add -A && git commit -m "feat: add extension lifecycle with tree init and window tracking"
   ```

---

## Task 10: Integration Testing in Nested Shell

### Files

No new files — this task verifies everything works end-to-end.

### Steps

1. Build and install:
   ```bash
   make install
   ```

2. Launch nested shell:
   ```bash
   make nested
   ```

3. Enable the extension in the nested session:
   ```bash
   # In the nested shell, open a terminal or use Looking Glass
   gnome-extensions enable tessera@tessera.dev
   ```

4. Open Looking Glass (`Alt+F2` → `lg`) and verify:
   ```javascript
   // Check the tree exists
   __tessera.root.type
   // Expected: "root"

   // Print the tree
   __tessera.tree()
   // Expected: JSON tree with root → output → workspace → split

   // Check monitor info
   __tessera.root.children[0].monitorIndex
   // Expected: 0
   ```

5. Open 2-3 windows (e.g., GNOME Terminal, Files) and verify auto-tiling:
   ```javascript
   // Check tracked windows
   __tessera.tracker.trackedWindowCount
   // Expected: 2 or 3

   // Print updated tree — windows should be children of the split
   __tessera.tree()
   ```

6. Close a window and verify reflow:
   ```javascript
   // Remaining windows should resize to fill the gap
   __tessera.tree()
   ```

7. Check `journalctl` from the host session for log output:
   ```bash
   journalctl --user -f | grep tessera
   # Expected: "[tessera] tracked window: ..." messages
   ```

8. Disable the extension and verify cleanup:
   ```javascript
   // In Looking Glass:
   __tessera.root  // should be accessible
   ```
   ```bash
   gnome-extensions disable tessera@tessera.dev
   ```
   ```javascript
   // In Looking Glass:
   __tessera  // should be undefined
   ```

9. If everything works, commit any final fixes and tag:
   ```bash
   git add -A && git commit -m "chore: phase 1 complete — foundation verified"
   git tag v0.1.0 -m "Phase 1: Container tree, reflow, auto-tiling"
   ```

---

## Verification Checklist

- [ ] `make check` passes (lint + build + tests)
- [ ] Extension loads in nested GNOME Shell without errors
- [ ] Opening a window auto-tiles it into the split container
- [ ] Opening a second window splits the space 50/50
- [ ] Opening a third window splits into thirds
- [ ] Closing a window causes remaining windows to reflow
- [ ] `__tessera.tree()` in Looking Glass shows correct tree structure
- [ ] `journalctl` shows tracked/untracked messages
- [ ] Extension disable cleans up without errors
- [ ] Re-enable after disable works correctly
