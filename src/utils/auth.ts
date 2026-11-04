import Cookies from "js-cookie";
import type { PureHttpRequestConfig } from "@/utils/http/types";
import { storageLocal } from "@pureadmin/utils";
import { useLoginPageStoreHook } from "@/store/modules/loginPage";
import type { TokenInfo } from "@/api/auth";
import { responsiveStorageNameSpace } from "@/config";
import Storage from "responsive-storage";

export const userKey = "user-info";
const TokenKey = "X-Token";
const RefreshTokenKey = "X-Refresh-Token";
/**
 * 服务端签发的认证承载模式标记 Cookie（JS 可读，非敏感布尔标记）。
 *
 * 登录 / 刷新 / 模拟换签的响应 Set-Cookie 同时下发本标记（值 `cookie` / `header`，
 * **两种模式都下发**——开关回退后旧标记不残留误导新会话），是前端判定「token
 * 在哪」的唯一事实源，不靠猜：缺失（旧版本服务端 / 清理后）一律按 header 模式。
 */
const AuthModeKey = "X-Auth-Mode";

/** 认证承载模式：header = 响应体下发、前端写 JS Cookie；cookie = HttpOnly Cookie */
export type AuthTransport = "header" | "cookie";

/**
 * 通过`multiple-tabs`是否在`cookie`中，判断用户是否已经登录系统，
 * 从而支持多标签页打开已经登录的系统后无需再登录。
 * 浏览器完全关闭后`multiple-tabs`将自动从`cookie`中销毁，
 * 再次打开浏览器需要重新登录系统
 * */
export const multipleTabsKey = "multiple-tabs";

/** 获取`token` */
export function getToken(): string {
  // 此处与`TokenKey`相同，此写法解决初始化时`Cookies`中不存在`TokenKey`报错；
  // 未登录时归一为空串（调用方统一按 falsy 判定）。
  // Cookie 会话模式下 token 在 HttpOnly Cookie 里，此处恒为空串——登录态判定
  // 用 hasSession()，不要用本函数的真伪区分「未登录」
  return Cookies.get(TokenKey) ?? "";
}

export function getRefreshToken() {
  return Cookies.get(RefreshTokenKey);
}

/** 当前认证承载模式（服务端 X-Auth-Mode 标记；缺失按 header 模式，保持现状） */
export function getAuthTransport(): AuthTransport {
  return Cookies.get(AuthModeKey) === "cookie" ? "cookie" : "header";
}

/** 当前会话是否为 HttpOnly Cookie 承载（token 不可被 JS 读取） */
export function isCookieAuthSession(): boolean {
  return getAuthTransport() === "cookie";
}

/**
 * 本机是否存在「可能有效」的登录态（路由守卫 / 跨标签登出判定口径）：
 *
 * - header 模式：multiple-tabs 标记 + 可读 refresh token（既有口径不变）；
 * - cookie 模式：token 不可读（HttpOnly），只看 multiple-tabs 标记；会话真实
 *   有效性由后续 userinfo 请求的 401 兜底（与 header 模式的过期 token 同路）。
 */
export function hasSession(): boolean {
  if (!Cookies.get(multipleTabsKey)) return false;
  return isCookieAuthSession() || Boolean(getRefreshToken());
}

/**
 * 认证 Cookie 是否带 Secure 属性。
 *
 * Secure Cookie 在非安全上下文（http:// 内网地址）下会被浏览器**静默丢弃**，
 * 表现为「登录成功 → 立即未授权」的循环。而页面是否安全上下文只有运行时才知道，
 * 构建期开关答不了这个问题，故默认按 `isSecureContext` 自动判定：
 *
 * - 构建期显式 `VITE_COOKIE_SECURE=false`：强制关闭（内网 HTTP 镜像特供）；
 * - 构建期显式 `VITE_COOKIE_SECURE=true`：强制开启（前端有 TLS 终结反代、
 *   但未传 `X-Forwarded-Proto` 导致 `isSecureContext` 误判为 false 的场景）；
 * - 其余（默认）：按当前页面上下文判定，HTTPS / localhost 自动带上 Secure。
 */
function cookieSecure(): boolean {
  const configured = import.meta.env.VITE_COOKIE_SECURE;
  if (configured === "false") return false;
  if (configured === "true") return true;
  return typeof window !== "undefined" && window.isSecureContext === true;
}

/**
 * 认证 Cookie 统一附带 SameSite/Secure 属性，防跨站自动携带与明文传输。
 * 非安全上下文（HTTP 内网部署）下主动收窄为不带 Secure，避免 token 存不进去。
 */
function cookieSecureOptions() {
  return {
    sameSite: "Lax",
    secure: cookieSecure()
  } as Cookies.CookieAttributes;
}

