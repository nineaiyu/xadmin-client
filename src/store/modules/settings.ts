import { defineStore } from "pinia";
import { getConfig, type setType, store } from "../utils";

export const useSettingStore = defineStore("pure-setting", {
  state: (): setType => ({
    title: getConfig().Title ?? "",
    fixedHeader: getConfig().FixedHeader ?? false,
    hiddenSideBar: getConfig().HiddenSideBar ?? false
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
