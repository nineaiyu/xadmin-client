<script setup lang="ts">
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { credentialApi, type CredentialEntry } from "@/api/system/credential";
import { hasAuth } from "@/router/utils";
import { message } from "@/utils/message";
import { normalizeError } from "@/utils/apiError";
import { SUCCESS_CODE } from "@/api/types";
import { useConfirm } from "@/hooks/useConfirm";
import {
  ReReadonlyTable,
  type ReadonlyColumn
} from "@/components/ReReadonlyTable";

/**
 * 凭据总览页三张只读表（系统配置 / Setting / 模型字段级）的共用表体。
 *
 * 状态、掩码、上次轮换、动作四类单元格的渲染与行为收敛一处，三张表
 * 逐字节同形；各表独有的列（系统配置表的 fields / description）经具名
 * 插槽原样透传。列集合仍由调用方声明——哪些列存在是数据口径的一部分。
 */
defineOptions({ name: "CredentialTable" });

/** 表格行（el-table 的 DefaultRow 宽松形态）：只读取用到的字段 */
type CredentialRowLike = Partial<CredentialEntry> & { name?: string };

defineProps<{
  columns: ReadonlyColumn[];
  rows?: CredentialRowLike[];
  loading?: boolean;
}>();

const emit = defineEmits<{ rotated: [] }>();

const { t } = useI18n();
const router = useRouter();
const confirm = useConfirm();
const canRotate = hasAuth("rotate:Credential");

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
    emit("rotated");
  } else {
    message(
      `${t("credential.rotateFailed")}${res?.detail ? `：${res.detail}` : ""}`,
      { type: "error" }
    );
  }
}
</script>

<template>
  <ReReadonlyTable :columns="columns" :rows="rows" :loading="loading" border>
    <!-- 调用方独有列的插槽透传：页面按需传入，未传入的插槽不占位 -->
    <template v-if="$slots.fields" #fields="scope">
      <slot name="fields" v-bind="scope" />
    </template>
    <template v-if="$slots.description" #description="scope">
      <slot name="description" v-bind="scope" />
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
</template>
