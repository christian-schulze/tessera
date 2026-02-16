export type IpcMethod =
  "execute" |
  "tree" |
  "ping" |
  "version" |
  "debug" |
  "config";

export type ExecuteParams = {
  command: string;
};

export type ConfigParams = {
  minTileWidth?: number;
  minTileHeight?: number;
};

export type ConfigResponse = {
  minTileWidth: number;
  minTileHeight: number;
};

export type IpcRequest = {
  id: string;
  method: IpcMethod;
  params?: ExecuteParams | ConfigParams;
};

export type IpcResponse = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};
