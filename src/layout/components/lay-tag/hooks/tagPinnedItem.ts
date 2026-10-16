import { $t } from "@/plugins/i18n";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import type { RouteConfigs, tagsViewsType } from "../../../types";

/**
 * 固定项（右键 / 下拉菜单下标 7）的显隐与文案同步：路由级 fixedTag（首页等路由
 * 声明的固定标签）不允许再固定，直接隐藏；其余按该标签的固定态切换「固定 / 取消固定」。
 *
 * 固定清单按标签 path 存储，而下拉菜单入口传入的是 route.fullPath——优先取命中标签的
 * path，避免带查询串时文案与固定态错配。
 */
export function syncPinItem(
  item: tagsViewsType,
  currentTag: RouteConfigs | undefined,
  currentPath: string
) {
  item.show = Boolean(currentTag && !currentTag?.meta?.fixedTag);
  item.text = useMultiTagsStoreHook().isPinnedTag(
    currentTag?.path ?? currentPath
  )
    ? $t("buttons.unpinTab")
    : $t("buttons.pinTab");
}
