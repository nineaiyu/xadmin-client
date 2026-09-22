import { h, reactive, shallowRef, type Ref } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { approvalRuleApi } from "@/api/system/approvalRule";
import {
  handleOperation,
  type OperationProps,
  type PageTableColumn
} from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import RuleForm from "../components/RuleForm.vue";
import EditPen from "~icons/ep/edit-pen";
import AddFill from "~icons/ri/add-circle-line";

/**
 * 审批规则页（多级审批链配置）：
 *
 * - 命中路径正则的敏感操作按级次逐级审批（一级通过后才通知下一级）；
 * - 新建/编辑走 ReDialog + RuleForm（级次子表在表单内维护顺序）；
 * - 删除保留框架默认入口（带二次确认）；
 * - 规则改动只影响之后新建的审批单（在途单按建单快照推进），因此无需「在途锁」。
 */
export function useApprovalRule(tableRef: Ref) {
  const { t } = useI18n();
  const api = reactive(approvalRuleApi);
  // 关闭默认 create/update/partialUpdate 按钮（走自定义按钮组与权限码），
  // 同时使 boolean 列的自动 switch 只读（启用状态经由编辑弹窗修改）
  const auth = reactive({
    ...getDefaultAuths("SystemApprovalRule", []),
    create: false,
    update: false,
    partialUpdate: false
  });
  const canCreate = hasAuth("create:SystemApprovalRule");
  const canEdit = hasAuth("partialUpdate:SystemApprovalRule");
  const formRef = shallowRef<InstanceType<typeof RuleForm>>();

  /** 新建/编辑弹窗：先 done() 关弹窗再刷新列表（先刷新后关闭会滞留，webkit 复现） */
  const openForm = (row?: RecordType) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("approvalRule.editTitle") : t("approvalRule.createTitle"),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(RuleForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = await formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        handleOperation({
          t,
          apiReq: row
            ? api.partialUpdate(row.pk, payload)
            : api.create(payload),
          success: () => {
            done();
            tableRef.value?.handleGetData();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  /** 行内：编辑 / 删除（删除走框架默认入口，带二次确认） */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [
      {
        text: t("buttons.edit"),
        code: "update",
        props: {
          type: "primary",
          icon: useRenderIcon(EditPen),
          link: true
        },
        onClick: ({ row }) => openForm(row),
        show: canEdit ? -30 : false
      },
      { code: "detail", show: false }
    ]
  });

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("approvalRule.createTitle"),
        code: "create",
        props: {
          type: "primary",
          icon: useRenderIcon(AddFill)
        },
        onClick: () => openForm(),
        show: canCreate ? -30 : false
      }
    ]
  });

  /** 列表列：路径清单拼接展示、级次数与启用状态可读化 */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      switch (column._column?.key) {
        case "path_patterns":
          column["minWidth"] = 240;
          column["cellRenderer"] = ({ row }) =>
            ((row?.path_patterns ?? []) as string[]).join(" ； ") || "-";
          break;
        case "level_count":
          column["width"] = 90;
          column["cellRenderer"] = ({ row }) =>
            t("approvalRule.levelCount", { n: Number(row?.level_count ?? 0) });
          break;
        case "remark":
          column["minWidth"] = 160;
          break;
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    operationButtonsProps,
    tableBarButtonsProps,
    listColumnsFormat
  };
}
