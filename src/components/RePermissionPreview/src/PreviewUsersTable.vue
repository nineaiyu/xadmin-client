<script lang="ts" setup>
// 授权对象成员采样表（role/dept 同构：dept 多一列部门；截断提示统一 info）。
import ReEmpty from "@/components/ReEmpty";
import { useI18n } from "vue-i18n";
import type { PreviewUsersSample } from "@/api/types/permission-preview";

defineOptions({ name: "PreviewUsersTable" });

defineProps<{ data: PreviewUsersSample; showDept?: boolean }>();

const { t } = useI18n();
</script>

<template>
  <el-alert
    v-if="data.truncated"
    :title="
      t('permissionPreview.sampleTruncated', {
        limit: data.sample_limit,
        total: data.total
      })
    "
    type="info"
    :closable="false"
    show-icon
    class="mb-2"
  />
  <el-table :data="data.list" size="small" border>
    <el-table-column
      prop="username"
      :label="t('systemUser.username')"
      min-width="120"
    />
    <el-table-column
      prop="nickname"
      :label="t('systemUser.nickname')"
      min-width="120"
    />
    <el-table-column
      v-if="showDept"
      :label="t('permissionPreview.dept')"
      min-width="140"
    >
      <template #default="{ row }">
        {{ row.dept?.name ?? "-" }}
      </template>
    </el-table-column>
    <el-table-column :label="t('permissionPreview.status')" width="90">
      <template #default="{ row }">
        <el-tag :type="row.is_active ? 'success' : 'info'" size="small">
          {{
            row.is_active
              ? t("permissionPreview.enabled")
              : t("permissionPreview.disabled")
          }}
        </el-tag>
      </template>
    </el-table-column>
    <template #empty>
      <ReEmpty
        :description="t('permissionPreview.emptyUsers')"
        :image-size="70"
      />
    </template>
  </el-table>
</template>
