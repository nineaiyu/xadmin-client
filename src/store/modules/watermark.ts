import { SUCCESS_CODE } from "@/api/types";
import { defineStore } from "pinia";
import type { SiteWatermarkResultConfig } from "@/api/auth";
import { defaultSiteWatermark, toSiteWatermarkConfig } from "@/utils/watermark";

// 直接引 pinia 实例与类型文件，不走 ../utils 桶导出：
// 桶导出会连带 router/api 全链，叠在 user → watermark 依赖上放大循环导入面
import { store } from "@/store";
import type { watermarkType } from "../types";

/**
 * 站点水印配置 store：配置由用户信息接口（userinfo）随取下发，
 * 应用与刷新时机在 `src/App.vue`（按当前路由是否命中生效范围决定挂载/清除）。
 *
 * 从 user store 拆出（水印配置与登录态解耦）：user store 在拉取用户信息与
 * 登出时调用本 store，保持 user → watermark 单向依赖；文案模板占位符由
 * 消费方按当前用户解析，本 store 不回读用户身份。
 */
export const useWatermarkStore = defineStore("pure-watermark", {
  state: (): watermarkType => ({
    // 站点水印配置（用户信息接口下发后写入，App.vue 观察应用）
    siteWatermark: { ...defaultSiteWatermark }
  }),
  actions: {
    /**
     * 用户信息接口的 config 载荷写入站点水印配置（缺省/非法值回落默认）：
     * getUserInfo 拉取 userinfo 后调用
     */
    applyFromUserInfo(config?: SiteWatermarkResultConfig) {
      this.siteWatermark = toSiteWatermarkConfig(config);
    },
    /**
     * 仅刷新站点水印配置（用户信息接口随取随用）：
     * 管理员保存「水印设置」后立即应用，无需重新登录/刷新页面
     */
    async refreshSiteWatermark() {
      // api 层在调用时动态引入：本 store 处于 user → watermark 依赖边上，
      // 静态引入会形成 user → api/base → http → user 的模块环，
      // 环上 api/config 的类声明可能在基类就绪前求值（取决于加载入口）
      const { userInfoApi } = await import("@/api/user/userinfo");
      const res = await userInfoApi.retrieve();
      if (res.code === SUCCESS_CODE) {
        this.applyFromUserInfo(res.config);
      }
    },
    /**
     * 清空水印态（登出 / 清空缓存调用）：
     * 站点水印配置复位，已挂载的水印 DOM 由 App.vue 观察 siteWatermark 变化后清除
     */
    reset() {
      this.siteWatermark = { ...defaultSiteWatermark };
    }
  }
});

export function useWatermarkStoreHook() {
  return useWatermarkStore(store);
}
