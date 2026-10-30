import type { CaptchaChallengeData, CaptchaScene } from "@/api/auth";
import { collectCaptchaEnv } from "@/utils/captchaSignal/env";

import type { CaptchaSubmitPayload } from "./types";
import {
  buildVerifySign,
  randomNonce,
  VerifySignError,
  verifySignSupported
} from "./verifySign";

/**
 * 组装 verify 请求体（含一次性票据绑定字段与加签）。
 *
 * 抽自编排组件（行数门禁）：纯数据拼装，不触碰组件状态，便于单测覆盖
 * 「pow 题型同时携带 answer/pow_answer」「无 ck 时不加签」等协议细节。
 */
export async function buildVerifyBody({
  challenge,
  scene,
  action,
  account,
  payload,
  honeyPot
}: {
  challenge: CaptchaChallengeData;
  scene: CaptchaScene;
  action: string;
  account: string;
  payload: CaptchaSubmitPayload;
  honeyPot: string;
}): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {
    challenge_id: challenge.challenge_id,
    type: challenge.type,
    scene,
    answer: payload.answer,
    track: payload.track,
    input: payload.input || "pointer",
    env: collectCaptchaEnv(),
    hp: honeyPot,
    account
  };
  if (challenge.type === "pow") body.pow_answer = payload.answer;
  // 意图动作：服务端按 scene 登记表校验，绑定开启（默认）时必填
  if (action) body.action = action;
  const ck = challenge.ck;
  if (ck && verifySignSupported()) {
    // 优先用服务端下发的时间戳：客户端时钟偏差 >5 分钟时，本地时间会让验签窗口
    // 恒定失败（换题重试也一样），登录会被卡死。
    const genTime = Number(challenge.ts) || Math.floor(Date.now() / 1000);
    try {
      body.gen_time = genTime;
      body.nonce = randomNonce();
      body.sign = await buildVerifySign({
        ck,
        challengeId: challenge.challenge_id,
        type: challenge.type,
        scene,
        answer: payload.answer,
        genTime
      });
    } catch {
      // 加签失败不能降级为未签请求：后端默认强制验签，提交只会得到同形失败。
      throw new VerifySignError();
    }
  }
  return body;
}
