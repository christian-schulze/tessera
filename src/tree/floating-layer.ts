export class FloatingLayer {
  windows: unknown[];
  private focusedIndex: number | null;

  constructor() {
    this.windows = [];
    this.focusedIndex = null;
  }

  add(window: unknown): void {
    this.windows.push(window);
  }

  remove(window: unknown): void {
    const index = this.windows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.windows.splice(index, 1);
    if (this.focusedIndex !== null) {
      if (this.focusedIndex === index) {
        this.focusedIndex = null;
      } else if (this.focusedIndex > index) {
        this.focusedIndex -= 1;
      }
    }
  }

  topWindow(): unknown | null {
    return this.windows.at(-1) ?? null;
  }

  raise(window: unknown): void {
    const index = this.windows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.windows.splice(index, 1);
    this.windows.push(window);
  }

  lower(window: unknown): void {
    const index = this.windows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.windows.splice(index, 1);
    this.windows.unshift(window);
    if (this.focusedIndex !== null) {
      this.focusedIndex += 1;
    }
  }

  focus(window: unknown): void {
    const index = this.windows.indexOf(window);
    if (index === -1) {
      return;
    }

    this.focusedIndex = index;
  }

  focusedWindow(): unknown | null {
    if (this.focusedIndex === null) {
      return null;
    }

    return this.windows[this.focusedIndex] ?? null;
  }

  focusNext(): unknown | null {
    if (this.windows.length === 0) {
      return null;
    }

    if (this.focusedIndex === null) {
      this.focusedIndex = 0;
      return this.windows[0];
    }

    this.focusedIndex = (this.focusedIndex + 1) % this.windows.length;
    return this.windows[this.focusedIndex] ?? null;
  }

  toJSON(): { windows: unknown[] } {
    return { windows: [...this.windows] };
  }
}
