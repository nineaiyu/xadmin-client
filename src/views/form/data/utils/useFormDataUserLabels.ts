import { reactive, watch } from "vue";
import {
  formDataApi,
  type FormDataItem,
  type FormField
} from "@/api/dataset/dform";
import { collectUserPks, userLabelText } from "./userData";
import type { Ref } from "vue";

/**
 * 表单数据（管理端）选人字段回显。
 * 自 useFormData 拆出（行为不变）：列表数据到达后收集用户 pk 批量请求
 * （不枚举通讯录），pk → 展示名缓存供列渲染与筛选回显共用。
 */
export function useFormDataUserLabels({
  schemaFields,
  tableRef
}: {
  schemaFields: Ref<FormField[]>;
  tableRef: Ref;
}) {
  /** 选人字段回显缓存（pk → 展示名）：列表数据到达后按主键批量拉取 */
  const userLabels = reactive<Record<string, string>>({});

  const collectUserLabels = async (rows: FormDataItem[]) => {
    const pks = collectUserPks(rows, schemaFields.value);
    const missing = pks.filter(pk => !userLabels[String(pk)]);
    if (!missing.length) return;
    const res = await formDataApi
      .userOptions({ pks: missing })
      .catch(() => null);
    for (const user of res?.data ?? []) {
      userLabels[String(user.pk)] = userLabelText(user);
    }
  };

  watch(
    () => (tableRef.value?.dataList ?? []) as FormDataItem[],
    rows => {
      if (rows.length) collectUserLabels(rows);
    }
  );

  return {
    userLabels
  };
}
