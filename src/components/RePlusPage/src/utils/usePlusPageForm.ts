import type { Ref } from "vue";
import type { BaseApi } from "@/api/base";
import type { useI18n } from "vue-i18n";
import type { RePlusPageProps } from "./types";
import type { useBaseColumns } from "./columns";
import type { PlusPageFormApi } from "./plusPageFormApi";
import { createDeleteActions } from "./plusPageDelete";
import { createDetailAction } from "./plusPageDetail";
import { createAddOrEditAction } from "./plusPageEdit";

type TFunction = ReturnType<typeof useI18n>["t"];
type BaseColumnsReturn = ReturnType<typeof useBaseColumns>;

/**
 * 表单与详情：新增/编辑弹层、详情、删除与批量删除的组装入口。
 * 各自实现见 plusPageEdit.ts / plusPageDetail.ts / plusPageDelete.ts。
 */
export function usePlusPageForm({
  props,
  t,
  pageTitle,
  detailColumns,
  addOrEditColumns,
  addOrEditRules,
  addOrEditDefaultValue,
  selectedNum,
  onSelectionCancel,
  getSelectPks,
  handleGetData
}: {
  props: RePlusPageProps;
  t: TFunction;
  pageTitle: { value: string };
  detailColumns: BaseColumnsReturn["detailColumns"];
  addOrEditColumns: BaseColumnsReturn["addOrEditColumns"];
  addOrEditRules: BaseColumnsReturn["addOrEditRules"];
  addOrEditDefaultValue: BaseColumnsReturn["addOrEditDefaultValue"];
  selectedNum: Ref<number>;
  onSelectionCancel: () => void;
  getSelectPks: (key?: string) => (string | number)[];
  handleGetData: (queryParams?: object) => void;
}) {
  const { api: rawApi } = props;
  // 表单动作所需的 API 面：页面装配保证存在（调用点均受权限点控制），
  // 这里显式收窄类型避免逐处判空（行为不变：缺方法时与原先一样抛错）
  const api = rawApi as PlusPageFormApi;

  const { handleDelete, handleManyDelete } = createDeleteActions({
    rawApi: rawApi as BaseApi,
    api,
    t,
    selectedNum,
    getSelectPks,
    onSelectionCancel,
    handleGetData
  });

  const handleDetail = createDetailAction({ props, t, detailColumns });

  const handleAddOrEdit = createAddOrEditAction({
    props,
    api,
    t,
    pageTitle,
    addOrEditColumns,
    addOrEditRules,
    addOrEditDefaultValue,
    handleGetData
  });

  return { handleAddOrEdit, handleDetail, handleDelete, handleManyDelete };
}
