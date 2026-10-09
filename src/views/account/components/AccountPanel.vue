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
 */
.account-panel {
  box-sizing: border-box;
  padding: 4px 0 24px;
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

.account-panel__body {
  padding: 20px;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
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

/* 行内分组小标题（已绑定 / 可绑定等） */
.account-panel .account-section-title {
  margin: 0 0 4px;
  font-size: 13px;
  font-weight: 500;
  line-height: 20px;
  color: var(--el-text-color-regular);
}

.account-panel .account-section-title:not(:first-child) {
  margin-top: 20px;
}

/* 空状态：虚线兜底框，与有数据时的行列节奏区分开 */
.account-panel .account-empty {
  padding: 8px 0;
  background: var(--el-fill-color-lighter);
  border: 1px dashed var(--el-border-color);
  border-radius: var(--app-card-radius);
}

@media (width <= 768px) {
  .account-panel {
    padding: 0 0 16px;
  }

  .account-panel__body {
    padding: 16px 12px;
  }
}
</style>
