import { ref, shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";
import { buildLoginPolicyRules } from "./loginPolicyFormRules";

type TFunction = ReturnType<typeof useI18n>["t"];

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

/**
 * 登录访问策略表单的元数据微调。
 *
 * 元数据能力边界与补偿：
 * - `weekdays`（JSONField）在表单里是 JSON 编辑器 → 改为 1~7 多选；
 * - `start_time` / `end_time`（TimeField）由框架 `time` 渲染器提供 time-picker，
 *   跨字段规则见 loginPolicyFormRules；
 * - 元数据协议无 linkage 能力，`target_value` 不再随 `target_type` 隐藏，
 *   改为始终可见 + 提示文案（「全部用户」时忽略），跨字段校验仍会拦截空值；
 * - `ip_ranges`（TextField → textarea）补行数与占位提示。
 */
export function useLoginPolicyFormOptions({ t }: { t: TFunction }) {
  /** 弹层实时表单快照（跨字段规则的输入） */
  const liveForm = ref<RecordType>({});

  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      dialogDrawerOptions: {
        onChange: data => {
          const payload = data?.values as
            { values?: RecordType } | RecordType | undefined;
          const values =
            (payload as { values?: RecordType })?.values ??
            (payload as RecordType | undefined);
          if (values) liveForm.value = values;
        }
      },
      // 新建态默认选中项（模型默认值 Action.REJECT / TargetType.ALL）；
      // 编辑态沿用行数据里的 {value,label} 对象
      row: {
        target_type: ({ rawRow }: { rawRow?: RecordType }) =>
          rawRow?.target_type ?? { value: "all" },
        action: ({ rawRow }: { rawRow?: RecordType }) =>
          rawRow?.action ?? { value: "reject" }
      },
      columns: {
        target_type: ({ column }) => {
          column.label = t("loginPolicy.targetType");
          return column;
        },
        target_value: ({ column }) => {
          column.label = t("loginPolicy.targetValue");
          column.fieldProps = {
            ...column.fieldProps,
            placeholder: t("loginPolicy.targetValuePlaceholder")
          };
          return column;
        },
        weekdays: ({ column }) => {
          // JSON 编辑器让位给多选：renderField 优先级高于 valueType，需先清空
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
        },
        ip_ranges: ({ column }) => {
          column.label = t("loginPolicy.ipRanges");
          column.valueType = "textarea";
          column.fieldProps = {
            ...column.fieldProps,
            rows: 3,
            placeholder: t("loginPolicy.ipPlaceholder")
          };
          return column;
        },
        is_active: ({ column }) => {
          column.label = t("loginPolicy.isActive");
          return column;
        },
        action: ({ column }) => {
          column.label = t("loginPolicy.action");
          return column;
        }
      },
      formProps: {
        rules: ({
          rawFormProps
        }: {
          rawFormProps?: { rules?: RecordType };
        }) => ({
          ...rawFormProps?.rules,
          ...buildLoginPolicyRules({ t, snapshot: liveForm })
        })
      },
      beforeSubmit: ({ formData }) => {
        // time-picker 清空给空串，后端 TimeField 只接受 null 或 HH:mm:ss
        formData.start_time = formData.start_time || null;
        formData.end_time = formData.end_time || null;
        formData.target_value = String(formData.target_value ?? "").trim();
        formData.weekdays = Array.isArray(formData.weekdays)
          ? formData.weekdays.map(Number)
          : [];
        return formData;
      }
    }
  });

  return { addOrEditOptions };
}
