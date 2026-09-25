<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { ElMessageBox } from "element-plus";
import { useI18n } from "vue-i18n";
import {
  credentialApi,
  type CredentialOverview
} from "@/api/system/credential";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

defineOptions({ name: "SystemCredential" });

const { t } = useI18n();
const loading = ref(false);
const canView = hasAuth("overview:Credential");
const canRotate = hasAuth("rotate:Credential");
const data = ref<CredentialOverview>({
  settings: [],
  system_configs: [],
  model_fields: [],
  plaintext: []
});

const plaintextCount = computed(() => data.value.plaintext?.length ?? 0);

/** 表格行（el-table 的 DefaultRow 宽松形态）：只读取用到的字段 */
type CredentialRowLike = {
  name?: string;
  scope?: string;
  status?: string;
  configured?: boolean;
};

/** 加密状态 → tag 展示（encrypted / plaintext / empty） */
const statusMeta = (
  row: CredentialRowLike
): { type: "success" | "info" | "danger"; text: string } => {
  if (row.scope === "model_field") {
    return { type: "success", text: t("credential.encrypted") };
  }
  if (row.status === "plaintext") {
    return { type: "danger", text: t("credential.plaintext") };
  }
  if (!row.configured) {
    return { type: "info", text: t("credential.empty") };
  }
  return { type: "success", text: t("credential.encrypted") };
};

/** 轮换动作列：仅「有轮换权限」时下发（列集合是数据的一部分，不能只靠 v-if） */
const rotateColumn: ReadonlyColumn = {
  label: t("credential.action"),
  width: 110,
  align: "center",
  fixed: "right",
  slot: "actions"
};
const withRotate = (columns: ReadonlyColumn[]): ReadonlyColumn[] =>
  canRotate ? [...columns, rotateColumn] : columns;

/** 系统配置类凭据（Setting / SysConfig）：字段清单与服务端注册表同源 */
const configColumns = computed(() =>
  withRotate([
    { prop: "name", label: t("credential.name"), minWidth: 200 },
    {
      label: t("credential.fields"),
      minWidth: 140,
      slot: "fields"
    },
    {
      label: t("credential.status"),
      width: 120,
      align: "center",
      slot: "status"
    },
    { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 }
  ])
);

/** 模型字段级加密：只给「字段 + 已配置数量」，不回传任何值 */
const modelFieldColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "label", label: t("credential.name"), minWidth: 200 },
  { prop: "name", label: t("credential.field"), minWidth: 240 },
  {
    prop: "configured_count",
    label: t("credential.configuredCount"),
    width: 150,
    align: "center"
  },
  { label: t("credential.status"), width: 120, align: "center", slot: "status" }
]);

const settingsColumns = computed(() =>
  withRotate([
    { prop: "name", label: t("credential.name"), minWidth: 220 },
    { prop: "category", label: t("credential.category"), width: 140 },
    {
      label: t("credential.status"),
      width: 120,
      align: "center",
      slot: "status"
    },
    { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 }
  ])
);

async function loadData() {
  if (!canView) return;
  loading.value = true;
  try {
    const res = await credentialApi.overview();
    if (res?.code === 1000 && res.data) {
      data.value = res.data;
    }
  } finally {
    loading.value = false;
  }
}

/** 轮换（重新加密）：高危操作二次确认；明文 → 首次加密、密文 → 轮换 salt/nonce */
async function handleRotate(row: CredentialRowLike) {
  try {
    await ElMessageBox.confirm(
      t("credential.rotateConfirm", { name: row.name }),
      t("credential.rotate"),
      {
        type: "warning",
        confirmButtonText: t("credential.rotate"),
        cancelButtonText: t("buttons.cancel")
      }
    );
  } catch {
    return;
  }
  const res = await credentialApi
    .rotate({
      key: String(row.name ?? ""),
      scope: row.scope === "setting" ? "setting" : "system_config"
    })
    .catch(error => ({ code: -1, detail: error?.detail as string }));
  if (res?.code === 1000) {
    message(t("credential.rotateOk"), { type: "success" });
    loadData();
  } else {
    message(
      `${t("credential.rotateFailed")}${res?.detail ? `：${res.detail}` : ""}`,
      { type: "error" }
    );
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="main">
    <el-alert
      v-if="plaintextCount"
      class="mb-3"
      type="warning"
      show-icon
      :closable="false"
      :title="t('credential.plaintextWarn', { count: plaintextCount })"
    />
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-medium">{{ t("credential.systemConfigs") }}</span>
      </template>
      <ReReadonlyTable
        :columns="configColumns"
        :rows="data.system_configs"
        :loading="loading"
        border
      >
        <template #fields="{ row }">
          {{ (row.fields ?? []).join("、") }}
        </template>
        <template #status="{ row }">
          <el-tag :type="statusMeta(row).type" effect="light">
            {{ statusMeta(row).text }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!row.configured"
            @click="handleRotate(row)"
          >
            {{ t("credential.rotate") }}
          </el-button>
        </template>
      </ReReadonlyTable>
    </el-card>

    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-medium">{{ t("credential.settings") }}</span>
      </template>
      <ReReadonlyTable
        :columns="settingsColumns"
        :rows="data.settings"
        :loading="loading"
        border
      >
        <template #status="{ row }">
          <el-tag :type="statusMeta(row).type" effect="light">
            {{ statusMeta(row).text }}
          </el-tag>
        </template>
        <template #actions="{ row }">
          <el-button
            link
            type="primary"
            :disabled="!row.configured"
            @click="handleRotate(row)"
          >
            {{ t("credential.rotate") }}
          </el-button>
        </template>
      </ReReadonlyTable>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="font-medium">{{ t("credential.modelFields") }}</span>
      </template>
      <ReReadonlyTable
        :columns="modelFieldColumns"
        :rows="data.model_fields"
        :loading="loading"
        border
      >
        <template #status="{ row }">
          <el-tag :type="statusMeta(row).type" effect="light">
            {{ statusMeta(row).text }}
          </el-tag>
        </template>
      </ReReadonlyTable>
      <div class="mt-2 text-sm text-(--el-text-color-secondary)">
        {{ t("credential.modelFieldsHint") }}
      </div>
    </el-card>
  </div>
</template>
