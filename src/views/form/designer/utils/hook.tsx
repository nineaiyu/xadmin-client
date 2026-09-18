import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox, ElTag } from "element-plus";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type { OperationProps, PageTableColumn } from "@/components/RePlusPage";
import {
  dynamicFormApi,
  type DynamicFormItem,
  type FormField
} from "@/api/system/dform";
import DynamicFormForm from "../components/DynamicFormForm.vue";
import TemplatePickerDialog from "../components/TemplatePickerDialog.vue";

/**
 * 表单设计：定义 CRUD + 模板复用。
 *
 * - 新建/编辑走 ReDialog + DynamicFormForm（大尺寸设计器弹窗，字段表在表单内维护）；
 * - 模板：行内「存为模板」把当前定义复制为模板（is_template，创建权限即可）；
 *   「从模板新建」选择模板后预填设计器（权限与列表同口径）；
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

  const openDialog = (
    row: DynamicFormItem | null,
    prefill?: {
      name?: string;
      description?: string;
      schema?: { fields: FormField[] };
    }
  ) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("dform.edit") : t("dform.create"),
      width: dialogSize("lg"),
      top: "5vh",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(DynamicFormForm, { ref: formRef, row, prefill }),
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

  /* ---------------- 模板：从模板新建 / 存为模板 ---------------- */
  const openTemplatePicker = () => {
    const options = {
      title: t("dform.fromTemplate"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(TemplatePickerDialog, {
          onPick: (template: DynamicFormItem) => {
            closeDialog(options, 0);
            // 预填名称携带「副本」后缀，避免与模板重名（name 全局唯一）
            openDialog(null, {
              name: t("dform.templateCopyName", { name: template.name }),
              description: template.description,
              schema: template.schema
            });
          }
        })
    };
    addDialog(options);
  };

  const saveAsTemplate = async (row: DynamicFormItem) => {
    let name: string;
    try {
      const { value } = await ElMessageBox.prompt(
        t("dform.templateNameHint"),
        t("dform.saveAsTemplate"),
        {
          confirmButtonText: t("buttons.sure"),
          cancelButtonText: t("buttons.cancel"),
          inputValue: t("dform.templateNameDefault", { name: row.name }),
          inputValidator: (value: string) =>
            (value ?? "").trim() ? true : t("dform.templateNameRequired"),
          draggable: true
        }
      );
      name = (value ?? "").trim();
    } catch {
      return;
    }
    const res = await dynamicFormApi
      .create({
        name,
        description: row.description,
        schema: row.schema,
        is_template: true,
        is_active: false,
        approval_required: false,
        approval_flow: null
      })
      .catch(error => ({
        code: -1,
        detail: String((error as { detail?: string })?.detail ?? error)
      }));
    if (res.code === SUCCESS_CODE) {
      message(t("dform.templateSaved"), { type: "success" });
      return;
    }
    if (res.detail) message(String(res.detail), { type: "warning" });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    // 4 个按钮（框架「查看/删除」+ 编辑/存为模板）全部内联，避免折叠进「更多」
    showNumber: 4,
    width: 240,
    buttons: [
      {
        text: t("dform.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as DynamicFormItem),
        show: canEdit && 20
      },
      {
        text: t("dform.saveAsTemplate"),
        code: "template",
        props: { type: "primary", link: true },
        onClick: ({ row }) => saveAsTemplate(row as DynamicFormItem),
        show: canCreate && 10
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
      },
      {
        text: t("dform.fromTemplate"),
        code: "fromTemplate",
        props: { type: "primary", plain: true },
        onClick: openTemplatePicker,
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
