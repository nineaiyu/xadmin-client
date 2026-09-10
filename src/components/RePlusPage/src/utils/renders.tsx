import Segmented from "@/components/ReSegmented";
import { selectBooleanOptions } from "./constants";

export const renderBooleanSegmentedOption = (options = null) => {
  return (value, onChange) => {
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
  const result = [];
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
