// 审批中心弹窗工厂：驳回原因输入（单条/批量同构）与逐级审批进度展示。
// 抽出动机：hook.tsx 只保留列表/按钮装配，弹窗内容独立成文件（源码行数门禁 500 行）。
import { h, reactive } from "vue";
import { ElForm, ElFormItem, ElInput, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { useDialogForm } from "@/hooks/useDialogForm";
import { message } from "@/utils/message";
import { statusTagProps } from "@/utils/dict";
import { formatDateTime } from "@/utils/format";
import type { RecordType } from "plus-pro-components";
import type { ApiResult, DetailResult } from "@/api/types";
import { APPROVAL_STATUS_TAG_TYPE } from "./approvalHelpers";

import { dialogSize } from "@/components/ReDialog/size";
/** 驳回原因输入弹窗：单条驳回 / 批量驳回共用同构表单，原因必填在此显式收口 */
export function openRejectReasonDialog(options: {
  /** 与 useI18n 的 t 同宽松签名，便于直接透传 */
  t: (arg0: string, arg1?: object) => string;
  /** 弹窗标题（单条带审批单号 / 批量带勾选数量，由调用方组装） */
  title: string;
  /** 以 trim 后的原因发起请求；成功/失败提示与 loading 收口由 useDialogForm 统一处理 */
  submit: (reason: string) => Promise<ApiResult>;
  onSuccess?: (res?: DetailResult) => void;
}) {
  const { t, title, submit, onSuccess } = options;
  const form = reactive({ reason: "" });
  const { beforeSure } = useDialogForm<string>({
    readPayload: () => {
      const reason = form.reason.trim();
      // ReDialog 只回调 beforeSure，不触发表单校验：原因必填在此显式收口
      if (!reason) {
        message(t("approval.rejectReasonRequired"), { type: "error" });
        return null;
      }
      return reason;
    },
    submit: reason => submit(reason),
    onSuccess: res => {
      message(String(res.detail ?? t("results.success")), { type: "success" });
      onSuccess?.(res as DetailResult);
    },
    onFail: res =>
      message(`${t("results.failed")}，${res.detail}`, { type: "error" })
  });
  addDialog({
    title,
    width: dialogSize("sm"),
    draggable: true,
    closeOnClickModal: false,
    contentRenderer: () => (
      <ElForm model={form}>
        <ElFormItem
          prop="reason"
          rules={[
            {
              required: true,
              message: t("approval.rejectReasonRequired"),
              trigger: "blur"
            }
          ]}
        >
          <ElInput
            type="textarea"
            rows={3}
            maxlength={200}
            show-word-limit
            v-model={form.reason}
            placeholder={t("approval.reasonPlaceholder")}
          />
        </ElFormItem>
      </ElForm>
    ),
    closeCallBack: () => (form.reason = ""),
    beforeSure
  });
}

/** 目标对象轻量快照：主键 / 名称 + 变更前后事实对照 */
export interface TargetSnapshot {
  model?: string;
  verbose_name?: string;
  pk?: string;
  name?: string;
  changes?: Array<{
    field?: string;
    label?: string;
    old?: string;
    new?: string;
  }>;
}

/** 逐级审批进度弹窗：目标对象变更对照 + 逐级候选人 / 处理人 / 意见 / 时间 */
export function openApprovalProgressDialog(options: {
  t: (arg0: string, arg1?: object) => string;
  /** 审批单号（截断展示） */
  no: string;
  steps: Array<RecordType>;
  /** 目标对象快照（敏感操作审批）：有变更时渲染「变更前 → 变更后」对照 */
  snapshot?: TargetSnapshot | null;
  /** 脱敏后的请求体快照：操作类审批在无 target_snapshot 时的内容依据 */
  params?: Record<string, unknown> | null;
}) {
  const { t, no, steps, snapshot, params } = options;
  const hasParams = Boolean(params && Object.keys(params).length);
  const changes = (snapshot?.changes ?? []).filter(item => item?.field);
  addDialog({
    title: t("approval.progressTitle", { no }),
    width: dialogSize("md"),
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () => (
      <div class="space-y-2">
        <p class="text-xs text-(--el-text-color-regular)">
          {t("approval.progressTip")}
        </p>
        {snapshot?.name ? (
          <div
            class="rounded border border-(--el-border-color-lighter) p-2 text-sm"
            data-testid="approval-target-snapshot"
          >
            <div class="font-medium">
              {`${t("approval.target")}: ${snapshot.name}`}
            </div>
            <div class="mt-1 text-xs text-(--el-text-color-regular)">
              {changes.length
                ? t("approval.targetChanges")
                : t("approval.targetNoChanges")}
            </div>
            {changes.length ? (
              <div class="mt-1 space-y-1 text-xs">
                {changes.map(item => (
                  <div
                    key={item.field}
                    class="flex flex-wrap items-center gap-2"
                  >
                    <span class="text-(--el-text-color-regular)">
                      {item.label ?? item.field}
                    </span>
                    <span class="text-(--el-color-danger) line-through">
                      {item.old || "-"}
                    </span>
                    <span>→</span>
                    <span class="text-(--el-color-success)">
                      {item.new || "-"}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
        {hasParams ? (
          <details
            class="rounded border border-(--el-border-color-lighter) p-2 text-sm"
            data-testid="approval-request-params"
          >
            <summary class="cursor-pointer font-medium">
              {t("approval.requestParams")}
            </summary>
            <div class="mt-1 text-xs text-(--el-text-color-regular)">
              {t("approval.requestParamsTip")}
            </div>
            <pre class="mt-1 overflow-x-auto text-xs">
              {JSON.stringify(params, null, 2)}
            </pre>
          </details>
        ) : null}
        {steps.map((step: RecordType) => (
          <div
            key={step.order}
            class="rounded border border-(--el-border-color-lighter) p-2 text-sm"
          >
            <div class="flex items-center gap-2">
              {h(
                ElTag,
                statusTagProps(step.status, APPROVAL_STATUS_TAG_TYPE),
                () => step.status?.label ?? t(`approval.status${step.status}`)
              )}
              {h(ElTag, { size: "small", type: "info", effect: "plain" }, () =>
                step.approve_type === "AND"
                  ? t("approval.modeAND")
                  : t("approval.modeOR")
              )}
              <span>
                {`${t("approval.levelNo", { n: step.order })}${
                  step.name ? ` · ${step.name}` : ""
                }`}
              </span>
              {step.approve_type === "AND" ? (
                <span class="text-xs text-(--el-text-color-regular)">
                  {t("approval.andProgress", {
                    done: Number(step.approved_count ?? 0),
                    total: ((step.assignees ?? []) as Array<RecordType>).length
                  })}
                </span>
              ) : null}
            </div>
            <div class="mt-1 text-xs text-(--el-text-color-regular)">
              {`${t("approval.approver")}: ${
                ((step.assignees ?? []) as Array<RecordType>)
                  .map(item => item?.username ?? item?.pk)
                  .filter(Boolean)
                  .join("、") || "-"
              }`}
              {step.approver?.username
                ? ` · ${t("approval.handler")}: ${step.approver.username}`
                : ""}
              {step.acted_at ? ` · ${formatDateTime(step.acted_at)}` : ""}
            </div>
            {(step.actions ?? []).length ? (
              <div class="mt-1 text-xs text-(--el-text-color-regular)">
                {`${t("approval.actedUsers")}: `}
                {((step.actions ?? []) as Array<RecordType>)
                  .map(
                    item =>
                      `${item.approver?.username ?? "-"}${
                        item.comment ? `（${item.comment}）` : ""
                      }`
                  )
                  .join("、")}
              </div>
            ) : null}
            {step.comment ? (
              <div class="mt-1 text-xs">{`${t("approval.stepComment")}: ${
                step.comment
              }`}</div>
            ) : null}
          </div>
        ))}
      </div>
    )
  });
}
