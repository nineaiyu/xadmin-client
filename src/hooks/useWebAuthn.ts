import { useI18n } from "vue-i18n";
import { passkeyApi, type PasskeyChallenge } from "@/api/system/security";
import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";

/** 断言响应载荷（作为 `code` 字段的 JSON 串提交给后端验签） */
export interface PasskeyAssertionPayload {
  credential_id: string;
  client_data_json: string;
  authenticator_data: string;
  signature: string;
}

/** 挑战端点返回：断言链路（登录 MFA / 二次验证）需要 challenge + rp_id */
interface AssertChallenge {
  code: number;
  detail?: string;
  data: { challenge: string; rp_id: string };
}

/** 注册挑战端点返回：需要 rp / user / 挑战全集 */
interface RegisterChallenge {
  code: number;
  detail?: string;
  data: PasskeyChallenge;
}

/**
 * Passkey 浏览器仪式收敛（登录 MFA、全局二次验证、个人凭据注册共用）。
 *
 * 断言：`challengeApi` 取一次性挑战 → `navigator.credentials.get` → 组装断言载荷；
 * 注册：`challengeApi` 取注册挑战 → `navigator.credentials.create` → 提交证明。
 * 失败（不支持 / 挑战失败 / 用户取消）就地提示并返回空值，不向调用方抛出，
 * 以便调用方在 `finally` 中统一复位 loading。
 */
export function useWebAuthn() {
  const { t } = useI18n();

  async function assertPasskey(options: {
    challengeApi: () => Promise<AssertChallenge>;
  }): Promise<PasskeyAssertionPayload | null> {
    if (!isPasskeySupported()) {
      message(t("passkey.unsupported"), { type: "warning" });
      return null;
    }
    const challengeRes = await options.challengeApi();
    if (challengeRes.code !== SUCCESS_CODE) {
      message(String(challengeRes.detail), { type: "warning" });
      return null;
    }
    const { challenge, rp_id } = challengeRes.data;
    const credential = (await navigator.credentials.get({
      publicKey: {
        challenge: b64urlToBuffer(challenge),
        rpId: rp_id,
        timeout: 60000,
        userVerification: "preferred"
      }
    })) as PublicKeyCredential | null;
    if (!credential) {
      message(t("passkey.failed"), { type: "warning" });
      return null;
    }
    const response = credential.response as AuthenticatorAssertionResponse;
    return {
      credential_id: credential.id,
      client_data_json: bufferToB64url(response.clientDataJSON),
      authenticator_data: bufferToB64url(response.authenticatorData),
      signature: bufferToB64url(response.signature)
    };
  }

  async function registerPasskey(options: {
    /** 注册挑战获取（缺省走个人凭据端点） */
    challengeApi?: () => Promise<RegisterChallenge>;
    /** 凭据展示名（空串回落默认文案） */
    name?: string;
  }): Promise<boolean> {
    if (!isPasskeySupported()) {
      message(t("passkey.unsupported"), { type: "warning" });
      return false;
    }
    const challengeApi =
      options.challengeApi ?? (() => passkeyApi.challenge("register"));
    const challengeRes = await challengeApi();
    if (challengeRes.code !== SUCCESS_CODE) {
      message(String(challengeRes.detail), { type: "error" });
      return false;
    }
    const data = challengeRes.data;
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: b64urlToBuffer(data.challenge),
        rp: { id: data.rp_id, name: data.rp_name || data.rp_id },
        user: {
          id: b64urlToBuffer(data.user_id),
          name: data.username,
          displayName: data.display_name || data.username
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        timeout: 60000,
        attestation: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred"
        }
      }
    })) as PublicKeyCredential | null;
    if (!credential) {
      message(t("passkey.failed"), { type: "warning" });
      return false;
    }
    const response = credential.response as AuthenticatorAttestationResponse;
    const res = await passkeyApi.register({
      client_data_json: bufferToB64url(response.clientDataJSON),
      attestation_object: bufferToB64url(response.attestationObject),
      name: options.name || t("passkey.name")
    });
    if (res.code === SUCCESS_CODE) {
      message(t("passkey.registerSuccess"), { type: "success" });
      return true;
    }
    message(String(res.detail), { type: "error" });
    return false;
  }

  return { assertPasskey, registerPasskey };
}
