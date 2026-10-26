<script lang="ts" setup>
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import ReEmpty from "@/components/ReEmpty";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import SearchIcon from "~icons/ep/search";
import {
  CATEGORY_LABELS,
  PLAYGROUND_ENTRIES,
  type PlaygroundCategory
} from "./registry";

/**
 * 组件 Playground 索引：全部自研 Re* 组件的可执行文档目录。
 * 按分组浏览 + 名称过滤；有活样例的组件跳对应 demo 页，无样例的给
 * 「docs-only」标记（组件手册承接）。
 */
defineOptions({ name: "PlaygroundIndex" });

const { t } = useI18n();
const router = useRouter();

const keyword = ref("");
const activeCategory = ref<PlaygroundCategory | "all">("all");

const groups = computed(() => {
  const keywordLower = keyword.value.trim().toLowerCase();
  const categories = (
    activeCategory.value === "all"
      ? (Object.keys(CATEGORY_LABELS) as PlaygroundCategory[])
      : [activeCategory.value]
  ) as PlaygroundCategory[];
  return categories
    .map(category => ({
      category,
      entries: PLAYGROUND_ENTRIES.filter(
        entry =>
          entry.category === category &&
          (!keywordLower ||
            entry.name.toLowerCase().includes(keywordLower) ||
            t(entry.description).toLowerCase().includes(keywordLower))
      )
    }))
    .filter(group => group.entries.length);
});

const total = computed(() =>
  groups.value.reduce((sum, group) => sum + group.entries.length, 0)
);

const openDemo = (demo?: string) => {
  if (demo) router.push(demo);
};
</script>

<template>
  <div class="p-4">
    <el-card shadow="never">
      <div class="flex-bc flex-wrap gap-2">
        <div>
          <span class="text-lg font-medium">{{ t("menus.playground") }}</span>
          <span class="ml-2 text-sm text-fg-muted">
            {{ t("playground.intro", { count: PLAYGROUND_ENTRIES.length }) }}
          </span>
        </div>
        <div class="flex items-center gap-2">
          <el-radio-group v-model="activeCategory" size="small">
            <el-radio-button value="all">
              {{ t("playground.catAll") }}
            </el-radio-button>
            <el-radio-button
              v-for="(label, key) in CATEGORY_LABELS"
              :key="key"
              :value="key"
            >
              {{ t(label) }}
            </el-radio-button>
          </el-radio-group>
          <el-input
            v-model="keyword"
            size="small"
            clearable
            :placeholder="t('playground.searchPlaceholder')"
            :prefix-icon="useRenderIcon(SearchIcon)"
            class="w-50!"
            :data-testid="'playground-search'"
          />
        </div>
      </div>
    </el-card>

    <ReEmpty
      v-if="!total"
      :description="t('playground.noMatch')"
      size="small"
      class="mt-6"
    />

    <div v-for="group in groups" :key="group.category" class="mt-4">
      <el-divider content-position="left" class="my-3!">
        <span class="font-medium">{{
          t(CATEGORY_LABELS[group.category])
        }}</span>
      </el-divider>
      <el-row :gutter="12">
        <el-col
          v-for="entry in group.entries"
          :key="entry.name"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
          class="mb-3"
        >
          <el-card
            shadow="hover"
            class="cursor-pointer"
            :class="entry.demo ? '' : 'is-docs-only'"
            :data-testid="`playground-card-${entry.name}`"
            @click="openDemo(entry.demo)"
          >
            <div class="flex-bc gap-1">
              <span class="font-medium">{{ entry.name }}</span>
              <el-tag v-if="entry.demo" type="success" size="small">
                {{ t("playground.hasDemo") }}
              </el-tag>
              <el-tag v-else type="info" size="small">
                {{ t("playground.docsOnly") }}
              </el-tag>
            </div>
            <p class="mt-1 text-xs leading-5 text-fg-muted">
              {{ t(entry.description) }}
            </p>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.is-docs-only {
  opacity: 0.72;
}
</style>
