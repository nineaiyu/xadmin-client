import { approvalDelegationApi } from "@/api/approval/approvalDelegation";
import { approvalFlowApi } from "@/api/approval/approvalFlow";
import { listRows } from "@/api/base";
import { ElTag } from "element-plus";
import { h, onMounted, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { fetchAllRows } from "@/utils/fetchAllRows";
import type { PageTableColumn } from "@/components/RePlusPage";

/**
 * 审批委托管理（审批流三期）。
 *
 * 列表与表单由服务端元数据驱动：delegator/delegate 为用户外键（用户搜索选择器）、
 * start_time/end_time 为 datetime、flow_codes 为流程 code 列表（空 = 全部流程）。
 * 解析语义：生效委托用代理人替换原审批人（不递归、期外回落、申请人剔除）。
 *
 * flow_codes 列渲染为流程名标签（code→name 映射，缺失回落原码）；写入侧码的
 * 合法性由服务端 fail-closed 校验（错码委托会静默不生效）。
 */
export function useApprovalDelegation() {
  const api = reactive(approvalDelegationApi);
  const auth = usePageAuth();
  const { t } = useI18n();

  /** 流程 code → 名称映射（列表渲染用；拉取失败退化为原 code） */
  const flowNames = ref<Record<string, string>>({});
  onMounted(async () => {
    const res = await fetchAllRows(approvalFlowApi.list).catch(() => null);
    if (!res) return;
    const rows = listRows<{ code: string; name: string }>(res as never);
    flowNames.value = Object.fromEntries(rows.map(row => [row.code, row.name]));
  });

  /** 「流程范围（空 = 全部流程）」标题较长：默认 120px 列宽会折行抬高表头 */
  const listColumnsFormat = (columns: PageTableColumn[]) => {
    columns.forEach(column => {
      if (column._column?.key === "flow_codes") {
        column["minWidth"] = 200;
        column["cellRenderer"] = ({ row }) => {
          const codes = ((row?.flow_codes as string[] | null) ??
            []) as string[];
          if (!codes.length) {
            return h(ElTag, { size: "small", type: "info" }, () =>
              t("systemApprovalDelegation.allFlows")
            );
          }
          return h(
            "div",
            { class: "flex flex-wrap gap-1" },
            codes.map(code =>
              h(
                ElTag,
                { size: "small", key: code, class: "mt-1" },
                () => flowNames.value[code] ?? code
              )
            )
          );
        };
      }
    });
    return columns;
  };

  return {
    api,
    auth,
    listColumnsFormat
  };
}
