import Segmented from "@/components/ReSegmented";
import { selectBooleanOptions } from "./constants";
export const renderSegmentedOption = (options = null) => {
  return (value, onChange) => {
    return (
      <Segmented
        modelValue={value ? 0 : 1}
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
  data: Array<any>,
  isObjValue = false
) => {
  const result = [];
  data?.forEach(item => {
    item.pk = item.value;
    result.push({
      label: item?.label,
      value: isObjValue ? item : item.value,
      fieldItemProps: {
        disabled: item?.disabled
      }
    });
  });
  return result;
};
