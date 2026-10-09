import { SUCCESS_CODE } from "@/api/types";
import { message } from "@/utils/message";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";
import type { useI18n } from "vue-i18n";
import type { AssertChallenge, PasskeyAssertionPayload } from "./webauthnTypes";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * Passkey 断言仪式（自 useWebAuthn.ts 抽出）：挑战 → `navigator.credentials.get`
 * → 组装断言载荷。失败（不支持 / 挑战失败 / 用户取消）就地提示并返回空值，
 * 不向调用方抛出，以便调用方在 `finally` 中统一复位 loading。
 */
export function createPasskeyAssert(t: TFunction) {
  return async function assertPasskey(options: {
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
  };
}
