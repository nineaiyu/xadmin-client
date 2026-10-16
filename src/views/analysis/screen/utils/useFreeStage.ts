import { computed, type Ref } from "vue";
import { choiceValue } from "@/utils/dict";
import type { ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { readFreeLayout } from "./freeLayout";
import { visiblePanes } from "./paneVisibility";

/**
 * 投屏形态判定与自由画布载荷（展示端唯一入口）。
 *
 * 判定顺序与服务端 `dataset/utils/screen_layout.py::active_screen_panes` 一致：
 * 自由模式且自由载荷窗格非空 → 自由画布；否则栅格载荷非空 → 栅格画布；皆空 → 轮播。
 * 可见性过滤与栅格载荷同口径（见 `visiblePanes`）。
 */
export function useFreeStage(deps: {
  screen: Ref<ScreenItem | null>;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
}) {
  const freeLayout = computed(() =>
    readFreeLayout(deps.screen.value?.free_layout)
  );
  const freePanes = computed(() =>
    visiblePanes(
      freeLayout.value.panes,
      deps.dashboards.value,
      deps.datasets.value
    )
  );
  const isFree = computed(
    () =>
      choiceValue(deps.screen.value?.layout_mode) === "free" &&
      freePanes.value.length > 0
  );
  return { freeLayout, freePanes, isFree };
}
