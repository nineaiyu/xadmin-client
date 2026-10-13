import { ref, type Ref } from "vue";
import { useRoute } from "vue-router";
import { isSuccess } from "@/api/types";
import { screenApi, type ScreenItem } from "@/api/dataset/analysis";
import type { DashboardItem, DatasetItem } from "@/api/dataset/datasets";
import { loadScreenReferenceData } from "./referenceData";

/**
 * 投屏页详情装载（自 display.vue 抽出，行数门禁）。
 *
 * 拉「大屏详情 + 引用数据（仪表盘 / 数据集）」，任一步失败都置 `loadFailed`
 * （页面转「加载失败 + 重试」，不再落入与真实原因不符的空态）；成功后解析
 * 「浏览者可见的仪表盘」清单（personal 对他人不在可见列表内，轮播与画布共用）。
 */
export function useScreenLoader(deps: {
  screen: Ref<ScreenItem | null>;
  dashboards: Ref<DashboardItem[]>;
  datasets: Ref<DatasetItem[]>;
  /** 装载成功后的收尾（启动定时器与控制通道，参数为大屏 pk） */
  onLoaded: (_pk: string) => void;
}) {
  const route = useRoute();
  const loadFailed = ref(false);

  const loadScreen = async () => {
    loadFailed.value = false;
    const pk = String(route.query.pk ?? "");
    const res = pk ? await screenApi.retrieve(pk).catch(() => null) : null;
    if (!res || !isSuccess(res)) {
      loadFailed.value = true;
      return;
    }
    deps.screen.value = res.data as ScreenItem;
    // 引用数据失败整体转「加载失败 + 重试」（此前未捕获——异常逃逸且页面落入
    // 「暂无可展示看板」空态，与真实原因不符，也无法重试）
    const reference = await loadScreenReferenceData();
    if (!reference.dashboards || !reference.datasets) {
      loadFailed.value = true;
      return;
    }
    const all = reference.dashboards;
    deps.dashboards.value = (deps.screen.value.dashboards ?? [])
      .map((id: string) => all.find((item: DashboardItem) => item.pk === id))
      .filter((item): item is DashboardItem => Boolean(item));
    // 指标卡窗格按可见数据集过滤（同仪表盘窗格口径）
    deps.datasets.value = reference.datasets;
    deps.onLoaded(pk);
  };

  return { loadFailed, loadScreen };
}
