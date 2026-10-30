import { isSuccess } from "@/api/types";
import { message } from "@/utils/message";
import { aiProfileApi } from "@/api/ai/ai";
import { normalizeError } from "@/utils/apiError";

/** 轮询间隔与总等待：外呼在 celery 执行，正常 1~3 秒出结论，60 秒是兜底上限 */
const POLL_INTERVAL = 1_500;
const POLL_TIMEOUT = 60_000;

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * 连通性测试全流程（纯流程，文案由调用方接线）：
 * 提交即返回（请求线程不再外呼供应商），再按 task_id 轮询结论；
 * eager 环境（测试 / E2E）没有结果后端，提交响应里已带最终结论，直接消费不再轮询。
 * 异常归一为可读失败提示，不产生未处理的 Promise 拒绝。
 */
export async function runProfileTest(
  pk: string,
  texts: { ok: string; fail: string; timeout: string }
): Promise<void> {
  const submitted = await aiProfileApi.test(pk).catch(normalizeError);
  if (!isSuccess(submitted)) {
    if (submitted.detail)
      message(String(submitted.detail), { type: "warning" });
    return;
  }

  const showOutcome = (ok: boolean | undefined, detail?: string) => {
    message(String(detail || (ok ? texts.ok : texts.fail)), {
      type: ok ? "success" : "warning"
    });
  };

  const first = submitted.data as {
    task_id?: string;
    state?: string;
    ok?: boolean;
    detail?: string;
  };
  if (first?.state === "SUCCESS") {
    showOutcome(first.ok, first.detail);
    return;
  }
  const taskId = first?.task_id;
  if (!taskId) {
    if (submitted.detail)
      message(String(submitted.detail), { type: "warning" });
    return;
  }

  const deadline = Date.now() + POLL_TIMEOUT;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL);
    const polled = await aiProfileApi.testResult(pk, taskId).catch(() => null);
    if (!polled || !isSuccess(polled)) continue;
    const data = polled.data as {
      state?: string;
      ok?: boolean;
      detail?: string;
    };
    if (data?.state === "SUCCESS" || data?.state === "FAILURE") {
      showOutcome(data.state === "SUCCESS" ? data.ok : false, data.detail);
      return;
    }
  }
  message(texts.timeout, { type: "warning" });
}
