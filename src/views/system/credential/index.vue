<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import {
  credentialApi,
  type CredentialEntry,
  type CredentialOverview
} from "@/api/system/credential";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { SUCCESS_CODE } from "@/api/types";
import { useConfirm } from "@/hooks/useConfirm";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";
import ReEmpty from "@/components/ReEmpty";

defineOptions({ name: "SystemCredential" });

const { t } = useI18n();
const router = useRouter();
const confirm = useConfirm();
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
type CredentialRowLike = Partial<CredentialEntry> & { name?: string };

/** 加密状态 → tag 展示（encrypted / plaintext / empty） */
const statusMeta = (
  row: CredentialRowLike
): { type: "success" | "info" | "danger"; text: string } => {
  if (row.scope === "model_field") {
    return {
      type: row.configured ? "success" : "info",
      text: row.configured ? t("credential.encrypted") : t("credential.empty")
    };
  }
  if (row.plaintext || row.status === "plaintext") {
    return { type: "danger", text: t("credential.plaintext") };
  }
  if (!row.configured) {
    return { type: "info", text: t("credential.empty") };
  }
  return { type: "success", text: t("credential.encrypted") };
};

/** 掩码/未配置文案：只表达「是否已配置」，后端不下发任何明文或长度 */
const maskedText = (row: CredentialRowLike) =>
  row.masked ? row.masked : t("credential.empty");

/** 动作列：可原地轮换给轮换按钮，外部签发给「去更换」入口（列集合是数据的一部分） */
const actionsColumn: ReadonlyColumn = {
  label: t("credential.action"),
  width: 120,
  align: "center",
  fixed: "right",
  slot: "actions"
};

const statusColumn: ReadonlyColumn = {
  label: t("credential.status"),
  width: 120,
  align: "center",
  slot: "status"
};

/** 上次轮换 + 建议轮换标记（仅自生成可轮换凭据行有内容） */
const rotatedColumn = computed<ReadonlyColumn>(() => ({
  label: t("credential.lastRotated"),
  minWidth: 180,
  slot: "rotated"
}));

/** 系统配置类凭据（Setting / SysConfig）：字段清单与服务端注册表同源 */
const systemConfigColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "name", label: t("credential.name"), minWidth: 200 },
  { label: t("credential.fields"), minWidth: 120, slot: "fields" },
  { label: t("credential.description"), minWidth: 180, slot: "description" },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    label: t("credential.masked"),
    width: 120,
    align: "center",
    slot: "masked"
  },
  statusColumn,
  rotatedColumn.value,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

/** 模型字段级加密：只给「字段 + 已配置数量」，不回传任何值 */
const modelFieldColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "label", label: t("credential.name"), minWidth: 200 },
  { prop: "name", label: t("credential.field"), minWidth: 240 },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    prop: "configured_count",
    label: t("credential.configuredCount"),
    width: 150,
    align: "center"
  },
  statusColumn,
  rotatedColumn.value,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

const settingsColumns = computed<ReadonlyColumn[]>(() => [
  { prop: "name", label: t("credential.name"), minWidth: 200 },
  { prop: "category", label: t("credential.category"), width: 140 },
  { prop: "used_by", label: t("credential.usedBy"), minWidth: 200 },
  {
    label: t("credential.masked"),
    width: 120,
    align: "center",
    slot: "masked"
  },
  statusColumn,
  { prop: "updated_time", label: t("credential.updatedTime"), minWidth: 180 },
  actionsColumn
]);

async function loadData() {
  if (!canView) return;
  loading.value = true;
  try {
    const res = await credentialApi.overview();
    if (res?.code === SUCCESS_CODE && res.data) {
      data.value = res.data;
    }
  } finally {
    loading.value = false;
  }
}

/** 外部签发凭据：跳转到对应配置页更换（不自造假值） */
function goChange(row: CredentialRowLike) {
  if (row.change_entry) router.push(row.change_entry);
}

/**
 * 原地轮换（仅服务端自生成密钥）：高危操作，二次确认并说明后果。
 * 模型字段级（Webhook / 回调密钥）变更会影响对端验签，必须显式提示。
 */
