import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { tagApi, type TagItem } from "@/api/system/tag";
import { useTagColumns } from "./tagColumns";
import { useTagButtons } from "./tagButtons";
import { openTagDialog } from "./tagDialog";

/**
 * 标签中心表格：标签 CRUD + 使用计数 + 删除保护提示。
 *
 * - 新建/编辑关闭框架默认表单按钮，统一走 ReDialog + TagForm（C5 方案 B）；
 * - 删除保留框架默认入口（自带二次确认）；被引用的标签由后端拒绝并给出可读文案；
 * - 颜色列的色块 tag 渲染见 tagColumns.tsx。
 */
export function useTags(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(tagApi);
  const auth = usePageAuth("Tag");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:Tag");
  const canEdit = hasAuth("partialUpdate:Tag");

  const refresh = () => tableRef.value?.handleGetData();

  const { listColumnsFormat } = useTagColumns({ t });

  const { tableBarButtonsProps, operationButtonsProps } = useTagButtons({
    t,
    canCreate,
    canEdit,
    openDialog: (row: TagItem | null) => openTagDialog({ t, refresh, row })
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
