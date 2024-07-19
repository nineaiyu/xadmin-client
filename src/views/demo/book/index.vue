<script lang="ts" setup>
import RePlusCRUD from "@/components/RePlusCRUD";
import { useDemoBook } from "./utils/hook";

const { api, auth } = useDemoBook();
</script>
<template>
  <RePlusCRUD :api="api" :auth="auth" locale-name="demoBook" />
</template>