/**
 * 【双模式登记】access/refresh token 的承载由服务端 `AUTH_COOKIE_HTTPONLY` 开关决定：
 * - header 模式（开关关，默认）：token 在登录/刷新响应体里，本函数照旧写入
 *   JS 可读 Cookie（拼 `Authorization: Bearer` 头鉴权，见 utils/http）——
 *   历史取舍：HttpOnly 对前端代码不可读，无感刷新与刷新期请求排队依赖可读 token；
 * - cookie 模式（开关开）：服务端已在响应 Set-Cookie 下发 HttpOnly 的
 *   X-Token / X-Refresh-Token（响应体已剥离明文），本函数**不写 token Cookie**，
 *   只保留 multiple-tabs 会话标记；请求凭证由浏览器自动携带（withCredentials）。
 * 模式判定不靠猜：响应头的 X-Auth-Mode 标记 Cookie 已先于本函数写入 cookie jar
 * （见 getAuthTransport）。CSP / 净化链 / SameSite=Lax 等缓解两模式都保持不放松。
 */
export function setAccessToken(token: string, expires = 864e3) {
  Cookies.remove(TokenKey);
  return Cookies.set(TokenKey, token, {
    expires: new Date(Date.now() + 1000 * expires),
    ...cookieSecureOptions()
  });
}

export function setRefreshToken(token: string, expires = 864e3) {
  return Cookies.set(RefreshTokenKey, token, {
    expires: new Date(Date.now() + 1000 * expires),
    ...cookieSecureOptions()
  });
}

/**
 * @description 设置`token`以及一些必要信息并采用无感刷新`token`方案
 * 无感刷新：后端返回`accessToken`（访问接口使用的`token`）、`refreshToken`（用于调用刷新`accessToken`的接口时所需的`token`，`refreshToken`的过期时间（比如30天）应大于`accessToken`的过期时间（比如2小时））、`expires`（`accessToken`的过期时间）
 * * 将`accessToken`、`expires`、`refreshToken`这三条信息放在key值为authorized-token的cookie里（过期自动销毁）
 * 将`username`、`roles`、`refreshToken`、`expires`这四条信息放在key值为`user-info`的storageLocal里
 */
export function setToken(data: TokenInfo) {
  if (isCookieAuthSession()) {
    // Cookie 模式：token 已由服务端 Set-Cookie 承载（HttpOnly，本函数不可读不可写）；
    // 只清掉 header 模式遗留的可读 token Cookie（防 XSS 从旧会话残留里读到 token）
    Cookies.remove(TokenKey);
    Cookies.remove(RefreshTokenKey);
  } else {
    if (data.access && data.access_token_lifetime) {
      setAccessToken(data.access, data.access_token_lifetime - 10);
    }
    if (data.refresh && data.refresh_token_lifetime) {
      setRefreshToken(data.refresh, data.refresh_token_lifetime - 10);
    }
  }
  // 免登录勾选态归登录页 UI store（auth ↔ store 均为函数体内调用 hook）
  const { isRemembered, loginDay } = useLoginPageStoreHook();
  Cookies.set(
    multipleTabsKey,
    "true",
    isRemembered
      ? {
          expires: loginDay,
          // 与另两个认证 Cookie 同口径（布尔标记非敏感，但 SameSite/Secure
          // 属认证 Cookie 组的统一面，避免单点漂移）
          ...cookieSecureOptions()
        }
      : { ...cookieSecureOptions() }
  );
}

/** 删除`token`以及key值为`user-info`的session信息 */
export function removeToken() {
  Cookies.remove(TokenKey);
  Cookies.remove(RefreshTokenKey);
  Cookies.remove(multipleTabsKey);
  // 模式标记一并清除（登出响应也会服务端清理；本地同步清是同标签立即生效兜底）。
  // Cookie 模式下 X-Token/X-Refresh-Token 是 HttpOnly，本地删不掉——由登出接口的
  // Set-Cookie(Max-Age=0) 清理，本地登出兜底口径见 user store 的 logOut
  Cookies.remove(AuthModeKey);
  storageLocal().removeItem(userKey);
}

export function remoteAccessToken() {
  Cookies.remove(TokenKey);
}

/** 格式化token（jwt格式） */
export const formatToken = (token: string): string => {
  return "Bearer " + token;
};

/** 当前 UI 语言 → 后端 gettext 语言（SSE fetch 等不走 axios 拦截器的链路复用） */
export const getApiLanguage = (): string => {
  const nameSpace = responsiveStorageNameSpace();
  return Storage.getData("locale", nameSpace)?.locale ?? "zh";
};

export const setApiLanguage = (config: PureHttpRequestConfig) => {
  // 请求拦截阶段 axios 必已构造 headers
  config.headers!["Accept-Language"] = getApiLanguage();
};
