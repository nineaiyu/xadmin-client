import type { RouteLocationNormalizedLoaded, Router } from "vue-router";
import {
  dashboardApi,
  datasetApi,
  listRows,
  type DashboardItem,
  type DatasetItem
} from "@/api/dataset/datasets";
import { fetchAllRows } from "@/utils/fetchAllRows";

/** 仪表盘与数据集下拉的全量拉取（失败返回 null，由调用方显式提示）。 */
export async function fetchDashboardDatasets(): Promise<DatasetItem[] | null> {
  const res = await fetchAllRows(datasetApi.list).catch(() => null);
  return res ? listRows<DatasetItem>(res as never) : null;
}

export async function fetchDashboardList(): Promise<DashboardItem[]> {
  return listRows<DashboardItem>(
    (await fetchAllRows(dashboardApi.list)) as never
  );
}

/** ?pk= 分享定位：命中则选中，否则回落第一个仪表盘（无数据返回 null）。 */
export function resolveInitialDashboard(
  dashboards: DashboardItem[],
  sharedPk: string
): DashboardItem | null {
  if (!dashboards.length) return null;
  return dashboards.find(item => item.pk === sharedPk) ?? dashboards[0];
}

/** 选中仪表盘后把 pk 写回地址栏（分享即复制当前 URL）。 */
export function syncDashboardQuery(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  pk: string | null | undefined
) {
  if (!pk) return;
  router.replace({ query: { ...route.query, pk } });
}

/** 当前视图的分享链接：router.resolve 自动适配 hash / h5 路由模式。 */
export function buildDashboardShareUrl(
  router: Router,
  route: RouteLocationNormalizedLoaded,
  pk: string,
  origin: string
) {
  const resolved = router.resolve({
    path: route.path,
    query: { ...route.query, pk }
  }).href;
  return resolved.startsWith("http")
    ? resolved
    : `${origin}${resolved.startsWith("#") ? "/" : ""}${resolved}`;
}
