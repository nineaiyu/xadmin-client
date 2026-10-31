<script setup lang="ts">
import { useId } from "vue";

/**
 * 页签几何图形：同页多个页签各自实例化本组件。
 * symbol id 必须按实例唯一（useId），否则重复 id 会命中 axe duplicate-id。
 */
const uid = useId();
const leftId = `${uid}-geometry-left`;
const rightId = `${uid}-geometry-right`;
</script>

<template>
  <svg class="size-full">
    <defs>
      <symbol :id="leftId" viewBox="0 0 214 36">
        <path d="M17 0h197v36H0v-2c4.5 0 9-3.5 9-8V8c0-4.5 3.5-8 8-8z" />
      </symbol>
      <symbol :id="rightId" viewBox="0 0 214 36">
        <use :xlink:href="`#${leftId}`" />
      </symbol>
      <clipPath>
        <rect height="100%" width="100%" x="0" />
      </clipPath>
    </defs>
    <svg height="100%" width="51%">
      <use
        fill="currentColor"
        height="36"
        width="214"
        :xlink:href="`#${leftId}`"
      />
    </svg>
    <g transform="scale(-1, 1)">
      <svg height="100%" width="51%" x="-100%" y="0">
        <use
          fill="currentColor"
          height="36"
          width="214"
          :xlink:href="`#${rightId}`"
        />
      </svg>
    </g>
  </svg>
</template>
