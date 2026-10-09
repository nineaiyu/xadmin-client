import { h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { dialogSize } from "@/components/ReDialog/size";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { designerApi, dynamicFormApi } from "@/api/dataset/dform";
import DynamicFormForm from "../components/DynamicFormForm.vue";
import type { DynamicFormItem, FormSchema } from "@/api/dataset/dform";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 编辑取原文：列表行不含 schema 全文，按主键取详情；失败返回 null（调用方中止） */
export async function fetchFormDetail(pk: string) {
  const res = await designerApi.retrieveForm(pk).catch(() => null);
  return res?.code === SUCCESS_CODE && res.data ? res.data : null;
}

/**
 * 表单新建/编辑弹窗（自 hook.tsx 抽出）：大尺寸设计器弹窗，字段表在表单内维护；
 * 编辑前补全 schema 全文，取详情失败即中止打开（缺字段的 schema 一经保存会
 * 破坏表单定义）。
 */
export function createFormDialogOpener({
  t,
  tableRef
}: {
  t: TFunction;
  tableRef: Ref;
}) {
  const formRef = ref<InstanceType<typeof DynamicFormForm>>();

  return async (
    row: DynamicFormItem | null,
    prefill?: {
      name?: string;
      description?: string;
      schema?: FormSchema;
    }
  ) => {
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
        ).catch(normalizeError);
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
}
