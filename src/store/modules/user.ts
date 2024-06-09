import { defineStore } from "pinia";
import { message } from "@/utils/message";
import type { TokenResult } from "@/api/auth";
import {
  loginApi,
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
import { nextTick } from "vue";

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
    noticeCount: 0
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
    async loginByUsername(data) {
      return new Promise<TokenResult>((resolve, reject) => {
        data["password"] = AesEncrypted(data["token"], data["password"]);
        data["username"] = AesEncrypted(data["token"], data["username"]);
        loginApi(data)
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
    async getUserInfo() {
      return new Promise<UserInfoResult>((resolve, reject) => {
        userInfoApi
          .self()
          .then(res => {
            if (res.code === 1000) {
              clear();
              setUserInfo(res.data);
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
        data["password"] = AesEncrypted(data["token"], data["password"]);
        data["username"] = AesEncrypted(data["token"], data["username"]);
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
    }
  }
});

export function useUserStoreHook() {
  return useUserStore(store);
}
