<script lang="ts" setup>
/**
 * 账户设置页签骨架：个人中心各子页统一的容器。
 *
 * 统一四件事，消除子页面之间的观感差异：
 * 1. 容器宽度：铺满分栏内容区（原先各页签写 `max-w-[70%]`，随分栏拖拽变化，
 *    宽屏下右侧留出成片空白）；控件宽度由表单栅格列数收住；
 * 2. 标题层级：h3 标题 + 可选说明文案，字号 / 颜色 / 间距同源
 *    （标题保持 h3：页面用例与读屏都以首个 h3 作为页签标题锚点）；
 * 3. 内容表面：卡片背景 / 边框 / 圆角 / 阴影取应用外观层的同一组变量——
 *    表单与表格都落在同一张「内容纸」上，不再一半裸奔一半带框；
 * 4. 列表行节奏：`account-row` 系列类由各页签共用，行分隔线只出现在行之间，
 *    不会像 `el-divider` 那样在末行下面多出一条。
 */
defineOptions({
  name: "AccountPanel"
});

withDefaults(
  defineProps<{
    /** 页签标题 */
    title: string;
    /** 标题下的一句说明（跨端生效范围、操作影响等） */
    description?: string;
  }>(),
  { description: "" }
);
</script>

<template>
  <section class="account-panel">
    <header class="account-panel__header">
      <h3 class="account-panel__title">{{ title }}</h3>
      <p v-if="description" class="account-panel__desc">{{ description }}</p>
    </header>
    <div class="account-panel__body">
      <slot />
    </div>
  </section>
</template>

<style lang="scss">
/**
 * 非 scoped：插槽内容在父组件（各页签）作用域编译，scoped 规则命中不到，
 * 因此共享的行样式只能在此声明——一律挂在 `.account-panel` 前缀下，不外溢。
 *
 * 面板四周留白由分栏内容区（el-main）提供，这里只负责内部结构间距，
 * 避免两层内边距叠加把内容压窄。
 */
.account-panel {
  box-sizing: border-box;
}

.account-panel__header {
  margin-bottom: 16px;
}

.account-panel__title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  line-height: 26px;
  color: var(--el-text-color-primary);
}

.account-panel__desc {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}

/* 内容纸：留白与系统设置页签内容区同一来源（--app-panel-pad-*），两模块观感一致 */
.account-panel__body {
  padding: var(--app-panel-pad-y) var(--app-panel-pad-x);
  background: var(--el-bg-color);
  border: var(--app-card-border);
  border-radius: var(--app-card-radius);
  box-shadow: var(--app-card-shadow);
}

/* 列表行：标题 + 说明在左、操作在右，行高由内容撑开 */
.account-panel .account-row {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 0;
}

.account-panel .account-row:first-child {
  padding-top: 0;
}

.account-panel .account-row:last-child {
  padding-bottom: 0;
}

.account-panel .account-row + .account-row {
  border-top: 1px solid var(--el-border-color-lighter);
}

.account-panel .account-row__main {
  flex: 1;
  min-width: 0;
}

.account-panel .account-row__title {
  font-size: 14px;
  line-height: 22px;
  color: var(--el-text-color-primary);
}

.account-panel .account-row__desc {
  display: block;
  margin-top: 2px;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-secondary);
}

/* 行内分组小标题（已绑定 / 可绑定等）：与行标题同字号，靠颜色与位置区分层级 */
.account-panel .account-section-title {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 500;
  line-height: 22px;
  color: var(--el-text-color-regular);
}

.account-panel .account-section-title:not(:first-child) {
  margin-top: 20px;
}

/* 空状态：虚线兜底框，与有数据时的行列节奏区分开 */
.account-panel .account-empty {
  padding: 16px 0;
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--app-card-radius);
}

/**
 * 面板内嵌列表（个人访问令牌 / 安全日志的 RePlusPage）：搜索卡与表格栏铺满
 * 卡片内宽。框架的 99% 宽是为页面级列表留的余量，嵌进卡片后会在右侧露出一条缝，
 * 与下方表格右缘对不齐。
 */
.account-panel .w-99\/100 {
  width: 100%;
}

/**
 * 面板内嵌的 RePlusPage 已落在面板「内容纸」上：内层搜索卡与表格区
 * 撤除框架的卡片描边 / 圆角 / 阴影（选择器压过组件 scoped 规则），
 * 避免纸中套卡——搜索与表格保持与本页签其他表单一致的一体观感。
 */
.account-panel .re-plus-page .re-plus-search-card,
.account-panel .re-plus-page .re-plus-table-card {
  border: none;
  border-radius: 0;
  box-shadow: none;
}
</style>
