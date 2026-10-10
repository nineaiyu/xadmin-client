<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { useColumns } from "./columns";
import { PlusDescriptions } from "plus-pro-components";

export interface schemaItem {
  field: string;
  label: string;
}

defineOptions({
  name: "About"
});

const { t } = useI18n();
const { pkg } = __APP_INFO__;
const { dependencies, devDependencies } = pkg;

const schema: schemaItem[] = [];
const devSchema: schemaItem[] = [];

const { columns } = useColumns();

/** 主依赖高亮 = 生产依赖键集：构建期随 package.json 派生，不再手维护名单 */
const mainLabels = new Set(Object.keys(dependencies));

/** 命中主依赖集合时返回高亮类名（普通函数：入参即全部依赖，无响应式状态） */
const getMainLabel = (label: string) =>
  mainLabels.has(label) ? "main-label" : "";

Object.keys(dependencies).forEach(key => {
  schema.push({ field: dependencies[key], label: key });
});

Object.keys(devDependencies).forEach(key => {
  devSchema.push({ field: devDependencies[key], label: key });
});
</script>

<template>
  <div class="content-flush">
    <el-card class="m-4 box-card" shadow="never">
      <span>{{ t("about.intro") }}</span>
    </el-card>

    <el-card class="m-4 box-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="font-medium">{{ t("about.platformInfo") }}</span>
        </div>
      </template>
      <el-scrollbar>
        <PlusDescriptions border :columns="columns" :column="4" />
      </el-scrollbar>
    </el-card>

    <el-card class="m-4 box-card" shadow="never">
      <template #header>
        <div class="card-header flex items-center">
          <span class="font-medium">{{ t("about.prodDeps") }}</span>
          <el-tag class="ml-1" effect="dark" round size="small" type="primary">
            {{ schema.length }}
          </el-tag>
        </div>
      </template>
      <el-scrollbar>
        <el-descriptions :column="6" border size="small">
          <el-descriptions-item
            v-for="(item, index) in schema"
            :key="index"
            :label="item.label"
            :label-class-name="getMainLabel(item.label)"
            class-name="pure-version"
            label-align="right"
          >
            <a
              :href="'https://www.npmjs.com/package/' + item.label"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span
                :class="getMainLabel(item.label)"
                style="color: var(--el-color-primary)"
              >
                {{ item.field }}
              </span>
            </a>
          </el-descriptions-item>
        </el-descriptions>
      </el-scrollbar>
    </el-card>

    <el-card class="m-4 box-card" shadow="never">
      <template #header>
        <div class="card-header flex items-center">
          <span class="font-medium">{{ t("about.devDeps") }}</span>
          <el-tag class="ml-1" effect="dark" round size="small" type="primary">
            {{ devSchema.length }}
          </el-tag>
        </div>
      </template>
      <el-scrollbar>
        <el-descriptions :column="5" border size="small">
          <el-descriptions-item
            v-for="(item, index) in devSchema"
            :key="index"
            :label="item.label"
            :label-class-name="getMainLabel(item.label)"
            class-name="pure-version"
            label-align="right"
          >
            <a
              :href="'https://www.npmjs.com/package/' + item.label"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span
                :class="getMainLabel(item.label)"
                style="color: var(--el-color-primary)"
              >
                {{ item.field }}
              </span>
            </a>
          </el-descriptions-item>
        </el-descriptions>
      </el-scrollbar>
    </el-card>
  </div>
</template>

<style lang="scss" scoped>
/* 两张依赖卡的 el-descriptions 都开了 size="small"，EP 的 cell 字号规则
   （`.el-descriptions--small … .el-descriptions__cell`，权重 0-4-0）压过页面选择器，
   故这里是**必需**的 !important，不是可清理的样式债。 */
:deep(.main-label) {
  font-size: var(--el-font-size-medium) !important;
  color: var(--el-color-danger) !important;
}

:deep(.pure-version) {
  font-size: var(--el-font-size-base) !important;
  font-weight: 600 !important;
  opacity: 0.6;

  &:hover {
    opacity: 1;
  }
}

/* descriptions 自带表头间距在本页不需要（卡片 header 已提供） */
:deep(.el-descriptions__header) {
  margin: 0 !important;
}
</style>
