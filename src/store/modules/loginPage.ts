import { defineStore } from "pinia";

// 直接引 pinia 实例与类型文件，不走 ../utils 桶导出（避免连带 router/api 全链）
import { store } from "@/store";
import type { loginPageType } from "../types";

/**
 * 登录页 UI 态 store：登录页子页面切换、免登录勾选与天数、图形验证码长度。
 *
 * 从 user store 拆出（登录页交互态与认证身份解耦）：登录/注册/登出等认证
 * 行为仍归 user store，本 store 只承载纯 UI 状态，无外部副作用。
 * 子页面编号与 src/views/login/utils/enums.ts 的 LOGIN_PAGE 枚举保持一致。
 */
export const useLoginPageStore = defineStore("pure-login-page", {
  state: (): loginPageType => ({
    // 判断登录页面显示哪个组件（0：登录（默认）、1：手机登录、2：二维码登录、3：注册、4：忘记密码）
    currentPage: 0,
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7,
    // 前端生成的验证码（按实际需求替换）
    verifyCodeLength: 0
  }),
  actions: {
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
    /** 设置登录页的免登录存储几天，默认7天 */
    SET_LOGINDAY(value: number) {
      this.loginDay = Number(value);
    }
  }
});

export function useLoginPageStoreHook() {
  return useLoginPageStore(store);
}
