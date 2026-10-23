import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { useDialogForm } from "@/hooks/useDialogForm";
import {
  apiApplicationApi,
  type ApiApplicationGrant,
  type ApiApplicationItem
} from "@/api/identity/open";
import ApiAppGrantsDialog from "../components/ApiAppGrantsDialog.vue";

/** 应用资源授权独立弹窗：只改授权，不提交主记录 PATCH */
export function useApiAppGrantsDialog({
  t,
  refresh
}: {
  t: ReturnType<typeof useI18n>["t"];
  refresh: () => void;
}) {
  const formRef = ref<InstanceType<typeof ApiAppGrantsDialog>>();

  const openGrants = (row: ApiApplicationItem) => {
    const { beforeSure } = useDialogForm<ApiApplicationGrant[]>({
      formRef,
      submit: payload => apiApplicationApi.updateGrants(row.pk, payload),
      successText: t("apiApp.grant.saved"),
      onSuccess: refresh
    });
    addDialog({
      title: t("apiApp.grant.manageTitle", { name: row.name }),
      width: dialogSize("xxl"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () =>
        h(ApiAppGrantsDialog, { ref: formRef, applicationPk: row.pk }),
      beforeSure
    });
  };

  return { openGrants };
}
