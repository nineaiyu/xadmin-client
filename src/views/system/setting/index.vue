<script lang="ts" setup>
import { useSystemSetting } from "./utils/hook";

defineOptions({
  name: "SystemSetting"
});

const { api, auth } = useSystemSetting();
</script>

<template>
  <div>
    <!-- 单根包裹：<Transition> 要求页面组件必须有元素根节点，多根或根级注释都会告警
         （根级注释 = Fragment 根：离开本页时过渡无法收尾，会导致后续所有页面白屏） -->
    <!-- locale-name 与 locales 的 setting 命名空间对应：列头不再回退后端 verbose_name -->
    <RePlusPage
      :api="api"
      :auth="auth"
      locale-name="setting"
      :operation="false"
    />
  </div>
</template>
