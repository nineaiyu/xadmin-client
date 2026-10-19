import { shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 外部 MCP 服务器表单的元数据微调：
 * - `auth_token`（write_only）改为密码框：编辑态留空 = 保持不变，占位文案随
 *   `auth_token_set` 状态切换；
 * - `timeout` 补 5~120 边界（模型层无 min/max 声明，旧表单同口径）；
 * - `allowed_tools`（JSONField → JSON 编辑器）改为逗号分隔文本：打开时数组转文本、
 *   提交时按逗号拆分回数组（空串 = 全部禁止）。
 */
export function useMcpServerFormOptions({ t }: { t: TFunction }) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
      row: {
        allowed_tools: ({ rawRow }: { rawRow?: RecordType }) =>
          ((rawRow?.allowed_tools as string[] | undefined) ?? []).join(", ")
      },
      columns: {
        url: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            placeholder: "https://mcp.example.com/mcp"
          };
          return column;
        },
        auth_header: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            placeholder: "Authorization"
          };
          return column;
        },
        auth_token: ({ column, rawRow }) => {
          column.fieldProps = {
            ...column.fieldProps,
            type: "password",
            showPassword: true,
            placeholder: rawRow?.auth_token_set
              ? t("mcp.formAuthTokenLeave")
              : t("mcp.formAuthTokenPlaceholder")
          };
          return column;
        },
        timeout: ({ column }) => {
          column.fieldProps = {
            ...column.fieldProps,
            min: 5,
            max: 120,
            controlsPosition: "right"
          };
          return column;
        },
        allowed_tools: ({ column }) => {
          // JSON 编辑器让位给逗号分隔文本：renderField 优先级高于 valueType，需先清空
          delete column.renderField;
          column.valueType = "input";
          column.fieldProps = {
            ...column.fieldProps,
            placeholder: "echo, search"
          };
          return column;
        }
      },
      beforeSubmit: ({ formData, formOptions }) => {
        const raw = formData.allowed_tools;
        formData.allowed_tools = (
          Array.isArray(raw) ? raw : String(raw ?? "").split(/[,，]/)
        )
          .map(item => String(item).trim())
          .filter(Boolean);
        // 编辑态留空 = 不提交该键（保持原令牌）
        if (!formOptions.isAdd && !String(formData.auth_token ?? "").trim()) {
          delete formData.auth_token;
        }
        return formData;
      }
    }
  });

  return { addOrEditOptions };
}
