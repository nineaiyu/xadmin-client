<script lang="ts" setup>
import type { ButtonProps, DrawerOptions, EventType, ArgsType } from "./type";
import { closeDrawer, drawerStore, getDrawerUid } from "./store";
import { computed, ref, watch } from "vue";
import { isFunction } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { getLayoutScrollElement } from "@/utils/dom";
import { useScrollLock } from "@/hooks/useScrollLock";

defineOptions({
  name: "ReDrawer"
});

const sureBtnMap = ref<Record<string | number, { loading?: boolean }>>({});
const { t } = useI18n();

/**
 * 抽屉打开期间锁定布局滚动容器：防止背景滚动穿透，并以滚动条槽位预留
 * （`scrollbar-gutter`）避免关闭后内容横向跳动；独立页（无布局滚动容器）
 * 不重复锁定——EP 内置 lock-scroll 已锁 body，避免双重补偿。
 */
const overlayLocked = useScrollLock({ immediate: false });
watch(
  () => drawerStore.value.some(options => options.visible),
  visible => {
    if (!getLayoutScrollElement()) return;
    overlayLocked.value = visible;
  }
);

const footerButtons = computed(() => {
  return (options: DrawerOptions) => {
    return (options?.footerButtons?.length ?? 0) > 0
      ? options.footerButtons
      : ([
          {
            label: t("buttons.cancel"),
            text: true,
            bg: true,
            btnClick: ({ drawer: { options, index } }) => {
              const done = () =>
                handleCloseDrawer(options, index, { command: "cancel" });
              if (options?.beforeCancel && isFunction(options?.beforeCancel)) {
                options.beforeCancel(done, { options, index });
              } else {
                done();
              }
            }
          },
          {
            label: t("buttons.save"),
            type: "primary",
            text: true,
            bg: true,
            popConfirm: options?.popConfirm,
            btnClick: ({ drawer: { options, index } }) => {
              // 以抽屉唯一标识（回退下标）作为状态键，避免多抽屉并存时下标漂移串状态
              const uid = getDrawerUid(options) ?? index;
              if (options?.sureBtnLoading) {
                sureBtnMap.value[uid] = Object.assign(
                  {},
                  sureBtnMap.value[uid],
                  {
                    loading: true
                  }
                );
              }
              const closeLoading = () => {
                if (options?.sureBtnLoading) {
                  sureBtnMap.value[uid].loading = false;
                }
              };
              const done = () => {
                handleCloseDrawer(options, index, { command: "sure" });
              };
              if (options?.beforeSure && isFunction(options?.beforeSure)) {
                options.beforeSure(done, { options, index, closeLoading });
              } else {
                done();
              }
            }
          }
        ] as Array<ButtonProps>);
  };
});

function eventsCallBack(
  event: EventType,
  options: DrawerOptions,
  index: number
) {
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleCloseDrawer(
  options: DrawerOptions,
  index: number,
  args?: ArgsType
) {
  const uid = getDrawerUid(options) ?? index;
  if (options?.sureBtnLoading && sureBtnMap.value[uid]?.loading) {
    sureBtnMap.value[uid].loading = false;
  }
  closeDrawer(options, index, args);
}

function handleClose(
  options: DrawerOptions,
  index: number,
  args: ArgsType = { command: "close" }
) {
  handleCloseDrawer(options, index, args);
  eventsCallBack("close", options, index);
}

function handleChange(options: DrawerOptions, index: number, values: unknown) {
  options?.onChange && options.onChange({ options, index, values });
}

/**
 * 内容组件 props：既有 `options.props` + （启用载荷通道时）注入 `getData/setData`。
 * 仅在显式传入 `payload` 的抽屉注入，未传的抽屉零影响
 * （避免未声明这两个 props 的内容组件把它们落到根元素 DOM 上）。
 */
function contentProps(options: DrawerOptions) {
  if (!options.getData && !options.setData) return options?.props;
  return {
    ...options?.props,
    getData: options.getData,
    setData: options.setData
  };
}
</script>

<template>
  <el-drawer
    v-for="(options, index) in drawerStore"
    :key="getDrawerUid(options) ?? index"
    v-model="options.visible"
    :append-to="options?.appendTo ? options.appendTo : 'body'"
    class="pure-drawer"
    v-bind="options"
    :close-on-press-escape="options.closeOnPressEscape ?? true"
    @closed="handleClose(options, index)"
    @opened="eventsCallBack('open', options, index)"
    @open-auto-focus="eventsCallBack('openAutoFocus', options, index)"
    @close-auto-focus="eventsCallBack('closeAutoFocus', options, index)"
  >
    <!-- header  -->
    <template
      v-if="options?.headerRenderer"
      #header="{ close, titleId, titleClass }"
    >
      <component
        :is="options?.headerRenderer?.({ close, titleId, titleClass })"
      />
    </template>
    <!--  body  -->
    <component
      :is="options.contentRenderer?.({ options, index })"
      v-bind="contentProps(options)"
      @change="(values: unknown) => handleChange(options, index, values)"
      @close="(args: ArgsType) => handleClose(options, index, args)"
    />
    <!-- footer  -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popConfirm"
            v-bind="btn.popConfirm"
            @confirm="
              btn.btnClick?.({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            <template #reference>
              <el-button v-bind="btn">{{ btn?.label }}</el-button>
            </template>
          </el-popconfirm>
          <el-button
            v-else
            :loading="
              key === 1 && sureBtnMap[getDrawerUid(options) ?? index]?.loading
            "
            v-bind="btn"
            @click="
              btn.btnClick?.({
                drawer: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-drawer>
</template>
