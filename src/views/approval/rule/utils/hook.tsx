import { reactive, shallowRef } from "vue";
import { useI18n } from "vue-i18n";
import { usePageAuth } from "@/router/utils";
import { approvalRuleApi } from "@/api/approval/approvalRule";
import type { OperationProps } from "@/components/RePlusPage";
import { useRuleColumns } from "./ruleColumns";
import { useRuleFormOptions } from "./useRuleFormOptions";

/**
 * 审批规则页（多级审批链配置）：
 *
 * - 命中路径正则的敏感操作按级次逐级审批（一级通过后才通知下一级）；
 * - 新建/编辑走框架元数据表单（`useRuleFormOptions`：路径清单/方法/级次为字段
 *   渲染器，展平载荷与原手写表单一致）；
 * - 删除保留框架默认入口（带二次确认）；详情按钮保持关闭（原页面无详情入口）；
 * - 规则改动只影响之后新建的审批单（在途单按建单快照推进），因此无需「在途锁」。
 */
export function useApprovalRule() {
  const { t } = useI18n();
  const api = reactive(approvalRuleApi);
  const auth = usePageAuth("SystemApprovalRule");
  const { addOrEditOptions } = useRuleFormOptions({ t });

  /** 行内：框架默认「编辑 / 删除」；详情不在原入口内，保持关闭 */
  const operationButtonsProps = shallowRef<OperationProps>({
    width: 200,
    buttons: [{ code: "detail", show: false }]
  });

  const { listColumnsFormat } = useRuleColumns();

  return {
    api,
    auth,
    addOrEditOptions,
    operationButtonsProps,
    listColumnsFormat
  };
}
