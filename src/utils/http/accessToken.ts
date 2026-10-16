import { getRefreshToken, getToken, setToken } from "@/utils/auth";
import { refreshTokenApi } from "@/api/auth";
import { isSuccess } from "@/api/types";

/**
 * 取当前可用 accessToken：本地有则直接返回，否则用 refreshToken 换新后回读。
 *
 * 归置在 utils/http 下（依赖 utils/auth 与 api/auth），供 WebSocket 重连等
 * 「非 axios 拦截器」链路经注入方式复用——不直连 api 层，避免 utils 工具
 * 模块与 store 之间形成顶层静态环。
 */
export async function getUsedAccessToken() {
  const accessToken = getToken();
  if (accessToken) {
    return accessToken;
  } else {
    const RefreshToken = getRefreshToken();
    if (RefreshToken) {
      // 刷新接口自身异常（网络/5xx）继续向上抛：调用方（WS 重连）按失败处理；
      // 业务码失败（refresh 过期等）不抛，但也不写 token——res.data 可能为空，
      // 写入会让 WS 以无效凭证反复重连
      const res = await refreshTokenApi({ refresh: RefreshToken });
      if (isSuccess(res)) {
        setToken(res.data);
      }
      return getToken();
    }
  }
}
