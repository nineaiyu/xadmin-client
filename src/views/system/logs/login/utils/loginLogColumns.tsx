import {
  formatPageColumns,
  renderBooleanTag,
  type PageTableColumn
} from "@/components/RePlusPage";
import { parsePolicyResult } from "./loginLogActions";
import type { usePublicHooks } from "@/views/system/hooks";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];
type TeFunction = ReturnType<typeof useI18n>["te"];
type TagStyle = ReturnType<typeof usePublicHooks>["tagStyle"];

const POLICY_ACTION_KEYS: Record<string, string> = {
  reject: "logsLogin.policyReject",
  record: "logsLogin.policyRecord",
  require_mfa: "logsLogin.policyRequireMfa"
};

/** 登录日志列表列：用户链接 / 状态 / 在线 / 策略结果可读化 */
export function buildLoginLogColumns({
  t,
  te,
  tagStyle,
  onGoDetail
}: {
  t: TFunction;
  te: TeFunction;
  tagStyle: TagStyle;
  onGoDetail: (row: { creator?: { pk?: number | string } }) => void;
}) {
  return (columns: PageTableColumn[]) =>
    formatPageColumns(columns, {
      creator: column => {
        column["cellRenderer"] = ({ row }) => (
          <el-link onClick={() => onGoDetail(row)}>
            {row.creator?.username ? row.creator?.username : "/"}
          </el-link>
        );
      },
      status: column => {
        column["cellRenderer"] = renderBooleanTag({
          t,
          tagStyle,
          field: column.prop as string,
          actionMap: { true: t("labels.success"), false: t("labels.failed") }
        });
      },
      online: column => {
        column["cellRenderer"] = renderBooleanTag({
          t,
          tagStyle,
          field: column.prop as string,
          actionMap: {
            true: t("labels.online"),
            false: t("labels.offline"),
            "-1": "/"
          }
        });
      },
      policy_result: column => {
        column["cellRenderer"] = ({ row }) => {
          const parsed = parsePolicyResult(row.policy_result);
          if (!parsed.action) return <span>—</span>;
          const labelKey = POLICY_ACTION_KEYS[parsed.action];
          return (
            <span class="inline-flex items-center gap-1">
              <el-tag size="small" effect="plain">
                {labelKey && te(labelKey) ? t(labelKey) : parsed.action}
              </el-tag>
              {parsed.reason ? <span>{parsed.reason}</span> : null}
            </span>
          );
        };
      }
    });
}
