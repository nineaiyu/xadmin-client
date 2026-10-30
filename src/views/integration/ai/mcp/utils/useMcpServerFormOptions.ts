import { shallowRef } from "vue";
import type { RePlusPageProps } from "@/components/RePlusPage";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * 外部 MCP 服务器表单的元数据微调：
 * - `auth_token`（write_only）改为密码框：编辑态留空 = 保持不变，占位文案随
 *   `auth_token_set` 状态切换；
 * - `timeout` 补 5~120 边界（模型层无 min/max 声明，旧表单同口径）；
 * - `allowed_tools` 用已同步快照做多选（允许创建未同步工具名），不再手输逗号串。
 */
export function useMcpServerFormOptions({ t }: { t: TFunction }) {
  const addOrEditOptions = shallowRef<RePlusPageProps["addOrEditOptions"]>({
    props: {
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
        allowed_tools: ({ column, rawRow }) => {
          // 快照工具优先，历史白名单里未同步的工具名也保留为可选项
          const names = new Set<string>([
            ...(
              (rawRow?.tools_snapshot as { name?: string }[] | undefined) ?? []
            ).map(tool => String(tool.name ?? "")),
            ...((rawRow?.allowed_tools as string[] | undefined) ?? [])
          ]);
          delete column.renderField;
          column.valueType = "select";
          column.options = Array.from(names)
            .filter(Boolean)
            .map(name => ({ label: name, value: name }));
          column.fieldProps = {
            ...column.fieldProps,
            multiple: true,
            filterable: true,
            allowCreate: true,
            placeholder: t("mcp.formAllowedToolsTip")
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
