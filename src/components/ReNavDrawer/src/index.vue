<script lang="ts" setup>
/**
 * 窄屏导航抽屉（两栏布局的窄屏形态）。
 *
 * 聊天室与 AI 助手的主界面都是「常驻侧栏 + 内容区」：视口 <768px 时侧栏收进
 * 左侧抽屉。外壳参数（方向 / 宽度 / 无标题栏）与显隐条件集中在此，页面只提供
 * 侧栏内容；选中导航项后是否收起由父级决定（父级持有 v-model 的可见性）。
 */
defineOptions({ name: "ReNavDrawer" });

const props = withDefaults(
  defineProps<{
    /** 窄屏态：false 时不渲染抽屉（宽屏由页面渲染常驻侧栏） */
    narrow?: boolean;
    /** 抽屉宽度（el-drawer 的 size 语义） */
    width?: string;
  }>(),
  { narrow: false, width: "80%" }
);

const visible = defineModel<boolean>({ required: true });
</script>

<template>
  <el-drawer
    v-if="props.narrow"
    v-model="visible"
    direction="ltr"
    :size="props.width"
    :with-header="false"
  >
    <slot />
  </el-drawer>
</template>
