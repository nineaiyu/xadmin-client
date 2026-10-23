import { getToken } from "@/utils/auth";
import { refreshAccessToken } from "./refreshToken";

/**
 * 取当前可用 accessToken：本地有则直接返回，否则经单飞原语换新后回读。
 *
 * 供 WebSocket 重连等「非 axios 拦截器」链路复用；与请求拦截器共享同一
 * 在途 Promise，避免并发刷新。
 */
export async function getUsedAccessToken() {
  const accessToken = getToken();
  if (accessToken) return accessToken;

  const outcome = await refreshAccessToken();
  // 刷新接口自身异常（网络/5xx）继续向上抛：调用方（WS 重连）按失败处理；
  // 业务码失败（refresh 过期等）不抛，也不写 token，返回空值由调用方重连退避。
  if (!outcome.ok && outcome.error) throw outcome.error;
  return getToken();
}
