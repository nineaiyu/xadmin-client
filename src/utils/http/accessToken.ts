import { getRefreshToken, getToken, setToken } from "@/utils/auth";
import { refreshTokenApi } from "@/api/auth";

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
      const res = await refreshTokenApi({ refresh: RefreshToken });
      setToken(res.data);
      return getToken();
    }
  }
}
