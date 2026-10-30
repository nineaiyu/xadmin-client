<script lang="ts" setup>
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { passkeyApi } from "@/api/system/security";
import { message } from "@/utils/message";
import { isSuccess } from "@/api/types";
import { isPasskeySupported } from "@/utils/webauthn";
import { useWebAuthn } from "@/hooks/useWebAuthn";
import { useConfirm } from "@/hooks/useConfirm";
import { usePrompt } from "@/hooks/useMessageBox";
import type { RecordType } from "plus-pro-components";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import { normalizeError } from "@/utils/apiError";
import { formatDateTime } from "@/utils/format";

/**
 * Passkey 凭据管理：浏览器侧完成 WebAuthn 注册仪式，服务端验签落库。
 *
 * 流程：challenge（服务端一次性挑战）→ navigator.credentials.create →
 * register（提交 clientDataJSON / attestationObject）；列表与删除走个人凭据接口
 * （白名单路由，仅登录要求，本人凭据本人管）——因此归属「账户设置」而非受
 * 系统设置菜单权限保护的页面。
 */
const { t } = useI18n();
const { registerPasskey } = useWebAuthn();
const confirm = useConfirm();
const prompt = usePrompt();

const loading = ref(false);
const registering = ref(false);
const rows = ref<RecordType[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const res = await passkeyApi.list({ page: 1, size: 50 });
    if (isSuccess(res)) rows.value = res.data?.results ?? [];
  } catch (error: unknown) {
    message(normalizeError(error).detail, { type: "error" });
  } finally {
    loading.value = false;
  }
};

const register = async () => {
  if (!isPasskeySupported()) {
    message(t("passkey.unsupported"), { type: "warning" });
    return;
  }
  const input = await prompt(t("passkey.namePlaceholder"), t("passkey.add"), {
    inputValue: ""
  });
  if (!input) return;
  const name = input.value.trim();
  registering.value = true;
  try {
    const ok = await registerPasskey({
      challengeApi: () => passkeyApi.challenge("register"),
      name
    });
    if (ok) await load();
  } catch (error: unknown) {
    message(normalizeError(error).detail, { type: "error" });
  } finally {
    registering.value = false;
  }
};

const remove = async (row: RecordType) => {
  if (!(await confirm(t("passkey.removeConfirm"), { danger: true }))) return;
  // 异常归一为可读失败结果：删除失败（凭据已被移除等）需给出可读原因
  const res = await passkeyApi.destroy(row?.pk).catch(normalizeError);
  if (isSuccess(res)) {
    message(t("passkey.removeSuccess"), { type: "success" });
    await load();
  } else {
    message(String(res.detail), { type: "error" });
  }
};

/** 时间展示：服务端 ISO 串统一转本地可读格式 */
const formatTime = (value: unknown) => formatDateTime(value as string) || "-";

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
    <div class="mb-3 flex-bc gap-3">
      <span class="text-sm text-(--el-text-color-secondary)">
        {{ t("passkey.loginTip") }}
      </span>
      <el-button type="primary" :loading="registering" @click="register">
        {{ t("passkey.add") }}
      </el-button>
    </div>
    <!-- 表头底纹由 ReReadonlyTable 统一（与列表页同源）；不带竖向网格线，避免比同页其它表格更重 -->
    <ReReadonlyTable :columns="columns" :rows="rows">
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