async function handleRotate(row: CredentialRowLike) {
  const name = String(row.label || row.name || "");
  const confirmText =
    row.scope === "model_field"
      ? t("credential.rotateModelConfirm", { name })
      : t("credential.rotateConfirm", { name });
  if (
    !(await confirm(confirmText, {
      title: t("credential.rotate"),
      confirmButtonText: t("credential.rotate")
    }))
  ) {
    return;
  }
  const res = await credentialApi
    .rotate({ key: String(row.name ?? ""), scope: row.scope })
    .catch(normalizeError);
  if (res?.code === SUCCESS_CODE) {
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
    <!-- 无 overview 权限时给出显式说明，不渲染空表格 -->
    <ReEmpty
      v-if="!canView"
      :description="t('credential.noPermission')"
      :hint="t('credential.noPermissionHint')"
      icon="ep/lock"
    />
    <template v-else>
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
          :columns="systemConfigColumns"
          :rows="data.system_configs"
          :loading="loading"
          border
        >
          <template #fields="{ row }">
            {{ (row.fields ?? []).join("、") }}
          </template>
          <template #description="{ row }">
            <span class="text-(--el-text-color-secondary)">
              {{ row.description || "—" }}
            </span>
          </template>
          <template #masked="{ row }">
            <span :class="{ 'font-mono': row.masked }">
              {{ maskedText(row) }}
            </span>
          </template>
          <template #status="{ row }">
            <el-tag :type="statusMeta(row).type" effect="light">
              {{ statusMeta(row).text }}
            </el-tag>
          </template>
          <template #rotated="{ row }">
            <span v-if="row.rotate_overdue" class="flex items-center gap-1">
              <el-tag type="warning" effect="light">
                {{ t("credential.rotateOverdue") }}
              </el-tag>
              <span class="text-(--el-text-color-secondary)">
                {{ t("credential.neverRotated") }}
              </span>
            </span>
            <span v-else>{{ row.last_rotated || "—" }}</span>
          </template>
          <template #actions="{ row }">
            <el-button
              v-if="row.rotatable && canRotate"
              link
              type="primary"
              :disabled="!row.configured"
              @click="handleRotate(row)"
            >
              {{ t("credential.rotate") }}
            </el-button>
            <el-button
              v-else-if="row.change_entry"
              link
              type="primary"
              @click="goChange(row)"
            >
              {{ t("credential.goChange") }}
            </el-button>
            <span v-else class="text-(--el-text-color-secondary)">—</span>
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
          <template #masked="{ row }">
            <span :class="{ 'font-mono': row.masked }">
              {{ maskedText(row) }}
            </span>
          </template>
          <template #status="{ row }">
            <el-tag :type="statusMeta(row).type" effect="light">
              {{ statusMeta(row).text }}
            </el-tag>
          </template>
          <template #actions="{ row }">
            <el-button
              v-if="row.rotatable && canRotate"
              link
              type="primary"
              :disabled="!row.configured"
              @click="handleRotate(row)"
            >
              {{ t("credential.rotate") }}
            </el-button>
            <el-button
              v-else-if="row.change_entry"
              link
              type="primary"
              @click="goChange(row)"
            >
              {{ t("credential.goChange") }}
            </el-button>
            <span v-else class="text-(--el-text-color-secondary)">—</span>
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
          <template #rotated="{ row }">
            <span v-if="row.rotate_overdue" class="flex items-center gap-1">
              <el-tag type="warning" effect="light">
                {{ t("credential.rotateOverdue") }}
              </el-tag>
              <span class="text-(--el-text-color-secondary)">
                {{ t("credential.neverRotated") }}
              </span>
            </span>
            <span v-else>{{ row.last_rotated || "—" }}</span>
          </template>
          <template #actions="{ row }">
            <el-button
              v-if="row.rotatable && canRotate"
              link
              type="primary"
              :disabled="!row.configured"
              @click="handleRotate(row)"
            >
              {{ t("credential.rotate") }}
            </el-button>
            <el-button
              v-else-if="row.change_entry"
              link
              type="primary"
              @click="goChange(row)"
            >
              {{ t("credential.goChange") }}
            </el-button>
            <span v-else class="text-(--el-text-color-secondary)">—</span>
          </template>
        </ReReadonlyTable>
        <div class="mt-2 text-sm text-(--el-text-color-secondary)">
          {{ t("credential.modelFieldsHint") }}
        </div>
      </el-card>
    </template>
  </div>
</template>
