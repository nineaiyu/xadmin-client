import { shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { WebhookEvent } from "@/api/task/webhook";
import type { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * Webhook 订阅新增/编辑表单的元数据微调：
 * - `events`（JSONField）改为事件目录多选（候选来自 `events` 自定义 action）；
 * - `secret`（write_only）改为密码框，编辑态留空 = 沿用原密钥，故必填规则仅在新建生效；
 * - `url` 给出协议示例占位（服务端只接受 http(s)）。
 */
export function useSubscriptionFormOptions({
  t,
  events
}: {
  t: TFunction;
  events: { value: WebhookEvent[] };
}) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      columns: {
        url: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            placeholder: "https://hooks.example.com/x"
          };
          return column;
        },
        secret: ({ column, isAdd }) => {
          column.fieldProps = {
            ...column.fieldProps,
            type: "password",
            showPassword: true,
            placeholder: isAdd
              ? t("webhook.secretHint")
              : t("webhook.secretKeep")
          };
          return column;
        },
        events: ({ column }) => {
          // JSON 编辑器让位给事件目录多选：renderField 优先级高于 valueType，需先清空
          delete column.renderField;
          column.valueType = "select";
          column.fieldProps = {
            ...column.fieldProps,
            multiple: true,
            filterable: true
          };
          column.options = events.value.map(item => ({
            label: item.label,
            value: item.key
          }));
          return column;
        }
      },
      formProps: {
        rules: ({
          isAdd,
          rawFormProps
        }: {
          isAdd?: boolean;
          rawFormProps?: { rules?: RecordType };
        }) => {
          const rules = rawFormProps?.rules ?? {};
          rules.secret = [
            {
              required: Boolean(isAdd),
              message: t("webhook.secretRequired"),
              trigger: "blur"
            }
          ];
          rules.events = [
            {
              type: "array",
              required: true,
              message: t("webhook.required"),
              trigger: "change"
            }
          ];
          return rules;
        }
      }
    }
  });

  return { addOrEditOptions };
}
