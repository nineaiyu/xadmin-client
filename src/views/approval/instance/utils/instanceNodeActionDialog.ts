import type { Ref, VNode } from "vue";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";
import type { ApiResult } from "@/api/types";
import {
  openActionDialog,
  type ActionFormInstance
} from "./instanceFormDialog";
import {
  notifyNodeProgress,
  rowTitle,
  type TFunction
} from "./instanceFormShared";

type ActionRow = { pk?: string | number; title?: string };

/**
 * 节点动作弹窗通用链路（自 useInstanceNodeActions 抽出，行数门禁）：加签 / 减签 /
 * 退回 / 转交四者均为「弹窗选人（或选节点）→ 标准请求 → 刷新」，差异只在表单组件、
 * 标题与请求构造；会签类动作成功后按服务端 node_progress 提示新达标线。
 *
 * 关闭弹窗（done）先于刷新，避免刷新耗时导致弹窗滞留；成功文案（successKey）
 * 先于 done 给出，与既有交互次序一致。
 */
export function openNodeActionDialog<T>(options: {
  t: TFunction;
  refresh: () => void;
  row: ActionRow;
  /** 弹窗标题词条（插值 title = 行标题） */
  titleKey: string;
  formRef: Ref<ActionFormInstance<T> | undefined>;
  render: () => VNode;
  apiReq: (payload: T) => Promise<ApiResult>;
  /** 固定成功文案（转交/退回）；缺省不提示 */
  successKey?: string;
  /** 成功后按 node_progress 提示新达标线（加签抬高任务数 / 减签恢复） */
  notifyProgress?: boolean;
}) {
  openActionDialog<T>({
    title: options.t(options.titleKey, { title: rowTitle(options.row) }),
    formRef: options.formRef,
    render: options.render,
    submit: (payload, done, closeLoading) => {
      handleOperation({
        t: options.t,
        apiReq: options.apiReq(payload),
        success: res => {
          if (options.successKey) {
            message(options.t(options.successKey), { type: "success" });
          }
          done();
          options.refresh();
          if (options.notifyProgress) notifyNodeProgress(res, options.t);
        },
        requestEnd: closeLoading
      });
    }
  });
}
