<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { postApi } from "@/api/system/post";
import type { PostPreviewResult } from "@/api/types/permission-preview";
import {
  PreviewUsersTable,
  usePermissionPreview
} from "@/components/RePermissionPreview";

defineOptions({ name: "PostPermissionPreview" });

/**
 * 岗位维度只读预览（弹层内容组件形态）。
 *
 * 岗位是人员维度（不参与权限判定），故无菜单树 / 数据权限 / 字段权限段，
 * 仅展示岗位信息 + 持有用户采样 + 固定说明（notes 由后端下发）。
 * 由页面经 `addDrawer` 打开：挂载即按行主键加载，关闭即销毁。
 */
const props = defineProps<{ row: { pk?: string | number } }>();

const { t } = useI18n();

const { loading, data } = usePermissionPreview<PostPreviewResult>(
  async pk => (await postApi.preview(pk)).data,
  () => props.row.pk
);
</script>

<template>
  <div v-loading="loading">
    <template v-if="data">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item :label="t('post.name')">
          {{ data.post.name }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('post.code')">
          {{ data.post.code }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('permissionPreview.status')">
          <el-tag :type="data.post.is_active ? 'success' : 'info'" size="small">
            {{
              data.post.is_active
                ? t("permissionPreview.enabled")
                : t("permissionPreview.disabled")
            }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item :label="t('permissionPreview.dept')">
          {{ data.post.dept?.name || "-" }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('post.rank')">
          {{ data.post.rank }}
        </el-descriptions-item>
        <el-descriptions-item :label="t('post.description')">
          {{ data.post.description || "-" }}
        </el-descriptions-item>
      </el-descriptions>

      <el-alert
        v-for="note in data.notes"
        :key="note"
        :title="note"
        class="mt-2"
        :closable="false"
        show-icon
        type="info"
      />

      <el-collapse class="mt-3" :model-value="['users']">
        <el-collapse-item
          :title="`${t('permissionPreview.postUsers')}（${data.users.total}）`"
          name="users"
        >
          <PreviewUsersTable :data="data.users" show-dept />
        </el-collapse-item>
      </el-collapse>
    </template>
  </div>
</template>
