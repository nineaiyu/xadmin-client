import type { Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { ApiResult } from "@/api/types";
import { message } from "@/utils/message";
import { handleOperation } from "@/components/RePlusPage";
import type { DictRow } from "./types";

type TFunction = ReturnType<typeof useI18n>["t"];
/** 同层排序接口形状（api 由 useDataDict 注入 reactive 后的 dataDictApi，避免直连字典 API） */
type DictApiLike = {
  move: (pk: string | number, direction: "up" | "down") => Promise<ApiResult>;
};

/**
 * 数据字典行内动作：同层排序与「新增子项」预填。
 * 自 useDataDict 拆出（行为不变）：onMove 走服务端整层重排，onAddChild
 * 复用 CRUD 弹窗并预填所属类型（必须为 {pk,label} 对象以正确回显）。
 */
export function useDictRowActions({
  t,
  api,
  tableRef
}: {
  t: TFunction;
  api: DictApiLike;
  tableRef: Ref;
}) {
  const refresh = () => tableRef.value?.handleGetData();

  /** 勾选行主键，空勾选时给出提示并返回 null */
  const getSelectedPks = (): Array<string | number> | null => {
    const pks = tableRef.value?.getSelectPks("pk") ?? [];
    if (!pks.length) {
      message(t("results.noSelectedData"), { type: "error" });
      return null;
    }
    return pks;
  };

  /** 同层上移/下移：服务端按 sort 重排整层（跨分页也成立），成功后刷新列表 */
  const onMove = (
    row: DictRow,
    direction: "up" | "down",
    loading?: { value: boolean }
  ) => {
    if (loading) loading.value = true;
    handleOperation({
      t,
      apiReq: api.move(row?.pk as string | number, direction),
      success() {
        refresh();
      },
      requestEnd() {
        if (loading) loading.value = false;
      }
    });
  };

  /** 行内「新增子项」：仅类型行可用，复用 CRUD 弹窗并预填所属类型。
   * 预填值必须是与编辑态一致的 {pk,label} 对象（列表行 parent 即此形态），
   * 传字符串 pk 时下拉回显会裸显 uuid 而匹配不到类型选项 */
  const onAddChild = (row: DictRow) =>
    tableRef.value?.handleAddOrEdit(true, {
      parent: row?.pk ? { pk: row.pk, label: row.label } : undefined
    });

  return {
    refresh,
    getSelectedPks,
    onMove,
    onAddChild
  };
}
