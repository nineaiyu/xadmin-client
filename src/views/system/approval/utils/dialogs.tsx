// 审批中心弹窗工厂：驳回原因输入（单条/批量同构）与逐级审批进度展示。
// 抽出动机：hook.tsx 只保留列表/按钮装配，弹窗内容独立成文件（源码行数门禁 500 行）。
import { h, reactive } from "vue";
import { ElForm, ElFormItem, ElInput, ElTag } from "element-plus";
import { addDialog } from "@/components/ReDialog";
import { handleOperation } from "@/components/RePlusPage";
import { message } from "@/utils/message";
import { statusTagProps } from "@/utils/dict";
import type { RecordType } from "plus-pro-components";
import type { ApiResult, DetailResult } from "@/api/types";
import { APPROVAL_STATUS_TAG_TYPE } from "./constants";

/** 驳回原因输入弹窗：单条驳回 / 批量驳回共用同构表单，原因必填在此显式收口 */
export function openRejectReasonDialog(options: {
  /** 与 handleOperation 同宽松签名，便于直接透传 useI18n 的 t */
  t: (arg0: string, arg1?: object) => string;
  /** 弹窗标题（单条带审批单号 / 批量带勾选数量，由调用方组装） */
  title: string;
  /** 以 trim 后的原因发起请求；成功/失败提示与 loading 收口由 handleOperation 统一处理 */
  submit: (reason: string) => Promise<ApiResult>;
  onSuccess?: (res?: DetailResult) => void;
}) {
  const { t, title, submit, onSuccess } = options;
  const form = reactive({ reason: "" });
  addDialog({
    title,
    width: "440px",
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
    beforeSure: (done, { closeLoading }) => {
      const reason = form.reason.trim();
      // ReDialog 只回调 beforeSure，不触发表单校验：原因必填在此显式收口
      if (!reason) {
        message(t("approval.rejectReasonRequired"), { type: "error" });
        return;
      }
      // 统一走 handleOperation：成功/失败提示、异常 catch、loading 收口齐全
      // （手写 then 时后端 400 会让 done() 不执行 → 弹窗卡死）
      handleOperation({
        t,
        apiReq: submit(reason),
        success: res => {
          done();
          onSuccess?.(res);
        },
        requestEnd: closeLoading
      });
    }
  });
}

/** 逐级审批进度弹窗：逐级候选人 / 处理人 / 意见 / 时间（多级链单专用） */
export function openApprovalProgressDialog(options: {
  t: (arg0: string, arg1?: object) => string;
  /** 审批单号（截断展示） */
  no: string;
  steps: Array<RecordType>;
}) {
  const { t, no, steps } = options;
  addDialog({
    title: t("approval.progressTitle", { no }),
    width: "620px",
    draggable: true,
    destroyOnClose: true,
    closeOnClickModal: false,
    hideFooter: true,
    contentRenderer: () => (
      <div class="space-y-2">
        <p class="text-xs text-gray-500">{t("approval.progressTip")}</p>
        {steps.map((step: RecordType) => (
          <div
            key={step.order}
            class="rounded border border-gray-200 p-2 text-sm dark:border-gray-700"
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
                <span class="text-xs text-gray-500">
                  {t("approval.andProgress", {
                    done: Number(step.approved_count ?? 0),
                    total: ((step.assignees ?? []) as Array<RecordType>).length
                  })}
                </span>
              ) : null}
            </div>
            <div class="mt-1 text-xs text-gray-500">
              {`${t("approval.approver")}: ${
                ((step.assignees ?? []) as Array<RecordType>)
                  .map(item => item?.username ?? item?.pk)
                  .filter(Boolean)
                  .join("、") || "-"
              }`}
              {step.approver?.username
                ? ` · ${t("approval.handler")}: ${step.approver.username}`
                : ""}
              {step.acted_at ? ` · ${step.acted_at}` : ""}
            </div>
            {(step.actions ?? []).length ? (
              <div class="mt-1 text-xs text-gray-500">
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
