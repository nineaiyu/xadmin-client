<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "@/utils/message";
import { copyToClipboard } from "@/utils/randomPassword";
import type { DirectoryMember } from "@/api/system/directory";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import CopyDocument from "~icons/ep/copy-document";

/**
 * 通讯录成员详情（只读）：资料卡 + 岗位 + 联系方式（邮箱/手机支持一键复制）。
 * 数据取自行快照（列表接口已含全部字段），不再单独请求详情。
 */
defineOptions({ name: "DirectoryMemberDetail" });

const props = defineProps<{ row: DirectoryMember }>();

const { t } = useI18n();

const genderLabel = computed(() => props.row.gender?.label || "-");
const initial = computed(() =>
  (props.row.nickname || props.row.username || "?").slice(0, 1).toUpperCase()
);

async function copy(text: string) {
  const ok = await copyToClipboard(text);
  message(ok ? t("results.copySuccess") : t("results.copyFailed"), {
    type: ok ? "success" : "error"
  });
}
</script>

<template>
  <div>
    <div class="flex items-center gap-4">
      <el-avatar :size="64" :src="row.avatar || undefined">
        {{ initial }}
      </el-avatar>
      <div class="min-w-0">
        <div class="truncate text-base font-medium">
          {{ row.nickname || row.username }}
        </div>
        <div class="mt-0.5 truncate text-sm text-(--el-text-color-secondary)">
          {{ row.username }}
        </div>
        <div class="mt-2 flex flex-wrap items-center gap-1">
          <el-tag
            v-for="item in row.posts"
            :key="item.pk"
            size="small"
            effect="plain"
          >
            {{ item.name }}
          </el-tag>
          <span
            v-if="!row.posts?.length"
            class="text-xs text-(--el-text-color-secondary)"
          >
            {{ t("directory.noPost") }}
          </span>
        </div>
      </div>
    </div>

    <el-divider class="my-4!" />

    <el-descriptions :column="1" border>
      <el-descriptions-item :label="t('directory.dept')">
        {{ row.dept?.name || "-" }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('directory.gender')">
        {{ genderLabel }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('directory.email')">
        <div class="flex-bc gap-2">
          <span class="truncate">{{ row.email || "-" }}</span>
          <el-button
            v-if="row.email"
            link
            type="primary"
            :icon="useRenderIcon(CopyDocument)"
            :aria-label="t('directory.copy')"
            :title="t('directory.copy')"
            @click="copy(row.email)"
          />
        </div>
      </el-descriptions-item>
      <el-descriptions-item :label="t('directory.phone')">
        <div class="flex-bc gap-2">
          <span class="truncate">{{ row.phone || "-" }}</span>
          <el-button
            v-if="row.phone"
            link
            type="primary"
            :icon="useRenderIcon(CopyDocument)"
            :aria-label="t('directory.copy')"
            :title="t('directory.copy')"
            @click="copy(row.phone)"
          />
        </div>
      </el-descriptions-item>
      <el-descriptions-item :label="t('directory.lastLogin')">
        {{ row.last_login || "-" }}
      </el-descriptions-item>
      <el-descriptions-item :label="t('directory.dateJoined')">
        {{ row.date_joined || "-" }}
      </el-descriptions-item>
    </el-descriptions>
  </div>
</template>
