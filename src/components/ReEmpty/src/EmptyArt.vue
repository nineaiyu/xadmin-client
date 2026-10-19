<script lang="ts" setup>
/**
 * 空态插画：叠放的空白记录纸 + 柔光底。
 *
 * 全部图形用 `currentColor` 与透明度绘制，颜色由外层 `.re-empty-art` 的
 * 主题主色决定，浅色 / 暗色自动跟随；外层控制尺寸，本组件按容器等比缩放。
 */
defineOptions({ name: "ReEmptyArt" });
</script>

<template>
  <svg
    class="re-empty-illustration"
    viewBox="0 0 64 64"
    fill="none"
    aria-hidden="true"
    focusable="false"
  >
    <circle class="halo" cx="32" cy="32" r="27" />
    <rect
      class="sheet sheet--far"
      x="17.5"
      y="14"
      width="32"
      height="40"
      rx="5.5"
      transform="translate(3.2 -1.6) rotate(-13 32 34)"
    />
    <rect
      class="sheet sheet--near"
      x="17.5"
      y="14"
      width="32"
      height="40"
      rx="5.5"
      transform="translate(1.6 -0.8) rotate(-6.5 32 34)"
    />
    <rect
      class="card"
      x="16.75"
      y="12.25"
      width="31.5"
      height="39.5"
      rx="5.5"
    />
    <path class="line" d="M24.5 23.5h16.5M24.5 31.5h16.5" />
    <path class="line line--dashed" d="M24.5 39.5h12" />
    <circle class="spark" cx="52.5" cy="14.5" r="3.6" />
    <circle class="spark spark--small" cx="12.5" cy="50" r="2.2" />
  </svg>
</template>

<style lang="scss" scoped>
.re-empty-illustration {
  display: block;
  width: 100%;
  height: 100%;
}

.halo {
  fill: currentcolor;
  fill-opacity: 0.07;
}

.sheet {
  fill: currentcolor;

  &--far {
    fill-opacity: 0.12;
  }

  &--near {
    fill-opacity: 0.18;
  }
}

.card {
  /* 纸张底色由宿主（`.re-empty-art`）注入，大屏等恒深色页面可整块改色 */
  fill: var(--re-empty-sheet-bg, var(--el-fill-color-blank));
  stroke: currentcolor;
  stroke-opacity: 0.52;
  stroke-width: 2.2;
}

.line {
  fill: none;
  stroke: currentcolor;
  stroke-opacity: 0.3;
  stroke-width: 2.8;
  stroke-linecap: round;

  &--dashed {
    stroke-opacity: 0.24;
    stroke-dasharray: 1.6 5.6;
  }
}

.spark {
  fill: currentcolor;
  fill-opacity: 0.18;

  &--small {
    fill-opacity: 0.14;
  }
}

/* 暗色：主色在深底上判别度低，线稿与底托略提亮。
   注意不要用 `:global(html.dark) .xxx`——scoped 编译会丢掉后代部分，只剩
   `html.dark { … }`，把 `fill-opacity` 继承给整页所有 svg（图标会被整体压暗）。 */
html.dark .card {
  stroke-opacity: 0.58;
}

html.dark .line {
  stroke-opacity: 0.36;

  &--dashed {
    stroke-opacity: 0.3;
  }
}

html.dark .halo {
  fill-opacity: 0.09;
}
</style>
