import { shallowRef } from "vue";
import { isSuccess } from "@/api/types";
import { loadScopeCatalog } from "@/api/identity/open";
import { buildScopeIndex } from "@/utils/scopeDisplay";

/** 接口范围目录索引：拉取失败静默退回条目原文，不阻塞列表 */
export function useApiAppScopeIndex() {
  const scopeIndex = shallowRef(buildScopeIndex());
  loadScopeCatalog()
    .then(res => {
      if (!isSuccess(res)) return;
      scopeIndex.value = buildScopeIndex(res.data?.groups);
    })
    .catch(() => undefined);
  return { scopeIndex };
}
