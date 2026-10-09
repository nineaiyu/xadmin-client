import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import { passkeyApi } from "@/api/system/security";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";
import type { useI18n } from "vue-i18n";
import type { RegisterChallenge } from "./webauthnTypes";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * Passkey 注册仪式（自 useWebAuthn.ts 抽出）：注册挑战 → `navigator.credentials.create`
 * → 提交证明。失败就地提示并返回 false，不向调用方抛出。
 */
export function createPasskeyRegister(t: TFunction) {
  return async function registerPasskey(options: {
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
  };
}
