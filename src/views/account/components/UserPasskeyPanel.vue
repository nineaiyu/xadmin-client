<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessageBox } from "element-plus";
import { passkeyApi } from "@/api/system/security";
import { message } from "@/utils/message";
import { SUCCESS_CODE } from "@/api/types";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";
import { useConfirm } from "@/hooks/useConfirm";
import type { RecordType } from "plus-pro-components";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/**
 * Passkey 凭据管理：浏览器侧完成 WebAuthn 注册仪式，服务端验签落库。
 *
 * 流程：challenge（服务端一次性挑战）→ navigator.credentials.create →
 * register（提交 clientDataJSON / attestationObject）；列表与删除走个人凭据接口
 * （白名单路由，仅登录要求，本人凭据本人管）——因此归属「账户设置」而非受
 * 系统设置菜单权限保护的页面。
 */
const { t } = useI18n();
const confirm = useConfirm();

const loading = ref(false);
const registering = ref(false);
const rows = ref<RecordType[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res = await passkeyApi.list({ page: 1, size: 50 });
    if (res.code === SUCCESS_CODE) rows.value = res.data?.results ?? [];
  } catch (error: unknown) {
    message(String((error as Error)?.message ?? error), { type: "error" });
  } finally {
    loading.value = false;
  }
};

const register = async () => {
  if (!isPasskeySupported()) {
    message(t("passkey.unsupported"), { type: "warning" });
    return;
  }
  let name = "";
  try {
    const input = await ElMessageBox.prompt(
      t("passkey.namePlaceholder"),
      t("passkey.add"),
      {
        confirmButtonText: t("buttons.sure"),
        cancelButtonText: t("buttons.cancel"),
        inputValue: ""
      }
    );
    name = String(input.value ?? "").trim();
  } catch {
    return;
  }
  registering.value = true;
  try {
    const challengeRes = await passkeyApi.challenge("register");
    if (challengeRes.code !== SUCCESS_CODE) {
      message(String(challengeRes.detail), { type: "error" });
      return;
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
      return;
    }
    const response = credential.response as AuthenticatorAttestationResponse;
    const res = await passkeyApi.register({
      client_data_json: bufferToB64url(response.clientDataJSON),
      attestation_object: bufferToB64url(response.attestationObject),
      name: name || t("passkey.name")
    });
    if (res.code === SUCCESS_CODE) {
      message(t("passkey.registerSuccess"), { type: "success" });
      await load();
    } else {
      message(String(res.detail), { type: "error" });
    }
  } catch (error: unknown) {
    message(String((error as Error)?.message ?? error), { type: "error" });
  } finally {
    registering.value = false;
  }
};

const remove = async (row: RecordType) => {
  if (!(await confirm(t("passkey.removeConfirm")))) return;
  // 异常归一为可读失败结果：删除失败（凭据已被移除等）需给出可读原因
  const res = await passkeyApi.destroy(row?.pk).catch(error => ({
    code: -1,
    detail: String((error as { detail?: string })?.detail ?? error)
  }));
  if (res.code === SUCCESS_CODE) {
    message(t("passkey.removeSuccess"), { type: "success" });
    await load();
  } else {
    message(String(res.detail), { type: "error" });
  }
};

/** 时间展示：服务端 ISO 串统一裁到秒（本地化时区口径由后端下发值决定） */
const formatTime = (value: unknown) =>
  value ? String(value).replace("T", " ").slice(0, 19) : "-";

/** 凭据列：时间与删除动作需格式化，走具名插槽 */
const columns = computed<ReadonlyColumn[]>(() => [
  { prop: "name", label: t("passkey.name"), minWidth: 160 },
  { label: t("passkey.created"), width: 180, slot: "created" },
  { label: t("passkey.lastUsed"), width: 180, slot: "lastUsed" },
  {
    label: t("commonLabels.operation"),
    width: 100,
    slot: "operation",
    fixed: "right"
  }
]);

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <div class="mb-3 flex-bc">
      <span class="text-sm text-(--el-text-color-secondary)">
        {{ t("passkey.loginTip") }}
      </span>
      <el-button type="primary" :loading="registering" @click="register">
        {{ t("passkey.add") }}
      </el-button>
    </div>
    <ReReadonlyTable :columns="columns" :rows="rows" border>
      <template #created="{ row }">
        {{ formatTime(row.created_time) }}
      </template>
      <template #lastUsed="{ row }">
        {{ formatTime(row.last_used_at) }}
      </template>
      <template #operation="{ row }">
        <el-button type="danger" link @click="remove(row)">
          {{ t("buttons.delete") }}
        </el-button>
      </template>
    </ReReadonlyTable>
  </div>
</template>
