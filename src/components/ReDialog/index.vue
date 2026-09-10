<script setup lang="ts">
import {
  type EventType,
  type ArgsType,
  type ButtonProps,
  type DialogOptions,
  closeDialog,
  dialogStore,
  getDialogUid
} from "./index";
import { ref, computed } from "vue";
import { isFunction } from "@pureadmin/utils";
import Fullscreen from "~icons/ri/fullscreen-fill";
import ExitFullscreen from "~icons/ri/fullscreen-exit-fill";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "ReDialog"
});

const sureBtnMap = ref({});
const fullscreen = ref(false);
const { t } = useI18n();
const footerButtons = computed(() => {
  return (options: DialogOptions) => {
    return options?.footerButtons?.length > 0
      ? options.footerButtons
      : ([
          {
            label: t("buttons.cancel"),
            text: true,
            bg: true,
            btnClick: ({ dialog: { options, index } }) => {
              const done = () =>
                handleCloseDialog(options, index, { command: "cancel" });
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
            popconfirm: options?.popconfirm,
            btnClick: ({ dialog: { options, index } }) => {
              // 以弹层唯一标识（回退下标）作为状态键，避免多弹层并存时下标漂移串状态
              const uid = getDialogUid(options) ?? index;
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
                handleCloseDialog(options, index, { command: "sure" });
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

const fullscreenClass = computed(() => {
  return [
    "el-icon",
    "el-dialog__close",
    "-translate-x-2",
    "cursor-pointer",
    "hover:text-[red]!"
  ];
});

function eventsCallBack(
  event: EventType,
  options: DialogOptions,
  index: number,
  isClickFullScreen = false
) {
  if (!isClickFullScreen) fullscreen.value = options?.fullscreen ?? false;
  if (options?.[event] && isFunction(options?.[event])) {
    return options?.[event]({ options, index });
  }
}

function handleCloseDialog(
  options: DialogOptions,
  index: number,
  args?: ArgsType
) {
  const uid = getDialogUid(options) ?? index;
  if (options?.sureBtnLoading && sureBtnMap.value[uid]?.loading) {
    sureBtnMap.value[uid].loading = false;
  }
  closeDialog(options, index, args);
}

function handleClose(
  options: DialogOptions,
  index: number,
  args: ArgsType = { command: "close" }
) {
  handleCloseDialog(options, index, args);
  eventsCallBack("close", options, index);
}

function handleChange(options: DialogOptions, index: number, values: unknown) {
  options?.onChange && options.onChange({ options, index, values });
}
</script>

<template>
  <el-dialog
    v-for="(options, index) in dialogStore"
    :key="getDialogUid(options) ?? index"
    v-bind="options"
    v-model="options.visible"
    class="pure-dialog"
    :fullscreen="fullscreen ? true : options?.fullscreen ? true : false"
    @closed="handleClose(options, index)"
    @opened="eventsCallBack('open', options, index)"
    @openAutoFocus="eventsCallBack('openAutoFocus', options, index)"
    @closeAutoFocus="eventsCallBack('closeAutoFocus', options, index)"
  >
    <!-- header -->
    <template
      v-if="options?.fullscreenIcon || options?.headerRenderer"
      #header="{ close, titleId, titleClass }"
    >
      <div v-if="options?.fullscreenIcon" class="flex-bc">
        <span :id="titleId" :class="titleClass">{{ options?.title }}</span>
        <i
          v-if="!options?.fullscreen"
          :class="fullscreenClass"
          @click="
            () => {
              fullscreen = !fullscreen;
              eventsCallBack(
                'fullscreenCallBack',
                { ...options, fullscreen },
                index,
                true
              );
            }
          "
        >
          <IconifyIconOffline
            class="pure-dialog-svg"
            :icon="
              options?.fullscreen
                ? ExitFullscreen
                : fullscreen
                  ? ExitFullscreen
                  : Fullscreen
            "
          />
        </i>
      </div>
      <component
        :is="options?.headerRenderer({ close, titleId, titleClass })"
        v-else
      />
    </template>
    <component
      v-bind="options?.props"
      :is="options.contentRenderer({ options, index })"
      @change="values => handleChange(options, index, values)"
      @close="args => handleClose(options, index, args)"
    />
    <!-- footer -->
    <template v-if="!options?.hideFooter" #footer>
      <template v-if="options?.footerRenderer">
        <component :is="options?.footerRenderer({ options, index })" />
      </template>
      <span v-else>
        <template v-for="(btn, key) in footerButtons(options)" :key="key">
          <el-popconfirm
            v-if="btn.popconfirm"
            v-bind="btn.popconfirm"
            @confirm="
              btn.btnClick({
                dialog: { options, index },
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
            v-bind="btn"
            :loading="
              key === 1 && sureBtnMap[getDialogUid(options) ?? index]?.loading
            "
            @click="
              btn.btnClick({
                dialog: { options, index },
                button: { btn, index: key }
              })
            "
          >
            {{ btn?.label }}
          </el-button>
        </template>
      </span>
    </template>
  </el-dialog>
</template>
