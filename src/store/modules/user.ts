import { SUCCESS_CODE } from "@/api/types";
import { defineStore } from "pinia";
import { message } from "@/utils/message";
import { transformI18n } from "@/plugins/i18n";
// 类型导入保持顶层静态（编译期擦除）；认证接口是运行期值，改在动作内动态引入：
// store → api/auth 的顶层静态边会与 api/auth → utils/http → store 的链路成环，
// 环内 api 模块的类声明可能在基类就绪前求值。环检测脚本守护此约束。
import type {
  LoginResult,
  TokenInfo,
  TokenResult,
  UserInfo,
  UserInfoResult
} from "@/api/auth";
import {
  getRefreshToken,
  removeToken,
  setToken,
  setUserInfo,
  userKey
} from "@/utils/auth";
import { clearPendingApprovals } from "@/utils/http/pendingApproval";
import { clearRouteSnapshot } from "@/utils/routeSnapshot";

import {
  resetRouter,
  routerArrays,
  storageLocal,
  store,
  type userType
} from "../utils";

import { useMultiTagsStoreHook } from "./multiTags";
import { useNoticeStoreHook } from "./notice";
import { useWatermarkStoreHook } from "./watermark";
import { AesEncrypted } from "@/utils/aes";

export const useUserStore = defineStore("pure-user", {
  state: (): userType => {
    // 用户信息唯一持久化副本，仅在下方 updateUserInfo 写入、removeToken 清除；
    // 其余代码读取用户信息一律走本 store，禁止直接读 storage
    const userInfo = storageLocal().getItem<UserInfo>(userKey);
    return {
      // 头像
      avatar: userInfo?.avatar ?? "",
      // 用户名
      username: userInfo?.username ?? "",
      // 昵称
      nickname: userInfo?.nickname ?? "",
      email: userInfo?.email ?? "",
      phone: userInfo?.phone ?? "",
      // 用户唯一标识（水印模板 {pk} 占位符取值）
      pk: userInfo?.pk,
      // 页面级别权限
      roles: userInfo?.roles ?? [],
      // 平台超管标记（userinfo 下发；旧持久化副本缺该字段时按非超管）
      is_superuser: userInfo?.is_superuser ?? false,
      // 巡检处置联动：管理员要求改密（userinfo 下发，App.vue 观察后引导改密）
      mustChangePassword: userInfo?.must_change_password ?? false,
      // 用户模拟态（userinfo 下发）：非模拟态为 null
      impersonator: userInfo?.impersonator ?? null
    };
  },
  actions: {
    /**
     * 更新用户信息并写穿持久化副本（storage）。
     * 用户信息以此 action 为唯一写入入口，读取一律走本 store state
     */
    updateUserInfo(data: UserInfo) {
      this.avatar = data.avatar;
      this.username = data.username;
      this.nickname = data.nickname;
      this.email = data.email;
      this.phone = data.phone;
      this.pk = data.pk;
      this.roles = data?.roles;
      // 平台超管标记随用户信息刷新（「非本人也可管理」入口据此放行）
      this.is_superuser = Boolean(data?.is_superuser);
      // 巡检处置联动：改密要求随用户信息刷新（App.vue 观察后引导，改密即清除）
      this.mustChangePassword = Boolean(data?.must_change_password);
      // 用户模拟态随用户信息刷新（顶栏横幅据此渲染；硬刷新后不丢）
      this.impersonator = data?.impersonator ?? null;
      storageLocal().setItem(userKey, data);
    },
    /** 存储用户头像 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    } /** 存储用户昵称 */,
    SET_NICKNAME(nickname: string) {
      this.nickname = nickname;
    },
    SET_EMAIL(email: string) {
      this.email = email;
    },
    SET_PHONE(phone: string) {
      this.phone = phone;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<string>) {
      this.roles = roles;
    },
    /**
     * 建立消息推送通道（WS 连接与通知分发归 notice store）：
     * 供路由初始化后调用，登录名与登出行为在此注入，保持 user → notice 单向依赖
     */
    messageHandler() {
      useNoticeStoreHook().messageHandler(this.username ?? "", () =>
        this.logOut()
      );
    },
    /** 登入 */
    async loginByUsername(data: Record<string, unknown>, encrypted?: boolean) {
      if (encrypted) {
        // 加密入参先按字符串归一（表单值类型在运行期为 string）
        data["password"] = await AesEncrypted(
          String(data["token"] ?? ""),
          String(data["password"] ?? "")
        );
        data["username"] = await AesEncrypted(
          String(data["token"] ?? ""),
          String(data["username"] ?? "")
        );
      }
      const { loginBasicApi } = await import("@/api/auth");
      return new Promise<LoginResult>((resolve, reject) => {
        loginBasicApi(data)
          .then(res => {
            // mfa_required 时后端未签发 token（data 中无 access），不能写入
            if (res.code === SUCCESS_CODE && "access" in res.data) {
              setToken(res.data);
            }
            resolve(res);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    async getUserInfo() {
      const { userInfoApi } = await import("@/api/user/userinfo");
      return new Promise<UserInfoResult>((resolve, reject) => {
        userInfoApi
          .retrieve()
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              setUserInfo(res.data);
              // 水印配置写入水印 store（user → watermark 单向依赖）：
              // 由 App.vue 按「当前路由是否命中生效范围」应用/清除
              useWatermarkStoreHook().applyFromUserInfo(res.config);
              resolve(res);
            } else {
              reject(res);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 注册 */
    async registerByUsername(data: Record<string, unknown>) {
      const { registerApi } = await import("@/api/auth");
      return new Promise<TokenResult>((resolve, reject) => {
        registerApi(data)
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              setToken(res.data);
              resolve(res);
            } else {
              reject(res);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 前端登出 **/
    async logOut() {
      this.username = "";
      this.roles = [];
      // 审批令牌绑定申请人：登出即清空，防跨账号残留（不依赖整页 reload）
      clearPendingApprovals();
      const { logoutApi } = await import("@/api/auth");
      logoutApi({ refresh: getRefreshToken() })
        .then(res => {
          if (res.code === SUCCESS_CODE) {
            message(transformI18n("login.logoutSuccess"), { type: "success" });
          }
        })
        .finally(() => {
          useNoticeStoreHook().disconnect();
          removeToken();
          useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
          resetRouter();
          // 水印态复位归水印 store（App.vue 观察水印配置变化后清除已挂载 DOM）
          useWatermarkStoreHook().reset();
          window.location.reload();
          // router.push("/login");
        });
    },
    /**
     * 用户模拟：身份切换的统一收口（进入模拟 / 退出模拟共用）。
     *
     * 服务端已换签目标身份的 token：这里清理旧身份的本地痕迹（审批令牌、
     * 路由/权限快照、页签、WS 连接），写入新 token 后整页刷新——路由守卫
     * 会重新拉取 userinfo（含模拟态）与菜单权限，全部状态以新身份重建。
     */
    async switchIdentity(data: TokenInfo, successTip?: string) {
      if (successTip) {
        message(successTip, { type: "success" });
      }
      clearPendingApprovals();
      // 审批令牌绑定申请人、WS 绑定旧身份：切换前一并清理，防跨身份残留
      useNoticeStoreHook().disconnect();
      clearRouteSnapshot();
      useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
      setToken(data);
      // 整页跳转重建应用（而非路由内切换）：pinia/内存态/水印/WS 全部以新身份重置
      window.location.href = "/";
    },
    /** 退出用户模拟：服务端失效模拟态凭证并为发起人重签 token */
    async exitImpersonation() {
      const { exitImpersonateApi } = await import("@/api/auth");
      return new Promise<void>((resolve, reject) => {
        exitImpersonateApi({ refresh: getRefreshToken() })
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              // 本地先行清除模拟态（含持久化副本）：重载到 userinfo 返回前的
              // 窗口内横幅不再闪现
              this.impersonator = null;
              const stored = storageLocal().getItem<UserInfo>(userKey);
              if (stored) {
                delete stored.impersonator;
                storageLocal().setItem(userKey, stored);
              }
              return this.switchIdentity(res.data).then(() => resolve());
            }
            reject(res);
          })
          .catch(error => {
            reject(error);
          });
      });
    },
    /** 刷新`token` */
    async handRefreshToken(data: { refresh: string }) {
      const { refreshTokenApi } = await import("@/api/auth");
      return new Promise<TokenResult>((resolve, reject) => {
        refreshTokenApi(data)
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              setToken(res.data);
              resolve(res);
            } else {
              reject(res);
            }
          })
          .catch(error => {
            reject(error);
          });
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
