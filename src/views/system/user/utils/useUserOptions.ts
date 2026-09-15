import { SUCCESS_CODE } from "@/api/types";
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

import { dataPermissionApi } from "@/api/system/permission";
import { deptApi } from "@/api/system/dept";
import { roleApi } from "@/api/system/role";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { fetchAllRows } from "@/utils/fetchAllRows";
import { handleTree, type TreeResult } from "@/utils/tree";
import type { Ref } from "vue";
import type { RecordType } from "plus-pro-components";

/** 用户视图下拉/树选项：部门树、角色、数据权限（empower 权限控制可见性） */
export function useUserOptions(auth: { empower: boolean }, tableRef: Ref) {
  const { t } = useI18n();
  const treeData = ref<TreeResult<RecordType>[]>([]);
  const treeLoading = ref(true);
  const rolesOptions = ref<RecordType[]>([]);
  const rulesOptions = ref<RecordType[]>([]);

  onMounted(() => {
    if (auth.empower) {
      if (hasAuth("list:SystemRole")) {
        fetchAllRows(roleApi.list).then(res => {
          if (res.code === SUCCESS_CODE && res.data) {
            rolesOptions.value = res.data.results;
          }
        });
      }
      if (hasAuth("list:SystemDataPermission")) {
        fetchAllRows(dataPermissionApi.list).then(res => {
          if (res.code === SUCCESS_CODE && res.data) {
            rulesOptions.value = res.data.results;
          }
        });
      }
    }
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

  return { treeData, treeLoading, rolesOptions, rulesOptions, onTreeSelect };
}
