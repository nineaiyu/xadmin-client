import { getConfig } from "@/config";
import { removeToken } from "@/utils/auth";
import { routerArrays } from "@/layout/types";
import { resetRouter } from "@/router";
import { useAppStoreHook } from "@/store/modules/app";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import { useNoticeStoreHook } from "@/store/modules/notice";
import { useWatermarkStoreHook } from "@/store/modules/watermark";
import { storageLocal } from "@pureadmin/utils";
import { DEFAULT_EP_THEME_COLOR } from "@/utils/themeConstants";
import { toggleClass } from "./themeColorScheme";

/**
 * 清空缓存并返回登录页（自 useDataThemeChange.ts 抽出）：断开会话、清本地缓存、
 * 重置布局/主题/标签/水印后整页 reload。
 */
export function createAppReset({
  setEpThemeColor
}: {
  setEpThemeColor: (color: string) => void;
}) {
  return function onReset() {
    useNoticeStoreHook().disconnect();
    removeToken();
    storageLocal().clear();
    const { Grey, Weak, MultiTagsCache, EpThemeColor, Layout } = getConfig();
    useAppStoreHook().setLayout(Layout ?? "");
    setEpThemeColor(EpThemeColor ?? DEFAULT_EP_THEME_COLOR);
    useMultiTagsStoreHook().multiTagsCacheChange(MultiTagsCache ?? false);
    toggleClass(
      Grey ?? false,
      "html-grey",
      document.querySelector("html") ?? undefined
    );
    toggleClass(
      Weak ?? false,
      "html-weakness",
      document.querySelector("html") ?? undefined
    );
    useMultiTagsStoreHook().handleTags("equal", [...routerArrays]);
    resetRouter();
    // 水印态复位归水印 store（原 user store 的 clear 仅复位水印配置）
    useWatermarkStoreHook().reset();
    window.location.reload();
  };
}
