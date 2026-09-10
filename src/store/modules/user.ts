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
import { useWatermark } from "@pureadmin/utils";
import { h, nextTick, type VNode } from "vue";
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

const { setWatermark, clear } = useWatermark();

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
      clear: null
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
      this.noticeCount += Number(value);
    },
    /** 登入 */
    async loginByUsername(data, encrypted) {
      return new Promise<LoginResult>((resolve, reject) => {
        if (encrypted) {
          data["password"] = AesEncrypted(data["token"], data["password"]);
          data["username"] = AesEncrypted(data["token"], data["username"]);
        }
        loginBasicApi(data)
          .then(res => {
            // mfa_required 时后端未签发 token（data 中无 access），不能写入
            if (res.code === 1000 && "access" in res.data) {
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
            if (res.code === 1000) {
              setUserInfo(res.data);
              this.clear = clear;
              if (res.config.FRONT_END_WEB_WATERMARK_ENABLED) {
                this.clear();
                nextTick(() => {
                  setWatermark(
                    `${this.username}${this.nickname ? "-" + this.nickname : ""}`,
                    {
                      globalAlpha: 0.1, // 值越低越透明
                      gradient: [
                        { value: 0, color: "magenta" },
                        { value: 0.5, color: "blue" },
                        { value: 1.0, color: "red" }
                      ]
                    }
                  );
                });
              }
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
    async registerByUsername(data) {
      return new Promise<TokenResult>((resolve, reject) => {
        registerApi(data)
          .then(res => {
            if (res.code === 1000) {
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
          if (res.code === 1000) {
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
    async handRefreshToken(data) {
      return new Promise<TokenResult>((resolve, reject) => {
        refreshTokenApi(data)
          .then(res => {
            if (res.code === 1000) {
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
          switch (data?.message_type) {
            case "notify_message":
              if (data?.notice_type?.value === 0) {
                const isHtml =
                  /<(?=.*? .*?\/ ?>|br|hr|input|!--|wbr)[a-z]+.*?>|<([a-z]+).*?<\/\1>/i.test(
                    message
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
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: h("i", { style: "color: teal" }, message),
                duration: 3000,
                onClick: () => {
                  router.push({
                    name: "Chat"
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
      this.websocket = new PureWebSocket(this.username, "xadmin", {
        openCallback: () => {
          this.websocket.onMessage(data => {
            onMessage(data);
          });
        }
      });
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
