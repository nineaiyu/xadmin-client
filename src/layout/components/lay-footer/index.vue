<script lang="ts" setup>
import { getConfig } from "@/config";

const TITLE = getConfig("Title");
</script>

<template>
  <footer class="layout-footer text-text_color_regular">
    Copyright © 2026-present
    <a
      class="hover:text-primary!"
      href="https://github.com/nineaiyu"
      target="_blank"
    >
      &nbsp;{{ TITLE }}
    </a>
  </footer>
</template>

<style lang="scss" scoped>
.layout-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  padding: 0 0 8px;
  font-size: 14px;
}
</style>
