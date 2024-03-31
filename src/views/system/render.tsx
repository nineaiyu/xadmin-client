import Segmented from "@/components/ReSegmented";
import { $t, transformI18n } from "@/plugins/i18n";
import { ref } from "vue";

export const selectOptions = [
  {
    label: transformI18n($t("labels.enable")),
    value: true
  },
  {
    label: transformI18n($t("labels.disable")),
    value: false
  }
];
export const renderOption = (options = null) => {
  return (value, onChange) => {
    return (
      <Segmented
        modelValue={value ? 0 : 1}
        options={options ?? selectOptions}
        onChange={({ option }) => {
          onChange(option?.value);
        }}
      />
    );
  };
};

export const disableState = (props, key) => {
  return !props?.isAdd && props?.showColumns.indexOf(key) === -1;
};

export const renderSwitch = (auth, tableRef, switchStyle, valueKey, msg) => {
  const switchLoadMap = ref({});
  return scope => (
    <el-switch
      size={scope.props.size === "small" ? "small" : "default"}
      loading={switchLoadMap.value[scope.index]?.loading}
      v-model={scope.row[valueKey]}
      active-value={true}
      inactive-value={false}
      active-text={transformI18n($t("labels.active"))}
      inactive-text={transformI18n($t("labels.inactive"))}
      disabled={!auth.update}
      inline-prompt
      style={switchStyle.value}
      onChange={() =>
        tableRef.value.onChange(
          switchLoadMap,
          scope as any,
          valueKey,
          msg(scope)
        )
      }
    />
  );
};
