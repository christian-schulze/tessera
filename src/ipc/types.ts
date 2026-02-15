export type IpcMethod = "execute" | "tree" | "ping" | "version";

export type ExecuteParams = {
  command: string;
};

export type IpcRequest = {
  id: string;
  method: IpcMethod;
  params?: ExecuteParams;
};

export type IpcResponse = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};
