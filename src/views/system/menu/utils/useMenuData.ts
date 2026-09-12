import { message } from "@/utils/message";
import { useI18n } from "vue-i18n";
import type { Ref } from "vue";
import type { RecordType } from "plus-pro-components";
import { handleExportData, handleImportData } from "@/components/RePlusPage";
import { fetchMetaList, META_KEYS } from "@/utils/metaCache";
import { handleTree } from "@/utils/tree";
import type { menuApi } from "@/api/system/menu";
import type { Reactive } from "vue";

/** 菜单数据加载与增删：列表/字典/接口清单拉取、单删/批删、导入导出（拆分自 hook.tsx） */
export function useMenuData({
  api,
  auth,
  loading,
  treeData,
  choicesDict,
  menuUrlList
}: {
  api: Reactive<typeof menuApi>;
  auth: { apiUrl?: boolean };
  loading: Ref<boolean>;
  treeData: Ref<unknown[]>;
  choicesDict: Ref<RecordType>;
  menuUrlList: Ref<RecordType[]>;
}) {
  const { t } = useI18n();

  const getMenuApiList = () => {
    if (auth.apiUrl) {
      api.apiUrl().then(res => {
        if (res.code === 1000) {
          menuUrlList.value = res.data;
        }
      });
    }

    api.choices().then(res => {
      if (res.code === 1000) {
        choicesDict.value = res.choices_dict;
      }
    });
  };

  const getMenuData = () => {
    loading.value = true;
    // 菜单页是菜单全量列表的权威刷新方：强制拉取并回填共享缓存（force），
    // 供角色页 / 权限页直接复用，避免切页重复拉同一份数据
    fetchMetaList(META_KEYS.menu, () => api.list({ page: 1, size: 1000 }), {
      force: true
    })
      .then(res => {
        if (res.code === 1000) {
          const results = res.data.results;
          results.forEach(item => {
            item.menu_type = item.menu_type?.value ?? item.menu_type;
            item.parent = item.parent?.pk ?? item.parent;
          });
          treeData.value = handleTree(results);
        } else {
          // 业务失败（权限不足/服务异常）给出反馈，避免只看到空白树
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        loading.value = false;
      })
      .catch(() => {
        // HTTP 层已提示具体错误，这里只负责收敛加载态
        loading.value = false;
      });
  };

  const handleDelete = row => {
    api.destroy(row.pk).then(res => {
      if (res.code === 1000) {
        message(t("results.success"), { type: "success" });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  const handleManyDelete = val => {
    const manyPks = val!.getCheckedKeys(false);
    if (manyPks.length === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    api.batchDestroy(manyPks).then(res => {
      if (res.code === 1000) {
        message(t("results.batchDestroy", { count: manyPks.length }), {
          type: "success"
        });
        getMenuData();
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
    });
  };

  const exportData = val => {
    const pks = val!.getCheckedKeys(false);
    handleExportData({ t, pks, api, allowTypes: ["selected", "all"] });
  };

  // 数据导入
  const importData = () => {
    handleImportData({
      t,
      api,
      success: () => {
        getMenuData();
      }
    });
  };

  return {
    getMenuApiList,
    getMenuData,
    handleDelete,
    handleManyDelete,
    exportData,
    importData
  };
}
