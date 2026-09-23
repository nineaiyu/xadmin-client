<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { ElMessage, ElMessageBox } from "element-plus";
import { passkeyApi } from "@/api/system/security";
import {
  b64urlToBuffer,
  bufferToB64url,
  isPasskeySupported
} from "@/utils/webauthn";
import type { RecordType } from "plus-pro-components";

/**
 * Passkey 凭据管理（F-9）：浏览器侧完成 WebAuthn 注册仪式，服务端验签落库。
 *
 * 流程：challenge（服务端一次性挑战）→ navigator.credentials.create →
 * register（提交 clientDataJSON / attestationObject）；列表与删除走个人凭据接口
 * （白名单路由，仅登录要求，本人凭据本人管）。
 */
const { t } = useI18n();

const loading = ref(false);
const registering = ref(false);
const rows = ref<RecordType[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res = await passkeyApi.list({ page: 1, size: 50 });
    if (res.code === 1000) rows.value = res.data?.results ?? [];
  } catch (error: unknown) {
    ElMessage.error(String((error as Error)?.message ?? error));
  } finally {
    loading.value = false;
  }
};

const register = async () => {
  if (!isPasskeySupported()) {
    ElMessage.warning(t("passkey.unsupported"));
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
    if (challengeRes.code !== 1000) {
      ElMessage.error(String(challengeRes.detail));
      return;
    }
    const data = challengeRes.data;
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: b64urlToBuffer(data.challenge),
        rp: { id: data.rp_id, name: "xadmin" },
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
      ElMessage.warning(t("passkey.failed"));
      return;
    }
    const response = credential.response as AuthenticatorAttestationResponse;
    const res = await passkeyApi.register({
      client_data_json: bufferToB64url(response.clientDataJSON),
      attestation_object: bufferToB64url(response.attestationObject),
      name: name || t("passkey.name")
    });
    if (res.code === 1000) {
      ElMessage.success(t("passkey.registerSuccess"));
      await load();
    } else {
      ElMessage.error(String(res.detail));
    }
  } catch (error: unknown) {
    ElMessage.error(String((error as Error)?.message ?? error));
  } finally {
    registering.value = false;
  }
};

const remove = async (row: RecordType) => {
  try {
    await ElMessageBox.confirm(t("passkey.removeConfirm"), t("buttons.tips"), {
      type: "warning",
      confirmButtonText: t("buttons.sure"),
      cancelButtonText: t("buttons.cancel")
    });
  } catch {
    return;
  }
  const res = await passkeyApi.destroy(row?.pk);
  if (res.code === 1000) {
    ElMessage.success(t("passkey.removeSuccess"));
    await load();
  } else {
    ElMessage.error(String(res.detail));
  }
};

onMounted(load);
</script>

<template>
  <div v-loading="loading">
    <div class="mb-3 flex-bc">
      <span class="text-sm text-gray-400">{{ t("passkey.loginTip") }}</span>
      <el-button type="primary" :loading="registering" @click="register">
        {{ t("passkey.add") }}
      </el-button>
    </div>
    <el-table :data="rows" border>
      <el-table-column prop="name" :label="t('passkey.name')" min-width="160" />
      <el-table-column :label="t('passkey.created')" width="180">
        <template #default="{ row }">
          {{
            row.created_time
              ? String(row.created_time).replace("T", " ").slice(0, 19)
              : "-"
          }}
        </template>
      </el-table-column>
      <el-table-column :label="t('passkey.lastUsed')" width="180">
        <template #default="{ row }">
          {{
            row.last_used_at
              ? String(row.last_used_at).replace("T", " ").slice(0, 19)
              : "-"
          }}
        </template>
      </el-table-column>
      <el-table-column
        :label="t('commonLabels.operation')"
        width="100"
        fixed="right"
      >
        <template #default="{ row }">
          <el-button type="danger" link @click="remove(row)">
            {{ t("buttons.delete") }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
