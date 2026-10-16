import { toRaw, type Ref } from "vue";
import { getTopMenu } from "@/router/utils";
import { useMultiTagsStoreHook } from "@/store/modules/multiTags";
import type { RouteConfigs } from "../../../types";

/**
 * 固定标签守卫（自 useTagDelete 抽出）：路由级 `fixedTag`（首页等）与右键「固定」
 * 的标签都不参与「关闭左侧 / 右侧 / 其他 / 全部」。
 *
 * 一律按 **路径** 判定而非下标——右键固定的标签可能落在列表中间，下标会漂移。
 */
export function createTagFixedScope({
  multiTags,
  fixedTags
}: {
  multiTags: Ref<RouteConfigs[]>;
  fixedTags: unknown[];
}) {
  const { VITE_HIDE_HOME } = import.meta.env;

  /** 固定标签路径集合（路由级 fixedTag + 右键固定） */
  function fixedPaths(): Set<string | undefined> {
    const pinned = multiTags.value.filter(tag =>
      useMultiTagsStoreHook().isPinnedTag(tag.path ?? "")
    );
    return new Set(
      [...(fixedTags as { path?: string }[]), ...pinned].map(tag => tag.path)
    );
  }

  /** 「关闭其他」保留集：固定标签 + 目标标签（VITE_HIDE_HOME 时只保留顶级菜单） */
  function keepFixedAnd(obj: RouteConfigs): RouteConfigs[] {
    const keep = fixedPaths();
    return [
      VITE_HIDE_HOME === "false"
        ? multiTags.value.filter(item => keep.has(item.path))
        : toRaw(getTopMenu()),
      obj
    ].flat() as RouteConfigs[];
  }

  /** 逐个删除给定范围内「非固定」的标签（调用方提供按路径删除动作） */
  function spliceNonFixed(
    scope: RouteConfigs[],
    remove: (path: string) => void
  ): void {
    const keep = fixedPaths();
    scope
      .filter(item => !keep.has(item.path))
      .forEach(item => remove(item.path ?? ""));
  }

  return { fixedPaths, keepFixedAnd, spliceNonFixed };
}
