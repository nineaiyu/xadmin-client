import { SUCCESS_CODE } from "@/api/types";
import { h, ref } from "vue";
import type { useI18n } from "vue-i18n";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { message } from "@/utils/message";
import {
  apiApplicationApi,
  type ApiApplicationCredential,
  type ApiApplicationItem
} from "@/api/system/open";
import ApiApplicationForm from "../components/ApiApplicationForm.vue";

/** 新建/编辑弹窗（ReDialog + ApiApplicationForm）：保存后同步资源授权（全量替换端点） */
export function useApiAppDialog({
  t,
  refresh,
  openCredential
}: {
  t: ReturnType<typeof useI18n>["t"];
  refresh: () => void;
  openCredential: (data: ApiApplicationCredential) => void;
}) {
  const formRef = ref<InstanceType<typeof ApiApplicationForm>>();

  const openDialog = (row: ApiApplicationItem | null) => {
    formRef.value = undefined;
    addDialog({
      title: row ? t("apiApp.edit") : t("apiApp.create"),
      width: dialogSize("md"),
      draggable: true,
      destroyOnClose: true,
      closeOnClickModal: false,
      sureBtnLoading: true,
      contentRenderer: () => h(ApiApplicationForm, { ref: formRef, row }),
      beforeSure: async (done, { closeLoading }) => {
        const payload = formRef.value?.getPayload();
        if (!payload) {
          closeLoading();
          return;
        }
        // 异常归一为可读失败结果：避免请求异常时 beforeSure 抛错、弹窗 loading 悬挂
        const res = await (
          row
            ? apiApplicationApi.partialUpdate(row.pk, payload)
            : apiApplicationApi.create(payload)
        ).catch(error => ({
          code: -1,
          data: null,
          detail: String((error as { detail?: string })?.detail ?? error)
        }));
        if (res.code === SUCCESS_CODE) {
          // 资源授权为独立端点（全量替换）：加载失败时跳过，绝不覆盖为空
          const grants = formRef.value?.getGrants();
          const targetPk =
            row?.pk ?? (res.data as { pk?: string } | null)?.pk ?? "";
          let grantsSaveFailed = false;
          if (grants === null || grants === undefined) {
            message(t("apiApp.grant.loadFailed"), { type: "warning" });
          } else if (targetPk) {
            const grantRes = await apiApplicationApi
              .updateGrants(targetPk, grants)
              .catch(error => ({
                code: -1,
                detail: String((error as { detail?: string })?.detail ?? error)
              }));
            if (grantRes.code !== SUCCESS_CODE) {
              grantsSaveFailed = true;
              message(String(grantRes.detail || t("apiApp.grant.saveFailed")), {
                type: "warning"
              });
            }
          }
          // 授权同步失败时不弹「保存成功」：避免误导第三方权限已生效
          // （主记录已落库，弹窗仍关闭，可重新进入编辑重试授权）
          if (!grantsSaveFailed) {
            message(t("apiApp.saveOk"), { type: "success" });
          }
          // 先关表单弹窗，一次性密钥弹窗紧接展示（列表/详情不回传明文）
          done();
          const created = res.data as ApiApplicationCredential | undefined;
          if (!row && created?.client_secret) {
            openCredential(created);
          }
          refresh();
          return;
        }
        if (res.detail) message(String(res.detail), { type: "warning" });
        closeLoading();
      }
    });
  };

  return { openDialog };
}
