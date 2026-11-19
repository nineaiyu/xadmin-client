import { isSuccess } from "@/api/types";
import { AesEncrypted, AesEncryptedChallenge } from "@/utils/aes";
import type { useApiAuth } from "./useApiAuth";

type AccountApi = ReturnType<typeof useApiAuth>["api"];

export interface ChangePasswordFormData {
  old_password?: unknown;
  sure_password?: unknown;
}

/**
 * 构造改密载荷密文：优先 v4 协议（服务端下发的随机挑战为密钥，不可预测）；
 * 挑战端点不存在 / 拉取失败时回退 username 协议（后端未升级或已回滚的
 * 部署窗口，存量协议继续兼容解密）。
 */
export async function buildChangePasswordPayload(
  api: AccountApi,
  username: string,
  formData: ChangePasswordFormData
) {
  const oldPassword = String(formData.old_password ?? "");
  const surePassword = String(formData.sure_password ?? "");
  try {
    const res = await api.passwordChallenge();
    const challenge = isSuccess(res) ? res.data?.challenge : "";
    if (challenge) {
      return {
        old_password: await AesEncryptedChallenge(challenge, oldPassword),
        sure_password: await AesEncryptedChallenge(challenge, surePassword)
      };
    }
  } catch {
    // 挑战端点 404（后端未升级 / 已回滚）→ 走下方 username 回退
  }
  return {
    old_password: await AesEncrypted(username, oldPassword),
    sure_password: await AesEncrypted(username, surePassword)
  };
}
