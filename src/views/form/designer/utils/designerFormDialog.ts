import { computed, h, ref } from "vue";
import { addDialog } from "@/components/ReDialog";
import { useDesignerGuard } from "@/hooks/useDesignerGuard";
import { dialogSize } from "@/components/ReDialog/size";
import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { useDialogForm } from "@/hooks/useDialogForm";
import { designerApi, dynamicFormApi } from "@/api/dataset/dform";
import DynamicFormForm from "../components/DynamicFormForm.vue";
import type { DynamicFormItem, FormSchema } from "@/api/dataset/dform";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 编辑取原文：列表行不含 schema 全文，按主键取详情；失败返回 null（调用方中止） */
export async function fetchFormDetail(pk: string) {
  const res = await designerApi.retrieveForm(pk).catch(() => null);
  return res && isSuccess(res) && res.data ? res.data : null;
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
  const { confirmLeave } = useDesignerGuard({
    dirty: computed(() => Boolean(formRef.value?.isDirty)),
    namespace: "dform",
    mode: "dialog"
  });

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
    // 显式指定载荷泛型：ref 包装的实例类型无法从 getPayload 返回类型反推（TS 退化 unknown）
    const { beforeSure } = useDialogForm<Record<string, unknown>>({
      formRef,
      submit: payload =>
        source
          ? dynamicFormApi.partialUpdate(source.pk, payload)
          : dynamicFormApi.create(payload),
      successText: t("dform.saveOk"),
      // 先关弹窗再刷新列表，避免刷新耗时导致弹窗滞留（useDialogForm 内 done 先于回调）
      onSuccess: () => tableRef.value?.handleGetData()
    });
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
      beforeSure,
      beforeClose: done => {
        if (!formRef.value?.isDirty) return done();
        void confirmLeave().then(ok => {
          if (ok) done();
        });
      }
    });
  };
}
