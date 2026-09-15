import Segmented from "@/components/ReSegmented";
import { selectBooleanOptions } from "./constants";

export const renderBooleanSegmentedOption = (
  options: Array<Record<string, unknown>> | null = null
) => {
  // 契约：只传 defaultValue 不传 modelValue。plus-pro-components 的 PlusRender
  // 会把布尔表单值（true/false）强制注入为 modelValue（cloneVNode 后注总是
  // 覆盖调用侧），ReSegmented 已兼容 Boolean 类型并回落 defaultValue 驱动选中态；
  // 表单值回写走下方 change 事件（option.value 为原始布尔）
  return (value: unknown, onChange: (val: unknown) => void) => {
    return (
      <Segmented
        defaultValue={value ? 0 : 1}
        options={options ?? selectBooleanOptions}
        onChange={({ option }) => {
          onChange(option?.value);
        }}
      />
    );
  };
};

/**
 * 格式化后端选择列表，如果是obj的数据，isObjValue为true
 */
export const formatAddOrEditOptions = (
  data: Array<{
    value: unknown;
    label?: unknown;
    disabled?: boolean;
    [key: string]: unknown;
  }>,
  isObjValue = false
) => {
  const result: Array<Record<string, unknown>> = [];
  data?.forEach(item => {
    // 不就地改写入参（后端元数据对象会被多处渲染复用）：需要 pk 时构造副本
    const normalized = { ...item, pk: item.value };
    result.push({
      label: normalized?.label,
      value: isObjValue ? normalized : normalized.value,
      fieldItemProps: {
        disabled: normalized?.disabled
      }
    });
  });
  return result;
};
