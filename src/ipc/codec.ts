import type {
  ConfigParams,
  ExecuteParams,
  IpcMethod,
  IpcRequest,
  IpcResponse,
} from "./types.js";

const methods = new Set<IpcMethod>([
  "execute",
  "tree",
  "ping",
  "version",
  "debug",
  "config",
]);

export const decodeRequest = (payload: string): IpcRequest => {
  const parsed = JSON.parse(payload) as {
    id?: unknown;
    method?: unknown;
    params?: unknown;
  };

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invalid request");
  }

  const { id, method, params } = parsed;

  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Invalid request id");
  }

  if (typeof method !== "string" || !methods.has(method as IpcMethod)) {
    throw new Error("Invalid request method");
  }

  return {
    id,
    method: method as IpcMethod,
    params: params as ExecuteParams | ConfigParams | undefined,
  };
};

export const encodeResponse = (response: IpcResponse): string =>
  JSON.stringify(response);
