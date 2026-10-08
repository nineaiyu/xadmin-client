import { reactive, watch } from "vue";
import type { FormDataApi, FormDataItem, FormField } from "@/api/dataset/dform";
import { collectUserPks, userLabelText } from "./userData";
import type { Ref } from "vue";

/**
 * 表单数据（管理端）选人字段回显。
 * 自 useFormData 拆出（行为不变）：列表数据到达后收集用户 pk 批量请求
 * （不枚举通讯录），pk → 展示名缓存供列渲染与筛选回显共用。
 * 接口实例由页面注入（工厂实例），本模块不持有模块级单例。
 */

/** 单次回显主键数上限：与后端 user_options 的 MAX_USER_OPTIONS 对齐 */
const USER_OPTIONS_BATCH_SIZE = 20;

export function useFormDataUserLabels({
  api,
  schemaFields,
  tableRef
}: {
  api: Pick<FormDataApi, "userOptions">;
  schemaFields: Ref<FormField[]>;
  tableRef: Ref;
}) {
  /** 选人字段回显缓存（pk → 展示名）：列表数据到达后按主键批量拉取 */
  const userLabels = reactive<Record<string, string>>({});

  const collectUserLabels = async (rows: FormDataItem[]) => {
    const pks = collectUserPks(rows, schemaFields.value);
    const missing = pks.filter(pk => !userLabels[String(pk)]);
    if (!missing.length) return;
    // 超过单次上限时按批拆分（顺序请求，结果合并不受影响）；单批失败
    // 归一为 null 跳过该批，不阻断其余批次的回显
    for (let i = 0; i < missing.length; i += USER_OPTIONS_BATCH_SIZE) {
      const batch = missing.slice(i, i + USER_OPTIONS_BATCH_SIZE);
      const res = await api.userOptions({ pks: batch }).catch(() => null);
      for (const user of res?.data ?? []) {
        userLabels[String(user.pk)] = userLabelText(user);
      }
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
