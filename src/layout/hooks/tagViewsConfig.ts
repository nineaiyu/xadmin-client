import { reactive, ref } from "vue";
import { $t } from "@/plugins/i18n";
import { responsiveStorageNameSpace } from "@/config";
import { storageLocal } from "@pureadmin/utils";
import Fullscreen from "~icons/ri/fullscreen-fill";
import CloseAllTags from "~icons/ri/subtract-line";
import CloseOtherTags from "~icons/ri/text-spacing";
import CloseRightTags from "~icons/ri/text-direction-l";
import CloseLeftTags from "~icons/ri/text-direction-r";
import RefreshRight from "~icons/ep/refresh-right";
import Close from "~icons/ep/close";
import type { tagsViewsType } from "../types";

/**
 * 标签栏下拉菜单项与本地偏好（自 useTag.ts 抽取）：按钮禁用态按标签数量推导，
 * 文字与图标随语言/全屏态更新。
 */
export function createTagsViews(tagCount: number) {
  return reactive<Array<tagsViewsType>>([
    {
      icon: RefreshRight,
      text: $t("buttons.reload"),
      divided: false,
      disabled: false,
      show: true
    },
    {
      icon: Close,
      text: $t("buttons.closeCurrentTab"),
      divided: false,
      disabled: tagCount > 1 ? false : true,
      show: true
    },
    {
      icon: CloseLeftTags,
      text: $t("buttons.closeLeftTabs"),
      divided: true,
      disabled: tagCount > 1 ? false : true,
      show: true
    },
    {
      icon: CloseRightTags,
      text: $t("buttons.closeRightTabs"),
      divided: false,
      disabled: tagCount > 1 ? false : true,
      show: true
    },
    {
      icon: CloseOtherTags,
      text: $t("buttons.closeOtherTabs"),
      divided: true,
      disabled: tagCount > 2 ? false : true,
      show: true
    },
    {
      icon: CloseAllTags,
      text: $t("buttons.closeAllTabs"),
      divided: false,
      disabled: tagCount > 1 ? false : true,
      show: true
    },
    {
      icon: Fullscreen,
      text: $t("buttons.contentFullScreen"),
      divided: true,
      disabled: false,
      show: true
    }
  ]);
}

/** 页签风格与显隐偏好（本地存储），默认谷歌风格 + 显示 */
export function createTagsPreferences() {
  /** 页签风格默认为谷歌风格 */
  const tagsStyle = ref(
    storageLocal().getItem<StorageConfigs>(
      `${responsiveStorageNameSpace()}configure`
    )?.tagsStyle || "chrome"
  );
  /** 是否隐藏标签页，默认显示 */
  const showTags =
    ref(
      storageLocal().getItem<StorageConfigs>(
        `${responsiveStorageNameSpace()}configure`
      ).hideTabs
    ) ?? ref("false");
  return { tagsStyle, showTags };
}
