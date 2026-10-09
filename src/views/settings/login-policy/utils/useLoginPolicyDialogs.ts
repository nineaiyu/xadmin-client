import { h, ref, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { handleOperation } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { loginPolicyApi } from "@/api/system/security";
import { normalizeError } from "@/utils/apiError";
import LoginPolicyForm from "../components/LoginPolicyForm.vue";
import PolicyPreviewPanel from "../components/PolicyPreviewPanel.vue";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 仅需弹窗写入动作面（reactive 包装后与 BaseApi 通用属性类型面不兼容，故取 Pick） */
type LoginPolicyApi = Pick<typeof loginPolicyApi, "create" | "partialUpdate">;

/**
 * 登录访问策略弹窗（自 login-policy/utils/hook 抽出）：新增/编辑（自定义表单，
 * 因 target_type / action 为 LabeledChoiceField，需要前端给选项与回显转换）
 * 与命中预演面板。
 */
export function useLoginPolicyDialogs({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: LoginPolicyApi;
  tableRef: Ref;
}) {
  const formRef = ref();

  const openEdit = (row?: RecordType) => {
    addDialog({
      title: row?.pk ? t("loginPolicy.editTitle") : t("loginPolicy.addTitle"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(LoginPolicyForm, { row, ref: formRef }),
      beforeSure: (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload?.();
        if (!payload) {
          // 校验失败原因已由表单内具体提示，这里只复位按钮 loading
          closeLoading();
          return;
        }
        const request = row?.pk
          ? api.partialUpdate(row.pk, payload)
          : api.create(payload);
        handleOperation({
          t,
          apiReq: request.catch(normalizeError),
          success() {
            done();
            tableRef.value?.handleGetData?.();
          },
          requestEnd: closeLoading
        });
      }
    });
  };

  const openPreview = () => {
    addDialog({
      title: t("loginPolicy.previewTitle"),
      width: dialogSize("lg"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      hideFooter: true,
      contentRenderer: () => h(PolicyPreviewPanel)
    });
  };

  return { openEdit, openPreview };
}
