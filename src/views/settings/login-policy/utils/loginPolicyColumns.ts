import { h, type Ref } from "vue";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import LoginPolicyTargetSelect from "../components/LoginPolicyTargetSelect.vue";

type TFunction = ReturnType<typeof useI18n>["t"];
type TargetType = "all" | "user" | "role";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/** 生效星期：JSON 编辑器改为 1~7 多选 */
export function weekdayColumn(t: TFunction) {
  return ({ column }: { column: RecordType }) => {
    delete column.renderField;
    column.label = t("loginPolicy.weekdays");
    column.valueType = "select";
    column.fieldProps = {
      ...column.fieldProps,
      multiple: true,
      collapseTags: true,
      clearable: true
    };
    column.options = WEEKDAYS.map(value => ({
      value,
      label: t(`loginPolicy.weekday${value}`)
    }));
    return column;
  };
}

/** 目标值：按 target_type 渲染远程用户/角色选择器，「全部用户」显示只读占位 */
export function targetValueColumn(t: TFunction, targetType: Ref<TargetType>) {
  return ({ column }: { column: RecordType }) => {
    column.label = t("loginPolicy.targetValue");
    column.renderField = (value: unknown, onChange: (value: unknown) => void) =>
      h(LoginPolicyTargetSelect, {
        modelValue: String(value ?? ""),
        targetType: targetType.value,
        "onUpdate:modelValue": onChange
      });
    return column;
  };
}
