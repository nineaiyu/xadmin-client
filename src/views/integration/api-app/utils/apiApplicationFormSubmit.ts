import { isSuccess } from "@/api/types";
import {
  apiApplicationApi,
  type ApiApplicationCredential,
  type ApiApplicationGrant
} from "@/api/identity/open";
import { normalizeError } from "@/utils/apiError";
import { message } from "@/utils/message";
import { normalizeGrants } from "./grants";
import type { ApiResult } from "@/api/types";
import type { RecordType } from "plus-pro-components";
import type { useI18n } from "vue-i18n";

type TFunction = ReturnType<typeof useI18n>["t"];

/**
 * API 应用保存链路：主记录 + 资源授权（独立端点，全量替换）。
 *
 * 顺序与失败语义（与手写表单时代一致）：
 * 1. 先写主记录（create/partialUpdate）；
 * 2. 授权规则加载失败（`grantsLoaded=false`）→ **跳过写入**，只提示告警
 *    （绝不把规则覆盖为空：空清单 = 兼容模式，等于放宽权限）；
 * 3. 授权写入失败 → 主记录已落库，给出可读告警，提示重新进入编辑重试；
 * 4. 新建成功后延迟一帧展示一次性明文密钥，避开与表单弹层的层级竞争。
 */
export function createApiApplicationSubmit({
  t,
  openCredential,
  grantsLoaded,
  pendingGrants
}: {
  t: TFunction;
  openCredential: (data: ApiApplicationCredential) => void;
  grantsLoaded: { value: boolean };
  pendingGrants: { value: ApiApplicationGrant[] };
}) {
  return async ({
    formData,
    isAdd
  }: {
    formData: RecordType;
    isAdd?: boolean;
  }): Promise<ApiResult> => {
    const payload = { ...formData };
    const result = await (
      isAdd
        ? apiApplicationApi.create(payload)
        : apiApplicationApi.partialUpdate(payload.pk, payload)
    ).catch(normalizeError);
    if (!isSuccess(result)) return result;

    const targetPk =
      (isAdd
        ? (result.data as { pk?: string } | null)?.pk
        : (payload.pk as string | undefined)) ?? "";
    if (!grantsLoaded.value) {
      message(t("apiApp.grant.loadFailed"), { type: "warning" });
    } else if (targetPk) {
      const grantRes = await apiApplicationApi
        .updateGrants(targetPk, pendingGrants.value)
        .catch(normalizeError);
      if (!isSuccess(grantRes)) {
        message(String(grantRes.detail || t("apiApp.grant.saveFailed")), {
          type: "warning"
        });
      }
    }

    const created = result.data as ApiApplicationCredential | undefined;
    if (isAdd && created?.client_secret) {
      // 等框架先关闭表单弹层（handleOperation 的 then 是微任务）再展示
      setTimeout(() => openCredential(created), 0);
    }
    return result;
  };
}

/** 提交前归一扩展字段（授权规则单独写入，主载荷不带该键） */
export function pickGrants(
  formData: RecordType
): ApiApplicationGrant[] | undefined {
  const raw = formData.grants as ApiApplicationGrant[] | undefined;
  delete formData.grants;
  return Array.isArray(raw) ? normalizeGrants(raw) : undefined;
}
