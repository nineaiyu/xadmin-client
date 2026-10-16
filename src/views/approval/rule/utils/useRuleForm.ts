import { h, shallowRef, type Ref, type UnwrapNestedRefs } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { handleOperation } from "@/components/RePlusPage";
import type { approvalRuleApi } from "@/api/approval/approvalRule";
import RuleForm from "../components/RuleForm.vue";

/** 审批规则新建/编辑弹窗编排；自 utils/hook 拆出，行为不变 */
export function useRuleForm({
  api,
  tableRef
}: {
  api: UnwrapNestedRefs<typeof approvalRuleApi>;
  tableRef: Ref;
}) {
  const { t } = useI18n();
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

  return { openForm };
}
