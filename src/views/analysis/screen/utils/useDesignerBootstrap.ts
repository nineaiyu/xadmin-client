import {
  onBeforeUnmount,
  onMounted,
  type Ref,
  type WritableComputedRef
} from "vue";
import { useRoute, useRouter } from "vue-router";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { choiceValue } from "@/utils/dict";
import { screenApi, type ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { loadScreenReferenceData } from "./referenceData";
import { formatScreenClock } from "./screenClock";
import type { GridEditorApi } from "./createGridEditor";
import type { FreeEditorApi } from "./createFreeEditor";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
/** useI18n 的 locale 取值重载在泛型下退化为字面量，这里按运行时实际形状收窄 */
type LocaleRef = WritableComputedRef<string>;

/**
 * 设计器装载时序（自 designer.vue 抽出，行数门禁）。
 *
 * 职责 = 进场校验（缺 pk / 拉取失败即退回列表）→ 详情与两份载荷各自装载
 * （模式不互转，切回另一模式即见原布局）→ 模板与引用数据按需拉取（失败
 * 静默降级，不挡编辑主链路）→ 时钟起表。卸载时停表由本组合函数注册。
 */
export function useDesignerBootstrap(deps: {
  t: TFunction;
  locale: LocaleRef;
  screen: Ref<ScreenItem | null>;
  mode: Ref<"grid" | "free">;
  loading: Ref<boolean>;
  clock: Ref<string>;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
  grid: GridEditorApi;
  free: FreeEditorApi;
}) {
  const route = useRoute();
  const router = useRouter();
  let clockTimer: number | undefined;

  onMounted(async () => {
    const pk = String(route.query.pk ?? "");
    if (!pk) {
      message(deps.t("dataScreen.pickScreenFirst"), { type: "warning" });
      router.replace("/analysis/screen/index");
      return;
    }
    const res = await screenApi.retrieve(pk).catch(() => null);
    if (!res || !isSuccess(res) || !res.data) {
      message(deps.t("dataScreen.loadFailed"), { type: "warning" });
      router.replace("/analysis/screen/index");
      return;
    }
    deps.screen.value = res.data as ScreenItem;
    // 模式与两份载荷各自装载：切回另一模式即见原布局（服务端已归一化，前端只读）
    deps.mode.value =
      choiceValue(deps.screen.value.layout_mode) === "free" ? "free" : "grid";
    deps.grid.load(deps.screen.value.layout);
    deps.free.load(deps.screen.value.free_layout);
    deps.free.refreshTemplates();
    // 团队模板按需拉取（失败静默降级为空：不挡住本地模板与画布编辑）
    void deps.free.refreshServerTemplates();
    // 引用数据失败不阻塞设计器主链路：显式提示并按空清单降级（此前未捕获——异常
    // 逃逸且 loading 永久悬挂，画布空白且用户无感知）
    const reference = await loadScreenReferenceData();
    if (!reference.dashboards) {
      message(deps.t("dataScreen.dashboardsLoadFailed"), { type: "warning" });
    }
    if (!reference.datasets) {
      message(deps.t("dataScreen.datasetsLoadFailed"), { type: "warning" });
    }
    deps.dashboards.value = reference.dashboards ?? [];
    deps.datasets.value = reference.datasets ?? [];
    deps.loading.value = false;
    deps.clock.value = formatScreenClock(deps.locale.value);
    clockTimer = window.setInterval(() => {
      deps.clock.value = formatScreenClock(deps.locale.value);
    }, 1000);
  });

  onBeforeUnmount(() => {
    window.clearInterval(clockTimer);
  });
}
