import { listDashboards } from "@/api/dataset/analysis";
import {
  datasetApi,
  listRows,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import { fetchAllRows } from "@/utils/fetchAllRows";

/**
 * 大屏设计器与投屏页共用的引用数据装载（仪表盘清单 + 可见数据集清单）。
 *
 * 两份清单只用于命名与可见性过滤，失败**不阻塞主链路**：装载异常归一为 null，
 * 由调用方决定提示（设计器就地警告）还是整体降级（投屏页转「加载失败 + 重试」）。
 * 此前两页各自裸调接口，异常逃逸会让设计器 loading 永久悬挂、投屏页落入
 * 「暂无可展示看板」空态，与真实原因不符。
 */
export type ScreenReferenceData = {
  /** 仪表盘清单：失败为 null（调用方按空清单降级） */
  dashboards: DashboardItem[] | null;
  /** 可见数据集清单：失败为 null */
  datasets: DatasetItem[] | null;
};

export async function loadScreenReferenceData(): Promise<ScreenReferenceData> {
  const [dashboards, datasets] = await Promise.all([
    listDashboards().catch(() => null),
    fetchAllRows(datasetApi.list).catch(() => null)
  ]);
  return {
    dashboards,
    datasets: datasets ? listRows<DatasetItem>(datasets as never) : null
  };
}
