import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { handleOperation } from "@/components/RePlusPage";
import AddFill from "~icons/ri/add-circle-line";
import CircleCheck from "~icons/ep/circle-check";
import CircleClose from "~icons/ep/circle-close";
import Refresh from "~icons/ep/refresh";
import { clearDictCache } from "@/utils/dict";
import type { OperationButtonsRow } from "@/components/RePlusPage";
import type { BaseResult } from "@/api/types";
import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 工具栏动作所需的字典 API 面（结构声明，避免直连 @/api/system/dict） */
type DictToolbarApi = {
  batchActive: (
    pks: Array<string | number>,
    isActive?: boolean
  ) => Promise<BaseResult>;
  refreshCache: () => Promise<BaseResult>;
};

/**
 * 字典工具栏按钮（自 hook.tsx 抽出）：新增类型（覆盖内建 create，parent 留空
 * 即字典类型）+ 批量启用/停用（同一工厂）+ 刷新缓存 + 批量更新。
 */
export function buildDictToolbarButtons({
  t,
  api,
  auth,
  tableRef,
  refresh,
  getSelectedPks,
  batchUpdateButton
}: {
  t: TFunction;
  api: DictToolbarApi;
  auth: { create?: boolean; batchActive?: boolean; refreshCache?: boolean };
  tableRef: Ref;
  refresh: () => void;
  getSelectedPks: () => Array<string | number> | null | undefined;
  batchUpdateButton: OperationButtonsRow;
}): OperationButtonsRow[] {
  /** 批量启停按钮工厂：启用/停用仅差布尔参数、文案与配色，取数与回执链路共用一份 */
  const batchActiveButton = (
    active: boolean,
    index: number
  ): OperationButtonsRow => ({
    text: t(active ? "dataDict.batchActive" : "dataDict.batchInactive"),
    code: active ? "batchActive" : "batchInactive",
    confirm: {
      title: t(
        active ? "dataDict.batchActiveConfirm" : "dataDict.batchInactiveConfirm"
      )
    },
    props: {
      type: active ? "success" : "warning",
      icon: useRenderIcon(active ? CircleCheck : CircleClose),
      plain: true
    },
    onClick: ({ loading }) => {
      const pks = getSelectedPks();
      if (!pks) return;
      loading.value = true;
      handleOperation({
        t,
        apiReq: api.batchActive(pks, active),
        success() {
          refresh();
        },
        requestEnd() {
          loading.value = false;
        }
      });
    },
    show: auth.batchActive,
    index
  });

  return [
    {
      text: t("dataDict.addType"),
      code: "create",
      props: { type: "primary", icon: useRenderIcon(AddFill) },
      onClick: () => tableRef.value?.handleAddOrEdit(true, {}),
      show: auth.create,
      index: -30
    },
    batchActiveButton(true, 1),
    batchActiveButton(false, 2),
    {
      text: t("dataDict.refreshCache"),
      code: "refreshCache",
      props: { type: "info", icon: useRenderIcon(Refresh), plain: true },
      onClick: ({ loading }) => {
        loading.value = true;
        handleOperation({
          t,
          apiReq: api.refreshCache(),
          success() {
            // 同步清空前端进程内字典缓存：否则其他页面在 5 分钟 TTL 内仍读旧字典
            // （成功提示由 handleOperation 统一给出，重复 message 会弹两次）
            clearDictCache();
          },
          requestEnd() {
            loading.value = false;
          }
        });
      },
      show: auth.refreshCache,
      index: 3
    },
    batchUpdateButton
  ];
}
