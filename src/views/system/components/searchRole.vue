<script lang="ts" setup>
import { reactive } from "vue";
import { hasAuth } from "@/router/utils";
import { searchRoleApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";

defineOptions({ name: "searchRole" });

const emit = defineEmits<{
  (e: "change", ...args: any[]): void;
}>();

const selectValue = defineModel({ type: Array<number> });

const api = reactive(searchRoleApi);
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:systemSearchRole')"
    v-model="selectValue"
    locale-name="systemRole"
    :api="api"
    :valueProps="{
      value: 'pk',
      label: 'name'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
