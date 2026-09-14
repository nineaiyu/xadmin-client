import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import { dynamicFormApi, type DynamicFormItem } from "@/api/system/dform";
import DynamicFormForm from "../components/DynamicFormForm.vue";

/**
 * 表单设计：定义 CRUD。
 *
 * - 新建/编辑走 ReDialog + DynamicFormForm（大尺寸设计器弹窗，字段表在表单内维护）；
 * - 删除保留框架默认入口；
 * - schema 列渲染「字段数」；is_active / approval_required 渲染为语义 tag
 *   （覆盖框架对 boolean 列的自动开关渲染，与迁移前标签口径一致）。
 */
export function useFormDesigner(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(dynamicFormApi);
  const auth = reactive({
    ...getDefaultAuths("FormDesigner"),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:FormDesigner");
  const canEdit = hasAuth("partialUpdate:FormDesigner");

  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "schema":
          column["cellRenderer"] = ({ row }) =>
            h(
              "span",
              String(((row as DynamicFormItem).schema?.fields ?? []).length)
            );
          break;
        case "is_active":
          column["cellRenderer"] = ({ row }) => {
            const active = (row as DynamicFormItem).is_active;
            return h(
              ElTag,
              { size: "small", type: active ? "success" : "info" },
              () => (active ? t("dform.active") : t("dform.inactive"))
            );
          };
          break;
        case "approval_required":
          column["cellRenderer"] = ({ row }) => {
            const required = (row as DynamicFormItem).approval_required;
            return h(
              ElTag,
              { size: "small", type: required ? "warning" : "info" },
              () => (required ? t("dform.approvalOn") : t("dform.approvalOff"))
            );
          };
          break;
      }
    });
    return columns;
  };

  /* ---------------- 新建 / 编辑（ReDialog + DynamicFormForm） ---------------- */
  const formRef = ref<InstanceType<typeof DynamicFormForm>>();

  const openDialog = (row: DynamicFormItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("dform.edit") : t("dform.create"),
      width: dialogSize("lg"),
      top: "5vh",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(DynamicFormForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? dynamicFormApi.partialUpdate(row.pk, payload)
            : dynamicFormApi.create(payload)
        ).catch(error => ({
          code: -1,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          message(t("dform.saveOk"), { type: "success" });
          // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留
          done();
          tableRef.value?.handleGetData();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 160,
    buttons: [
      {
        text: t("dform.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as DynamicFormItem),
        show: canEdit && 10
      }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("dform.create"),
        code: "create",
        props: { type: "primary" },
        onClick: () => openDialog(null),
        show: canCreate
      }
    ]
  });

  return {
    api,
    auth,
    listColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
