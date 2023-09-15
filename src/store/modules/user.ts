import { defineStore } from "pinia";
import { store } from "@/store";
import { userType } from "./types";
import { routerArrays } from "@/layout/types";
import { router, resetRouter } from "@/router";
import { storageSession } from "@pureadmin/utils";
import {
  loginApi,
  registerApi,
  refreshTokenApi,
  logoutApi,
  UserInfo,
  UserInfoResult
} from "@/api/auth";
import { TokenResult } from "@/api/auth";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import {
  setToken,
  removeToken,
  sessionKey,
  getRefreshToken,
  setUserInfo
} from "@/utils/auth";
import { message } from "@/utils/message";
import { getUserInfoApi } from "@/api/userinfo";

export const useUserStore = defineStore({
  id: "pure-user",
  state: (): userType => ({
    // 用户名
    username: storageSession().getItem<UserInfo>(sessionKey)?.username ?? "",
    // 头像
    avatar: storageSession().getItem<UserInfo>(sessionKey)?.avatar ?? "",
    // 页面级别权限
    roles: storageSession().getItem<UserInfo>(sessionKey)?.roles ?? [],
    // 前端生成的验证码（按实际需求替换）
    verifyCodeLength: 0,
    // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
    currentPage: 0
  }),
  actions: {
    /** 存储用户名 */
    SET_USERNAME(username: string) {
      this.username = username;
    },
    /** 存储用户名 */
    SET_AVATAR(avatar: string) {
      this.avatar = avatar;
    },
    /** 存储角色 */
    SET_ROLES(roles: Array<number>) {
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
    /** 登入 */
    async loginByUsername(data) {
      return new Promise<TokenResult>((resolve, reject) => {
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
        getUserInfoApi()
          .then(res => {
            if (res.code === 1000) {
              setUserInfo(res.data);
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
    /** 前端登出（不调用接口） */
    logOut() {
      this.username = "";
      this.roles = [];
      logoutApi({ refresh: getRefreshToken() }).then(res => {
        if (res.code === 1000) {
          removeToken();
          message("登出成功", { type: "success" });
        }
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
