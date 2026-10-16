import { reactive, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { hasAuth, usePageAuth } from "@/router/utils";
import { dynamicFormApi } from "@/api/dataset/dform";
import { useDesignerColumns } from "./designerColumns";
import { createFormDialogOpener } from "./designerFormDialog";
import { createTemplateActions } from "./designerTemplate";
import { createHistoryOpener, useDesignerButtons } from "./designerButtons";

export { fetchFormDetail } from "./designerFormDialog";

/**
 * 表单设计：定义 CRUD + 模板复用 + schema 版本历史。
 *
 * - 新建/编辑走 ReDialog + DynamicFormForm（见 designerFormDialog.ts），
 *   列表行只回传 schema 字段数，编辑/存为模板/从模板新建经详情接口取 schema 全文；
 * - 模板：行内「存为模板」与「从模板新建」见 designerTemplate.ts；
 * - 版本：行内「版本」打开 schema 历史（查看/回滚，历史保留）见 designerButtons.ts；
 * - 删除保留框架默认入口；
 * - 列渲染（字段数 / 语义 tag）见 designerColumns.tsx。
 */
export function useFormDesigner(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(dynamicFormApi);
  const auth = usePageAuth("FormDesigner");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const flags = {
    canCreate: hasAuth("create:FormDesigner"),
    canEdit: hasAuth("partialUpdate:FormDesigner"),
    canHistory: hasAuth("schemaHistory:FormDesigner"),
    canRollback: hasAuth("rollback:FormDesigner")
  };

  const { listColumnsFormat, detailColumnsFormat } = useDesignerColumns({ t });
  const openDialog = createFormDialogOpener({ t, tableRef });
  const { openTemplatePicker, saveAsTemplate } = createTemplateActions({
    t,
    openDialog
  });
  const openHistory = createHistoryOpener({
    t,
    tableRef,
    canRollback: flags.canRollback
  });
  const { operationButtonsProps, tableBarButtonsProps } = useDesignerButtons({
    t,
    flags,
    actions: { openDialog, openHistory, saveAsTemplate, openTemplatePicker }
  });

  return {
    api,
    auth,
    listColumnsFormat,
    detailColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
