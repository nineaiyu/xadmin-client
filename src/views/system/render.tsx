import Segmented from "@/components/ReSegmented";
import { $t, transformI18n } from "@/plugins/i18n";
import { ref } from "vue";
import { usePublicHooks } from "@/views/system/hooks";
import { isFunction } from "@pureadmin/utils";

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

export const renderSwitch = (
  apiAuth,
  tableRef,
  valueKey,
  msg,
  reverse = false,
  updateApi = null,
  actMsg = null
) => {
  const switchLoadMap = ref({});
  const { switchStyle } = usePublicHooks();
  return scope => (
    <el-switch
      size={scope.props.size === "small" ? "small" : "default"}
      loading={switchLoadMap.value[scope.index]?.loading}
      v-model={scope.row[valueKey]}
      active-value={reverse ? false : true}
      inactive-value={reverse ? true : false}
      active-text={transformI18n($t("labels.active"))}
      inactive-text={transformI18n($t("labels.inactive"))}
      disabled={!apiAuth}
      inline-prompt
      style={switchStyle.value}
      onChange={() => {
        if (isFunction(actMsg)) {
          actMsg = actMsg(scope);
        }
        tableRef.value.onChange(
          switchLoadMap,
          scope as any,
          valueKey,
          msg(scope),
          updateApi,
          actMsg
        );
      }}
    />
  );
};
