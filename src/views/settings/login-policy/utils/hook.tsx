import {
  getCurrentInstance,
  h,
  reactive,
  ref,
  shallowRef,
  type Ref
} from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage } from "element-plus";
import { loginPolicyApi } from "@/api/system/security";
import { getDefaultAuths, hasAuth } from "@/router/utils";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { handleOperation, type OperationProps } from "@/components/RePlusPage";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import type { RecordType } from "plus-pro-components";
import AddFill from "~icons/ri/add-circle-line";
import Edit from "~icons/ep/edit";
import Search from "~icons/ep/search";
import LoginPolicyForm from "../components/LoginPolicyForm.vue";
import PolicyPreviewPanel from "../components/PolicyPreviewPanel.vue";

/**
 * 登录访问策略：策略 CRUD 走自定义弹窗（关闭框架默认新增/编辑按钮，
 * 因为 target_type / action 为 LabeledChoiceField，需要前端给选项与回显转换）；
 * 权限点本身不变（create / partialUpdate 仍按 hasAuth 判定入口可见性）。
 */
export function useLoginPolicy(tableRef: Ref) {
  const { t } = useI18n();

  const api = reactive(loginPolicyApi);
  const auth = reactive({
    create: false,
    update: false,
    preview: false,
    ...getDefaultAuths(getCurrentInstance(), ["preview"])
  });

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
          ElMessage.warning(t("loginPolicy.invalidForm"));
          closeLoading();
          return;
        }
        const request = row?.pk
          ? api.partialUpdate(row.pk, payload)
          : api.create(payload);
        handleOperation({
          t,
          apiReq: request.catch(error => ({
            code: -1,
            data: null,
            detail: String(error?.message ?? error)
          })),
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

  const tableBarButtonsProps = shallowRef<OperationProps>({
    buttons: [
      {
        text: t("loginPolicy.add"),
        code: "create-policy",
        props: { type: "primary", icon: useRenderIcon(AddFill) },
        onClick: () => openEdit(),
        show: () => hasAuth("create:SystemLoginPolicy")
      },
      {
        text: t("loginPolicy.preview"),
        code: "preview",
        props: { type: "info", plain: true, icon: useRenderIcon(Search) },
        onClick: () => openPreview(),
        show: Boolean(auth.preview)
      }
    ]
  });

  const operationButtonsProps = shallowRef<OperationProps>({
    width: 140,
    buttons: [
      {
        text: t("buttons.edit"),
        code: "edit-policy",
        props: { type: "primary", link: true, icon: useRenderIcon(Edit) },
        onClick: ({ row }) => openEdit(row),
        show: () => hasAuth("partialUpdate:SystemLoginPolicy")
      }
    ]
  });

  return { api, auth, tableBarButtonsProps, operationButtonsProps };
}
