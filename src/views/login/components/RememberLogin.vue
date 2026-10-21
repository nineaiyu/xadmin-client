<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import Info from "~icons/ri/information-line";

defineOptions({
  name: "RememberLogin"
});

const { t } = useI18n();

/**
 * 「记住我」勾选 + 免登录天数选择：账号密码登录与验证码登录两页原本各持一份
 * 逐字相同的模板拷贝，且验证码登录版缺 aria-label（a11y 基线的无名称元素）。
 * 逻辑由 useRememberLogin 收敛，本组件收敛模板：以账号密码版为基准（含
 * select 与提示图标的可访问名）。
 */
defineProps<{
  checked: boolean;
  loginDay: number;
  loginDayList: number[];
}>();
const emit = defineEmits<{
  /** 勾选状态变化（el-checkbox 载荷收窄为布尔） */
  "update:checked": [value: boolean];
  /** 免登录天数变化 */
  "update:loginDay": [value: number];
}>();

/** el-checkbox 的更新载荷是 CheckboxValueType（string | number | boolean），布尔场景收窄 */
const onCheckedChange = (value: string | number | boolean) => {
  emit("update:checked", Boolean(value));
};
</script>

<template>
  <div class="w-full h-5 flex-bc">
    <el-checkbox :model-value="checked" @update:model-value="onCheckedChange">
      <span class="flex">
        <select
          :value="loginDay"
          :aria-label="t('login.remember')"
          :disabled="loginDayList.length < 2"
          :style="{
            width: loginDay < 10 ? '10px' : '16px',
            background: 'none',
            appearance: 'none',
            border: 'none'
          }"
          @change="
            emit(
              'update:loginDay',
              Number(($event.target as HTMLSelectElement).value)
            )
          "
        >
          <option v-for="item in loginDayList" :key="item" :value="item">
            {{ item }}
          </option>
        </select>
        {{ t("login.remember") }}
        <el-tooltip
          :content="t('login.rememberInfo')"
          effect="dark"
          placement="top"
        >
          <!-- 提示图标：键盘焦点可达（EP 注入 tooltip trigger 语义），
               以说明文案作可访问名，避免焦点停在无名称元素上 -->
          <IconifyIconOffline
            :icon="Info"
            class="ml-1"
            :aria-label="t('login.rememberInfo')"
          />
        </el-tooltip>
      </span>
    </el-checkbox>
  </div>
</template>
