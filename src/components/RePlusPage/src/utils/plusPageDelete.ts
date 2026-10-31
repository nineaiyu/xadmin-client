import { message } from "@/utils/message";
import { handleOperation } from "./handle";
import { confirmImpact } from "./impact";
import { ref, type Ref } from "vue";
import type { BaseApi } from "@/api/base";
import type { PlusPageFormApi } from "./plusPageFormApi";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 删除与批量删除（自 usePlusPageForm.ts 抽出），均含影响面预检 */
export function createDeleteActions({
  rawApi,
  api,
  t,
  selectedNum,
  getSelectPks,
  onSelectionCancel,
  handleGetData
}: {
  rawApi: Partial<BaseApi>;
  api: PlusPageFormApi;
  t: TFunction;
  selectedNum: Ref<number>;
  getSelectPks: (key?: string) => (string | number)[];
  onSelectionCancel: () => void;
  handleGetData: (queryParams?: object) => void;
}) {
  const handleDelete = async (
    row: { pk?: string | number; id?: string | number },
    requestEnd?: (options?: object) => void
  ) => {
    const pk = (row?.pk ?? row?.id) as string | number;
    // 影响面预检：有引用先弹窗确认；取消时收尾按钮 loading
    if (!(await confirmImpact(rawApi as BaseApi, [pk], t))) {
      requestEnd?.();
      return;
    }
    handleOperation({
      t,
      apiReq: api.destroy(pk, { impact_confirmed: true }),
      success() {
        handleGetData();
      },
      requestEnd
    });
  };

  /** 批量删除请求中的 loading（影响面预检 → 请求结束全程），防重复点击 */
  const batchDeleteLoading = ref(false);

  const handleManyDelete = async () => {
    if (selectedNum.value === 0) {
      message(t("results.noSelectedData"), { type: "error" });
      return;
    }
    if (batchDeleteLoading.value) return;
    const pks = getSelectPks("pk");
    batchDeleteLoading.value = true;
    if (!(await confirmImpact(rawApi as BaseApi, pks, t))) {
      batchDeleteLoading.value = false;
      return;
    }

    handleOperation({
      t,
      apiReq: api.batchDestroy(pks, { impact_confirmed: true }),
      requestEnd() {
        batchDeleteLoading.value = false;
      },
      success(res) {
        const failures =
          (res?.data as { failures?: Array<{ pk: string; detail: string }> })
            ?.failures ?? [];
        if (failures.length) {
          message(
            t("results.batchPartial", {
              n: failures.length,
              detail: failures
                .slice(0, 3)
                .map(item => `${String(item.pk).slice(0, 8)}: ${item.detail}`)
                .join("；")
            }),
            { type: "warning" }
          );
        }
        onSelectionCancel();
        handleGetData();
      }
    });
  };

  return { handleDelete, handleManyDelete, batchDeleteLoading };
}
