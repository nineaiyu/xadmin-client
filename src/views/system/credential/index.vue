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
      <el-table
        v-loading="loading"
        :data="data.system_configs"
        row-key="name"
        border
      >
        <el-table-column
          prop="name"
          :label="t('credential.name')"
          min-width="200"
        />
        <el-table-column :label="t('credential.fields')" min-width="140">
          <template #default="{ row }">
            {{ (row.fields ?? []).join("、") }}
          </template>
        </el-table-column>
        <el-table-column
          :label="t('credential.status')"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="statusMeta(row).type" effect="light">
              {{ statusMeta(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="updated_time"
          :label="t('credential.updatedTime')"
          min-width="180"
        />
        <el-table-column
          v-if="canRotate"
          :label="t('credential.action')"
          width="110"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="!row.configured"
              @click="handleRotate(row)"
            >
              {{ t("credential.rotate") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-medium">{{ t("credential.settings") }}</span>
      </template>
      <el-table v-loading="loading" :data="data.settings" row-key="name" border>
        <el-table-column
          prop="name"
          :label="t('credential.name')"
          min-width="220"
        />
        <el-table-column
          prop="category"
          :label="t('credential.category')"
          width="140"
        />
        <el-table-column
          :label="t('credential.status')"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="statusMeta(row).type" effect="light">
              {{ statusMeta(row).text }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="updated_time"
          :label="t('credential.updatedTime')"
          min-width="180"
        />
        <el-table-column
          v-if="canRotate"
          :label="t('credential.action')"
          width="110"
          align="center"
          fixed="right"
        >
          <template #default="{ row }">
            <el-button
              link
              type="primary"
              :disabled="!row.configured"
              @click="handleRotate(row)"
            >
              {{ t("credential.rotate") }}
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-card shadow="never">
      <template #header>
        <span class="font-medium">{{ t("credential.modelFields") }}</span>
      </template>
      <el-table
        v-loading="loading"
        :data="data.model_fields"
        row-key="name"
        border
      >
        <el-table-column
          prop="label"
          :label="t('credential.name')"
          min-width="200"
        />
        <el-table-column
          prop="name"
          :label="t('credential.field')"
          min-width="240"
        />
        <el-table-column
          prop="configured_count"
          :label="t('credential.configuredCount')"
          width="150"
          align="center"
        />
        <el-table-column
          :label="t('credential.status')"
          width="120"
          align="center"
        >
          <template #default="{ row }">
            <el-tag :type="statusMeta(row).type" effect="light">
              {{ statusMeta(row).text }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
      <div class="mt-2 text-sm text-(--el-text-color-secondary)">
        {{ t("credential.modelFieldsHint") }}
      </div>
    </el-card>
  </div>
</template>
