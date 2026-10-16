import { defineStore } from "pinia";
import { getConfig, type setType, store } from "../utils";
import {
  readConfigurePreferences,
  resolveSiteTitle
} from "@/utils/preferences";

export const useSettingStore = defineStore("pure-setting", {
  state: (): setType => ({
    // 站点标题取实际生效值（偏好优先、platform-config 的 Title 兜底，见 utils/preferences）
    title: resolveSiteTitle(),
    // 「固定顶栏」消费方以 configure.headerFixed 为准（responsive 已注入缺省值）；
    // 此字段仅作类型兼容与历史 changeSetting 调用的落点
    fixedHeader:
      readConfigurePreferences().headerFixed ??
      getConfig().HeaderFixed ??
      false,
    // 运行时内存态：页签右键「内容全屏」（不持久化，非配置搬运）；
    // 持久化开关见 configure.sidebarHidden（设置面板「隐藏侧栏」），两者在 layout/index.vue 取并集
    hiddenSideBar: false
  }),
  getters: {
    getTitle(state) {
      return state.title;
    },
    getFixedHeader(state) {
      return state.fixedHeader;
    },
    getHiddenSideBar(state) {
      return state.hiddenSideBar;
    }
  },
  actions: {
    CHANGE_SETTING({ key, value }: { key: string; value: unknown }) {
      if (Reflect.has(this, key)) {
        // 值类型随 key 变化（title/fixedHeader/hiddenSideBar），统一按对象合并写入
        Object.assign(this, { [key]: value });
      }
    },
    changeSetting(data: { key: string; value: unknown }) {
      this.CHANGE_SETTING(data);
    }
  }
});

export function useSettingStoreHook() {
  return useSettingStore(store);
}
