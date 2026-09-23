import { SUCCESS_CODE } from "@/api/types";
import { defineStore } from "pinia";
import { message } from "@/utils/message";
import type { LoginResult, TokenResult } from "@/api/auth";
import {
  loginBasicApi,
  logoutApi,
  refreshTokenApi,
  registerApi,
  type UserInfo,
  type UserInfoResult
} from "@/api/auth";
import { userInfoApi } from "@/api/user/userinfo";
import {
  getRefreshToken,
  removeToken,
  setToken,
  setUserInfo,
  userKey
} from "@/utils/auth";
import { clearPendingApprovals } from "@/utils/http/pendingApproval";

import {
  resetRouter,
  router,
  routerArrays,
  storageLocal,
  store,
  type userType
} from "../utils";

import { useMultiTagsStoreHook } from "./multiTags";
import { AesEncrypted } from "@/utils/aes";
import { notifyDesktop, stripHtml } from "@/utils/desktopNotify";
import { defaultSiteWatermark, parseWatermarkPaths } from "@/utils/watermark";
import { h, type VNode } from "vue";
import { PureWebSocket } from "@/utils/websocket";
import {
  MessageAction,
  isOutboundMessage,
  type PushMessagePayload
} from "@/utils/websocket/protocol";
import {
  ElNotification,
  type NotificationOptions,
  type NotificationType
} from "element-plus";

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
      // 页面级别权限
      roles: userInfo?.roles ?? [],
      // 前端生成的验证码（按实际需求替换）
      verifyCodeLength: 0,
      // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
      currentPage: 0,
      // 是否勾选了登录页的免登录
      isRemembered: false,
      // 登录页的免登录存储几天，默认7天
      loginDay: 7,
      // 未读消息数量
      noticeCount: 0,
      // 消息通知websocket
      websocket: null,
      // 站点水印配置（用户信息接口下发后写入，App.vue 观察应用）
      siteWatermark: { ...defaultSiteWatermark },
      // 巡检处置联动：管理员要求改密（userinfo 下发，App.vue 观察后引导改密）
      mustChangePassword: userInfo?.must_change_password ?? false
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
      this.roles = data?.roles;
      // 巡检处置联动：改密要求随用户信息刷新（App.vue 观察后引导，改密即清除）
      this.mustChangePassword = Boolean(data?.must_change_password);
      storageLocal().setItem(userKey, data);
    },
    /**
     * 清空水印态（登出 / 清空缓存调用）：
     * 站点水印配置复位，已挂载的水印 DOM 由 App.vue 观察 siteWatermark 变化后清除
     */
    clear() {
      this.siteWatermark = { ...defaultSiteWatermark };
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
    /** 存储前端生成的验证码 */
    SET_VERIFY_CODE_LENGTH(length: number) {
      this.verifyCodeLength = length;
    },
    /** 存储登录页面显示哪个组件 */
    SET_CURRENT_PAGE(value: number) {
      this.currentPage = value;
    },
    /** 存储是否勾选了登录页的免登录 */
    SET_ISREMEMBERED(bool: boolean) {
      this.isRemembered = bool;
    },
    /** 设置登录页的免登录存储几天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    } /** 设置未读消息数量 */,
    SET_NOTICECOUNT(value: number) {
      this.noticeCount = Number(value);
    },
    INCR_NOTICECOUNT(value: number = 1) {
      this.noticeCount = (this.noticeCount ?? 0) + Number(value);
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
      return new Promise<UserInfoResult>((resolve, reject) => {
        userInfoApi
          .retrieve()
          .then(res => {
            if (res.code === SUCCESS_CODE) {
              setUserInfo(res.data);
              // 水印配置存入本 store：由 App.vue 按「当前路由是否命中生效范围」应用/清除
              this.siteWatermark = {
                enabled: !!res.config?.FRONT_END_WEB_WATERMARK_ENABLED,
                text: res.config?.FRONT_END_WEB_WATERMARK_TEXT ?? "",
                paths: parseWatermarkPaths(
                  res.config?.FRONT_END_WEB_WATERMARK_PATHS
                )
              };
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
    logOut() {
      this.username = "";
      this.roles = [];
      // 审批令牌绑定申请人：登出即清空，防跨账号残留（不依赖整页 reload）
      clearPendingApprovals();
      logoutApi({ refresh: getRefreshToken() })
        .then(res => {
          if (res.code === SUCCESS_CODE) {
            message("登出成功", { type: "success" });
          }
        })
        .finally(() => {
          this.websocket?.close();
          removeToken();
          useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
          resetRouter();
          this.clear();
          window.location.reload();
          // router.push("/login");
        });
    },
    /** 刷新`token` */
    async handRefreshToken(data: { refresh: string }) {
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
    },
    messageHandler() {
      const onMessage = (raw: unknown) => {
        // 协议帧分派（protocol.ts）：仅处理 push_message 通知推送
        if (
          isOutboundMessage<PushMessagePayload>(raw, MessageAction.PUSH_MESSAGE)
        ) {
          const data = raw.data ?? {};
          let message: string | VNode | undefined = data?.message;
          // 桌面通知（二期）：聊天类（@提及/私聊）前台也弹，
          // 其余站内推送仅页面不可见时弹；点击行为与各分支的应用内通知一致
          const isChatPush =
            data?.message_type === "chat_message" ||
            data?.message_type === "chat_private" ||
            data?.message_type === "chat_group";
          notifyDesktop({
            type: isChatPush ? "chat" : "push",
            title: `${data?.notice_type?.label}-${data?.title}`,
            body: stripHtml(String(data?.message ?? "")),
            tag: data?.pk ? String(data.pk) : undefined,
            onClick: () => {
              if (isChatPush) {
                router.push({
                  name: "Chat",
                  query: data?.room_id ? { room: String(data.room_id) } : {}
                });
              } else {
                router.push({ name: "UserNotice", query: { pk: data?.pk } });
              }
            }
          });
          switch (data?.message_type) {
            case "notify_message":
              if (data?.notice_type?.value === 0) {
                // 统一按字符串测试（RegExp.test 本身会 ToString；显式归一消除类型歧义）
                const isHtml =
                  /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i.test(
                    String(message ?? "")
                  );
                if (!isHtml) {
                  message = h("i", { style: "color: teal" }, data?.message);
                }
              }
              const options: Partial<NotificationOptions> = {
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: message ?? "",
                duration: 5000,
                dangerouslyUseHTMLString: true,
                type: (data?.level?.value
                  ?.replace("primary", "")
                  ?.replace("danger", "warning") ?? undefined) as
                  NotificationType | undefined,
                onClick: () => {
                  router.push({
                    name: "UserNotice",
                    query: { pk: data?.pk }
                  });
                }
              };
              ElNotification(options);
              this.INCR_NOTICECOUNT();
              break;
            case "chat_message":
              // @提及：点击跳聊天室并定位到该会话（服务端下发 room_id）
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: h("i", { style: "color: teal" }, message),
                duration: 3000,
                onClick: () => {
                  router.push({
                    name: "Chat",
                    query: data?.room_id ? { room: String(data.room_id) } : {}
                  });
                }
              });
              break;
            case "chat_private":
            case "chat_group":
              // 私聊/群聊提醒（未开聊天室时推送）：点击直达该会话
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: h("i", { style: "color: teal" }, message),
                duration: 5000,
                onClick: () => {
                  router.push({
                    name: "Chat",
                    query: data?.room_id ? { room: String(data.room_id) } : {}
                  });
                }
              });
              break;
            case "logout":
              this.logOut();
              break;
            case "error":
              console.log(raw);
              break;
          }
        }
      };
      // 先关闭旧连接：重复调用 messageHandler（如重新拉取用户信息）时，
      // 避免叠加多个 WS 实例与其监听造成连接/内存泄漏
      this.websocket?.close();
      const socket = new PureWebSocket(this.username ?? "", "xadmin", {
        openCallback: () => {
          socket.onMessage(data => {
            onMessage(data);
          });
        }
      });
      this.websocket = socket;
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
