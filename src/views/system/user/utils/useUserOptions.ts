import { onMounted, ref } from "vue";

import { dataPermissionApi } from "@/api/system/permission";
import { deptApi } from "@/api/system/dept";
import { roleApi } from "@/api/system/role";
import { hasAuth } from "@/router/utils";
import { handleTree } from "@/utils/tree";
import type { Ref } from "vue";

/** 用户视图下拉/树选项：部门树、角色、数据权限（empower 权限控制可见性） */
export function useUserOptions(auth: { empower: boolean }, tableRef: Ref) {
  const treeData = ref([]);
  const treeLoading = ref(true);
  const rolesOptions = ref([]);
  const rulesOptions = ref([]);

  onMounted(() => {
    if (auth.empower) {
      if (hasAuth("list:SystemRole")) {
        roleApi.list({ page: 1, size: 1000 }).then(res => {
          if (res.code === 1000 && res.data) {
            rolesOptions.value = res.data.results;
          }
        });
      }
      if (hasAuth("list:SystemDataPermission")) {
        dataPermissionApi
          .list({
            page: 1,
            size: 1000
          })
          .then(res => {
            if (res.code === 1000 && res.data) {
              rulesOptions.value = res.data.results;
            }
          });
      }
    }
    // 部门列表
    if (hasAuth("list:SystemDept")) {
      deptApi.list({ page: 1, size: 1000 }).then(res => {
        if (res.code === 1000 && res.data) {
          treeData.value = handleTree(res.data.results);
        }
      });
    }
    treeLoading.value = false;
  });

  function onTreeSelect({ pk, selected }) {
    tableRef.value.handleGetData({ dept: selected ? pk : "", page: 1 });
  }

  return { treeData, treeLoading, rolesOptions, rulesOptions, onTreeSelect };
}
