/**
 * 表格可访问名同步（读屏）。
 *
 * 取页面标题（路由 `meta.title`，与页签/面包屑同源，缺省兜底通用词条）作为
 * 表头/表体两张原生 `<table>` 的可访问名；分页器「每页条数」下拉同步补名
 * （EP 无 props 入口）。数据 / 列 / 加载态变化后重新同步，实现见 `@/utils/tableA11y`。
 */
import { computed, nextTick, watch, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { syncPaginationA11y, syncTableA11y } from "@/utils/tableA11y";

export function useTableA11y(options: {
  /** 组件根节点（表格与分页器所在容器） */
  rootRef: Ref<HTMLElement | undefined>;
  /** 页面标题（`meta.title` 同源） */
  pageTitle: Ref<string>;
  /** 触发重新同步的快照（列 / 数据 / 加载态） */
  sources: () => unknown[];
}): void {
  const { t } = useI18n();
  const label = computed(
    () => options.pageTitle.value || t("tableA11y.dataTable")
  );
  watch(
    options.sources,
    () =>
      nextTick(() => {
        syncTableA11y(options.rootRef.value, label.value);
        syncPaginationA11y(options.rootRef.value, t("tableA11y.pageSize"));
      }),
    { flush: "post", immediate: true }
  );
}
