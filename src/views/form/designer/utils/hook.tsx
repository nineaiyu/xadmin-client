import { SUCCESS_CODE } from "@/api/types";
import { h, reactive, ref, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox, ElTag } from "element-plus";
import { addDialog, closeDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { hasAuth, usePageAuth } from "@/router/utils";
import { message } from "@/utils/message";
import type {
  OperationProps,
  PageColumn,
  PageTableColumn
} from "@/components/RePlusPage";
import { formatPageColumns } from "@/components/RePlusPage";
import {
  designerApi,
  dynamicFormApi,
  type DynamicFormItem,
  type FormSchema
} from "@/api/dataset/dform";
import DynamicFormForm from "../components/DynamicFormForm.vue";
import SchemaHistoryDialog from "../components/SchemaHistoryDialog.vue";
import TemplatePickerDialog from "../components/TemplatePickerDialog.vue";

/**
 * 表单设计：定义 CRUD + 模板复用 + schema 版本历史。
 *
 * - 新建/编辑走 ReDialog + DynamicFormForm（大尺寸设计器弹窗，字段表在表单内维护）；
 *   列表行只回传 schema 字段数，编辑/存为模板/从模板新建经详情接口取 schema 全文；
 * - 模板：行内「存为模板」把当前定义复制为模板（is_template，创建权限即可）；
 *   「从模板新建」选择模板后预填设计器（权限与列表同口径）；
 * - 版本：行内「版本」打开 schema 历史（查看/回滚；回滚生成新版本，历史保留）；
 * - 删除保留框架默认入口；
 * - schema 列渲染「字段数」；is_active / approval_required 渲染为语义 tag
 *   （覆盖框架对 boolean 列的自动开关渲染，与迁移前标签口径一致）；
 *   详情抽屉不渲染 schema 列（列表行不含 schema 全文）。
 */
export function useFormDesigner(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(dynamicFormApi);
  const auth = usePageAuth("FormDesigner");
  auth.create = false;
  auth.update = false;
  auth.partialUpdate = false;
  const canCreate = hasAuth("create:FormDesigner");
  const canEdit = hasAuth("partialUpdate:FormDesigner");
  const canHistory = hasAuth("schemaHistory:FormDesigner");
  const canRollback = hasAuth("rollback:FormDesigner");

  const listColumnsFormat = (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      schema: column => {
        column["cellRenderer"] = ({ row }) =>
          h("span", String((row as DynamicFormItem).schema_fields_count ?? 0));
      },
      is_active: column => {
        column["cellRenderer"] = ({ row }) => {
          const active = (row as DynamicFormItem).is_active;
          return h(
            ElTag,
            { size: "small", type: active ? "success" : "info" },
            () => (active ? t("dform.active") : t("dform.inactive"))
          );
        };
      },
      approval_required: column => {
        column["cellRenderer"] = ({ row }) => {
          const required = (row as DynamicFormItem).approval_required;
          return h(
            ElTag,
            { size: "small", type: required ? "warning" : "info" },
            () => (required ? t("dform.approvalOn") : t("dform.approvalOff"))
          );
        };
      }
    });

  /* ---------------- 新建 / 编辑（ReDialog + DynamicFormForm） ---------------- */
  const formRef = ref<InstanceType<typeof DynamicFormForm>>();

  /** 编辑取原文：列表行不含 schema 全文，按主键取详情；失败返回 null（调用方中止） */
  const fetchFormDetail = async (pk: string) => {
    const res = await designerApi.retrieveForm(pk).catch(() => null);
    return res?.code === SUCCESS_CODE && res.data ? res.data : null;
  };

  const openDialog = async (
    row: DynamicFormItem | null,
    prefill?: {
      name?: string;
      description?: string;
      schema?: FormSchema;
    }
  ) => {
    // 编辑前补全 schema 全文（列表行只带字段数）：取详情失败即中止打开，
    // 缺字段的 schema 一经保存会破坏表单定义
    let source = row;
    if (row) {
      const detail = await fetchFormDetail(row.pk);
      if (!detail?.schema) {
        message(t("results.failed"), { type: "warning" });
        return;
      }
      source = detail;
    }
    formRef.value = undefined;
    addDialog({
      title: source ? t("dform.edit") : t("dform.create"),
      width: dialogSize("lg"),
      top: "5vh",
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(DynamicFormForm, { ref: formRef, row: source, prefill }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          source
            ? dynamicFormApi.partialUpdate(source.pk, payload)
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
            // 模板行经详情取回 schema 全文后才回调（见 TemplatePickerDialog.pick）
            if (!template.schema) return;
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
    // 列表行不含 schema 全文：先取详情再复制为模板（与编辑同口径）
    const source = await fetchFormDetail(row.pk);
    if (!source?.schema) {
      message(t("results.failed"), { type: "warning" });
      return;
    }
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
        description: source.description,
        schema: source.schema,
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

  /** 「版本」入口：schema 历史查看与回滚（行级主键可用，独立于设计器弹窗） */
  const openHistory = (row: DynamicFormItem) => {
    addDialog({
      title: t("dform.historyTitle", { name: row.name }),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () =>
        h(SchemaHistoryDialog, {
          row,
          canRollback,
          onDone: () => tableRef.value?.handleGetData()
        })
    });
  };

  const operationButtonsProps = shallowRef<OperationProps>({
    // 5 个按钮（框架「查看/删除」+ 编辑/版本/存为模板）全部内联，避免折叠进「更多」
    showNumber: 5,
    width: 320,
    buttons: [
      {
        text: t("dform.edit"),
        code: "edit",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openDialog(row as DynamicFormItem),
        show: canEdit && 20
      },
      {
        text: t("dform.history"),
        code: "history",
        props: { type: "primary", link: true },
        onClick: ({ row }) => openHistory(row as DynamicFormItem),
        show: canHistory && 15
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

  /** 详情抽屉不渲染 schema 列：列表行不含 schema 全文（只带字段数），避免空行 */
  const detailColumnsFormat = (columns: PageColumn[]) =>
    columns.filter(column => column._column?.key !== "schema");

  return {
    api,
    auth,
    listColumnsFormat,
    detailColumnsFormat,
    operationButtonsProps,
    tableBarButtonsProps
  };
}
