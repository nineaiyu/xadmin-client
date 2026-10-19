import { h } from "vue";
import ApiScopeEditor from "@/components/ApiScopeEditor";
import {
  loadScopeCatalog,
  type ApiApplicationGrant
} from "@/api/identity/open";
import ApiApplicationGrantsField from "../components/ApiApplicationGrantsField.vue";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/** 逗号/换行分隔文本 → 去重后的字符串数组（空文本 = 空清单） */
export const splitListText = (value: unknown): string[] =>
  String(value ?? "")
    .split(/[,，\n]/)
    .map(item => item.trim())
    .filter(Boolean);

/** 数组 → 逗号分隔文本（打开编辑时回显） */
export const joinListText = (value: unknown): string =>
  Array.isArray(value) ? value.join(",") : String(value ?? "");

/** 数值字段的公共边界（模型层大多无 min/max 声明，沿用旧手写表单口径） */
const numberColumn = (
  column: Record<string, unknown>,
  props: Record<string, unknown>
) => {
  column.fieldProps = { ...(column.fieldProps as object), ...props };
  return column;
};

/**
 * API 应用表单的列定制（元数据微调 + 一个扩展字段）：
 * - `scopes`（JSONField）换成接口范围勾选器（与访问令牌同源目录）；
 * - `ip_allowlist` / `callback_urls`（JSONField）改为逗号分隔文本；
 * - `grants` 为元数据未下发的扩展字段：资源授权是独立端点（全量替换），
 *   由组件自行加载并回传是否成功（失败时提交侧跳过写入）；
 * - `expired_at` / `description` 旧表单未开放，继续隐藏。
 */
export function buildApiApplicationColumns({
  t,
  grantsLoaded
}: {
  t: TFunction;
  grantsLoaded: { value: boolean };
}) {
  return {
    scopes: ({ column }: { column: RecordType }) => {
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(ApiScopeEditor, {
          modelValue: (value as string[] | undefined) ?? [],
          loadOptions: loadScopeCatalog,
          "onUpdate:modelValue": onChange
        });
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      return column;
    },
    ip_allowlist: ({ column }: { column: RecordType }) => {
      delete column.renderField;
      column.valueType = "input";
      column.fieldProps = {
        ...column.fieldProps,
        placeholder: t("apiApp.listPlaceholder")
      };
      return column;
    },
    callback_urls: ({ column }: { column: RecordType }) => {
      delete column.renderField;
      column.valueType = "input";
      column.fieldProps = {
        ...column.fieldProps,
        placeholder: t("apiApp.listPlaceholder")
      };
      return column;
    },
    rate_limit_per_minute: ({ column }: { column: RecordType }) =>
      numberColumn(column, { min: 0 }),
    token_ttl_seconds: ({ column }: { column: RecordType }) =>
      numberColumn(column, { min: 0 }),
    daily_quota: ({ column }: { column: RecordType }) =>
      numberColumn(column, { min: 0 }),
    quota_alert_percent: ({ column }: { column: RecordType }) =>
      numberColumn(column, { min: 1, max: 100 }),
    expired_at: ({ column }: { column: RecordType }) => {
      column.hideInForm = true;
      return column;
    },
    description: ({ column }: { column: RecordType }) => {
      column.hideInForm = true;
      return column;
    },
    // 扩展字段：资源授权编辑器（元数据未下发该键，框架按 prop 注入空列）
    grants: ({
      column,
      rawRow,
      isAdd
    }: {
      column: RecordType;
      rawRow?: RecordType;
      isAdd?: boolean;
    }) => {
      grantsLoaded.value = Boolean(isAdd) || !rawRow?.pk;
      column.label = t("apiApp.grant.title");
      column.colProps = { xs: 24, sm: 24, md: 24, lg: 24, xl: 24 };
      column.renderField = (
        value: unknown,
        onChange: (value: unknown) => void
      ) =>
        h(ApiApplicationGrantsField, {
          pk: rawRow?.pk as string | undefined,
          modelValue: (value as ApiApplicationGrant[] | undefined) ?? [],
          onLoaded: (ok: boolean) => {
            grantsLoaded.value = ok;
          },
          "onUpdate:modelValue": onChange
        });
      return column;
    }
  };
}
