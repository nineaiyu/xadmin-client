import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { deptApi } from "@/api/system/dept";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { handleTree, type TreeResult } from "@/utils/tree";
import type { Ref } from "vue";
import type { RecordType } from "plus-pro-components";

/**
 * 用户视图左侧部门树。
 *
 * 角色/数据权限全量列表原先在此预取但页面上从未消费（授权弹窗自带数据源），
 * 已移除避免每次进页多发两个全量请求。
 */
export function useUserOptions(tableRef: Ref) {
  const { t } = useI18n();
  const treeData = ref<TreeResult<RecordType>[]>([]);
  const treeLoading = ref(true);

  onMounted(() => {
    // 部门列表
    if (hasAuth("list:SystemDept")) {
      fetchAllRows(deptApi.list)
        .then(res => {
          if (res.code === SUCCESS_CODE && res.data) {
            treeData.value = handleTree(res.data.results);
          } else {
            message(`${t("results.failed")}，${res.detail}`, { type: "error" });
          }
        })
        .catch(() => undefined)
        .finally(() => {
          // 在请求真正结束后再关闭加载态（原实现在发起请求后立即置 false）
          treeLoading.value = false;
        });
    } else {
      // 无部门权限时也要结束加载态，避免树区域一直转圈
      treeLoading.value = false;
    }
  });

  function onTreeSelect({
    pk,
    selected
  }: {
    pk: number | string;
    selected: boolean;
  }) {
    tableRef.value.handleGetData({ dept: selected ? pk : "", page: 1 });
  }

  return { treeData, treeLoading, onTreeSelect };
}
