<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { SUCCESS_CODE } from "@/api/types";
import { tagApi, type TagItem } from "@/api/system/tag";

/**
 * 用户打标弹窗内容：多选已有标签 + 回显当前标签（全量替换语义）。
 *
 * 标签新建/删除在「标签管理」页维护；此处只做打标，权限回落用户对象的
 * update 权限点（后端校验）。
 */
defineOptions({ name: "UserTagSelect" });

const props = defineProps<{
  row: Record<string, unknown>;
}>();

const { t } = useI18n();
const loading = ref(false);
const tags = ref<TagItem[]>([]);
const selected = ref<string[]>([]);

const load = async () => {
  loading.value = true;
  try {
    const [list, current] = await Promise.all([
      tagApi.list({ page: 1, size: 200 }),
      tagApi.getObjectTags("system.userinfo", String(props.row.pk))
    ]);
    if (list.code === SUCCESS_CODE) {
      tags.value = (list.data as { results?: TagItem[] })?.results ?? [];
    }
    if (current.code === SUCCESS_CODE) {
      selected.value = (current.data?.tags ?? []).map(item => item.pk);
    }
  } finally {
    loading.value = false;
  }
};

onMounted(load);

const getSelected = () => selected.value;

defineExpose({ getSelected });
</script>

<template>
  <div v-loading="loading">
    <el-select
      v-model="selected"
      multiple
      filterable
      collapse-tags
      collapse-tags-tooltip
      class="w-full"
      :placeholder="t('tag.assignPlaceholder')"
      data-testid="user-tag-select"
    >
      <el-option
        v-for="tag in tags"
        :key="tag.pk"
        :label="tag.name"
        :value="tag.pk"
      />
    </el-select>
    <div class="mt-2 text-xs opacity-60">{{ t("tag.assignHint") }}</div>
  </div>
</template>
