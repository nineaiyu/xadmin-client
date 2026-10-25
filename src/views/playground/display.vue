<script lang="ts" setup>
import { reactive } from "vue";
import { useI18n } from "vue-i18n";
import ReText from "@/components/ReText";
import ReEmpty from "@/components/ReEmpty";
import ReResult from "@/components/ReResult";
import { StatBar, StatGrid, type StatItem } from "@/components/ReStat";
import { ReNormalCountTo, ReboundCountTo } from "@/components/ReCountTo";
import ReJsonViewer from "@/components/ReJsonViewer";
import ReSkeleton from "@/components/ReSkeleton";
import ReScrollbar from "@/components/ReScrollbar";

/** 展示类组件活样例 + props 速查（组件契约以各组件 types/props 定义为单一来源） */
defineOptions({ name: "PlaygroundDisplay" });

const { t } = useI18n();

const longText =
  "元数据驱动的中后台框架要求把「字段如何渲染」的决策从页面代码挪到协议层，" +
  "所以任何一处文本展示都可能承载超长业务描述，截断与展开策略必须在组件层统一收敛。";

const statItems = reactive<StatItem[]>([
  {
    key: "total",
    label: t("playground.statTotal"),
    value: 128,
    type: "primary"
  },
  { key: "ok", label: t("playground.statOk"), value: 120, type: "success" },
  {
    key: "failed",
    label: t("playground.statFailed"),
    value: 8,
    type: "danger",
    clickable: true
  },
  {
    key: "rate",
    label: t("playground.statRate"),
    text: "93.8%",
    type: "warning"
  }
]);

const demoJson = {
  service: "xadmin",
  version: "5.0.0",
  modules: ["approval", "dataset", "ai"],
  quota: { calls: 0, tokens: 0 }
};

const scrollList = Array.from({ length: 12 }, (_, index) => ({
  id: index,
  text: `${t("playground.scrollItem")} ${index + 1}`
}));
</script>

<template>
  <div class="p-4">
    <el-card shadow="never" class="mb-3">
      <template #header>
        <span class="font-medium">ReText</span>
        <code class="ml-2 text-xs text-fg-muted">
          line-clamp?: string | number · expand?: boolean · tooltip?: boolean
          (默认 true)
        </code>
      </template>
      <div class="space-y-2">
        <ReText :text="longText" :line-clamp="1" />
        <ReText :text="longText" :line-clamp="2" expand />
      </div>
    </el-card>

    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReStat</span>
            <code class="ml-2 text-xs text-fg-muted"
              >StatBar/StatGrid · items: StatItem[] · @item-click</code
            >
          </template>
          <StatBar
            :items="statItems"
            @item-click="item => (statItems[0].value = item.value as number)"
          />
          <el-divider class="my-2!" />
          <StatGrid :items="statItems" :columns="4" />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReCountTo</span>
            <code class="ml-2 text-xs text-fg-muted">
              startVal/endVal/duration/decimals/prefix/suffix · ReNormalCountTo
              / ReboundCountTo
            </code>
          </template>
          <div class="flex-ac">
            <ReNormalCountTo
              :end-val="2026"
              :duration="2000"
              suffix=""
              font-size="1.8em"
            />
            <ReboundCountTo
              :end-val="98.6"
              :decimals="1"
              suffix="%"
              font-size="1.8em"
            />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReEmpty</span>
            <code class="ml-2 text-xs text-fg-muted"
              >description? · hint? · size?: "small" | "default" · icon? ·
              imageSize?</code
            >
          </template>
          <ReEmpty
            :description="t('playground.emptyDemo')"
            :hint="t('playground.emptyHint')"
            size="small"
          />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReResult</span>
            <code class="ml-2 text-xs text-fg-muted"
              >status?: info/success/warning/danger/offline · title? ·
              subTitle?</code
            >
          </template>
          <ReResult
            status="warning"
            :title="t('playground.resultTitle')"
            :sub-title="t('playground.resultSub')"
          />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="8">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReSkeleton</span>
            <code class="ml-2 text-xs text-fg-muted"
              >variant?: "text" | "fill" · rows?: 1-6 · animated?: boolean</code
            >
          </template>
          <div class="flex gap-3">
            <ReSkeleton variant="text" :rows="4" class="flex-1" />
            <ReSkeleton variant="fill" class="w-30 h-20!" />
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="12">
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReJsonViewer</span>
            <code class="ml-2 text-xs text-fg-muted">
              value · expandDepth?(1) · copyable?(false) · boxed?(false) ·
              theme?(light) · previewMode?
            </code>
          </template>
          <ReJsonViewer :value="demoJson" :expand-depth="2" boxed copyable />
        </el-card>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card shadow="never" class="mb-3">
          <template #header>
            <span class="font-medium">ReScrollbar</span>
            <code class="ml-2 text-xs text-fg-muted"
              >height?/maxHeight? · native?(false) · shadow?(true) · always? ·
              @scroll-at</code
            >
          </template>
          <ReScrollbar max-height="160">
            <p
              v-for="item in scrollList"
              :key="item.id"
              class="py-1 text-sm text-fg-muted"
            >
              {{ item.text }}
            </p>
          </ReScrollbar>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>
