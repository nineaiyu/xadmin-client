import { defineStore } from "pinia";

// 直接引 pinia 实例与类型文件，不走 ../utils 桶导出（避免连带 router/api 全链）
import { store } from "@/store";
import type { AuthCapabilitiesResult } from "@/api/auth";
import type { loginPageType } from "../types";

/**
 * 登录页 UI 态 store：登录页子页面切换、免登录勾选与天数。
 *
 * 从 user store 拆出（登录页交互态与认证身份解耦）：登录/注册/登出等认证
 * 行为仍归 user store，本 store 只承载登录页状态、无请求副作用。子页面编号与
 * src/views/login/utils/enums.ts 的 LOGIN_PAGE 枚举保持一致。
 *
 * capabilities（登录页能力清单）由登录页外壳请求并写入（拉取不在此处：
 * store 引 api 层会形成 loginPage → api → utils → loginPage 的模块环），
 * 各子页共享——「该渲染哪些登录方式」不再由子页各自探测或前端写死。
 */
export const useLoginPageStore = defineStore("pure-login-page", {
  state: (): loginPageType => ({
    // 判断登录页面显示哪个组件（0：账密登录（默认）、1：验证码登录、3：注册、4：忘记密码）
    currentPage: 0,
    // 是否勾选了登录页的免登录
    isRemembered: false,
    // 登录页的免登录存储几天，默认7天
    loginDay: 7,
    // 能力清单未拉取时为 null，外壳就绪前不渲染子页（避免首帧闪「服务已禁止」）
    capabilities: null,
    capabilitiesStatus: "loading"
  }),
  actions: {
    /** 写入能力清单（外壳请求成功后调用） */
    SET_CAPABILITIES(data: AuthCapabilitiesResult["data"]) {
      this.capabilities = data;
      this.capabilitiesStatus = "success";
    },
    /** 更新能力清单加载状态（失败/重试时由外壳调用） */
    SET_CAPABILITIES_STATUS(status: loginPageType["capabilitiesStatus"]) {
      this.capabilitiesStatus = status;
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
