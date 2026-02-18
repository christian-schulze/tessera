export interface Binding {
  keys: string[];
  command: string;
  release?: boolean;
}

export interface BindingMode {
  name: string;
  bindings: Binding[];
}
