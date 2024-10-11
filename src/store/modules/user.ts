import { defineStore } from "pinia";
import { message } from "@/utils/message";
import type { TokenResult } from "@/api/auth";
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
import { h, nextTick } from "vue";
import { PureWebSocket } from "@/utils/websocket";
import { ElNotification } from "element-plus";

const { setWatermark, clear } = useWatermark();

export const useUserStore = defineStore({
  id: "pure-user",
  state: (): userType => ({
    // 头像
    avatar: storageLocal().getItem<UserInfo>(userKey)?.avatar ?? "",
    // 用户名
    username: storageLocal().getItem<UserInfo>(userKey)?.username ?? "",
    // 昵称
    nickname: storageLocal().getItem<UserInfo>(userKey)?.nickname ?? "",
    email: storageLocal().getItem<UserInfo>(userKey)?.email ?? "",
    phone: storageLocal().getItem<UserInfo>(userKey)?.phone ?? "",
    // 页面级别权限
    roles: storageLocal().getItem<UserInfo>(userKey)?.roles ?? [],
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
    websocket: null
  }),
  actions: {
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
      return new Promise<TokenResult>((resolve, reject) => {
        if (encrypted) {
          data["password"] = AesEncrypted(data["token"], data["password"]);
          data["username"] = AesEncrypted(data["token"], data["username"]);
        }
        loginBasicApi(data)
          .then(res => {
            if (res.code === 1000) {
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
          .detail()
          .then(res => {
            if (res.code === 1000) {
              setUserInfo(res.data);
              if (res.config.FRONT_END_WEB_WATERMARK_ENABLED) {
                clear();
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
          router.push("/login");
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
      const onMessage = json_data => {
        if (json_data.time && json_data.action === "push_message") {
          const data = JSON.parse(json_data.data);
          let message = data?.message;
          switch (data.message_type) {
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
              ElNotification({
                title: `${data?.notice_type?.label}-${data?.title}`,
                message: message,
                duration: 5000,
                dangerouslyUseHTMLString: true,
                type: data?.level?.value
                  ?.replace("primary", "")
                  ?.replace("danger", "warning"),
                onClick: () => {
                  router.push({
                    name: "UserNotice",
                    query: { pk: data?.pk }
                  });
                }
              });
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
            case "error":
              console.log(json_data);
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
