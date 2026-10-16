<script lang="ts" setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import { useI18n } from "vue-i18n";
import { TopRight } from "@element-plus/icons-vue";
import { SITE_LINKS } from "@/config/site";
import RePage from "@/components/RePage";
import { useColumns } from "./columns";
import { PlusDescriptions } from "plus-pro-components";

export interface schemaItem {
  field: string;
  label: string;
}

defineOptions({
  name: "About"
});

const { t, te } = useI18n();
const route = useRoute();
/** 页头标题：与页签/面包屑同源（路由 meta.title，i18n key 直用 t） */
const pageTitle = computed(() => {
  const key = route.meta?.title;
  if (typeof key === "string" && key) return te(key) ? t(key) : key;
  return t("about.platformInfo");
});
const { pkg } = __APP_INFO__;
const { dependencies, devDependencies } = pkg;

const schema: schemaItem[] = [];
const devSchema: schemaItem[] = [];

const { columns } = useColumns();

/** 「相关链接」行：仓库 / 文档 / 演示（外链，与版本行分隔展示） */
const extLinks = [
  { label: t("about.webRepo"), href: SITE_LINKS.webRepo },
  { label: t("about.serverRepo"), href: SITE_LINKS.serverRepo },
  { label: t("about.docUrl"), href: SITE_LINKS.docs },
  { label: t("about.demoUrl"), href: SITE_LINKS.demo }
];

/** 页头技术栈徽章（技术名不翻译，直接展示；取自简介文案中的主干技术） */
const techStack = [
  "Vue 3",
  "Vite",
  "TypeScript",
  "Element Plus",
  "Pinia",
  "Tailwind CSS"
];

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
  <RePage>
    <!-- 根级注释会让模板在 dev 下变成"多根"（组件根变为 dev Fragment），与布局的
         <Transition mode="out-in"> 组合会卡死：Vue 对 Fragment 根不处理 leave，
         isLeaving 永不复位 → 内容区永久空白。模板注释一律放在根元素内部。 -->
    <!-- 页面留白由布局 .main-content（--content-gap）统一提供：不加 content-flush，
         内容区也不再自行加横向内边距——否则页头贴边、卡片多缩一层，两者不对齐 -->
    <!-- 关于卡：与下方「平台信息 / 依赖」卡同构（同一 el-card + card-header 版式）；
         简介限宽避免整行铺满，下接技术栈徽章行 -->
    <el-card class="mb-4 box-card" shadow="never">
      <template #header>
        <div class="card-header flex items-center">
          <span class="font-medium">{{ pageTitle }}</span>
          <el-tag
            class="ml-1 font-mono!"
            effect="plain"
            round
            size="small"
            type="primary"
          >
            v{{ pkg.version }}
          </el-tag>
        </div>
      </template>
      <p class="about-intro">{{ t("about.intro") }}</p>
      <div class="about-stack">
        <span v-for="item in techStack" :key="item" class="about-chip">
          {{ item }}
        </span>
      </div>
    </el-card>

    <el-card class="mb-4 box-card" shadow="never">
      <template #header>
        <div class="card-header">
          <span class="font-medium">{{ t("about.platformInfo") }}</span>
        </div>
      </template>
      <!-- 版本行：键值对形态（当前版本 / 构建时间 / Node / pnpm） -->
      <PlusDescriptions border :columns="columns" :column="4" />
      <!-- 相关链接行：外链单独成行并加分隔线，避免 descriptions 里 label 与
             链接文案重复（原「前端代码地址 | 前端代码地址」的排版问题） -->
      <div class="about-links">
        <el-link
          v-for="link in extLinks"
          :key="link.href"
          :href="link.href"
          target="_blank"
          rel="noopener noreferrer"
          type="primary"
          underline="never"
        >
          {{ link.label }}
          <el-icon class="ml-0.5"><TopRight /></el-icon>
        </el-link>
      </div>
    </el-card>

    <el-card class="mb-4 box-card" shadow="never">
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

    <el-card class="mb-4 box-card" shadow="never">
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
  </RePage>
</template>

<style lang="scss" scoped>
/* 关于卡：简介按卡片宽度自然排版（不限宽、不人为断行）+ 技术栈徽章行 */
.about-intro {
  margin: 0;
  font-size: var(--font-size-sm);
  line-height: var(--line-height-relaxed);
  color: hsl(var(--fg-muted));
}

.about-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 12px;
}

.about-chip {
  padding: 1px 10px;
  font-size: var(--font-size-xs);
  color: hsl(var(--fg-muted));
  background: var(--el-fill-color-light);
  border-radius: var(--radius-full);
}

/* 相关链接行：与版本行以细分隔线分栏，链接携带外链图标 */
.about-links {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 28px;
  padding-top: 14px;
  margin-top: 14px;
  border-top: 1px solid var(--el-border-color-lighter);
}

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
