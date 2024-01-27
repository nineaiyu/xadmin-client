import "./circled.css";
import Cropper from "cropperjs";
import { ElUpload } from "element-plus";
import type { CSSProperties } from "vue";
import {
  computed,
  defineComponent,
  onMounted,
  onUnmounted,
  type PropType,
  ref,
  unref
} from "vue";
import { useEventListener } from "@vueuse/core";
import { longpress } from "@/directives/longpress";
import { directive as tippy, useTippy } from "vue-tippy";
import {
  debounce,
  delay,
  downloadByBase64,
  isArray,
  useResizeObserver
} from "@pureadmin/utils";
import {
  ArrowDown,
  ArrowH,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowV,
  ChangeIcon,
  DownloadIcon,
  Reload,
  RotateLeft,
  RotateRight,
  SearchMinus,
  SearchPlus,
  Upload
} from "./svg";
import { useI18n } from "vue-i18n";
import GetCroppedCanvasOptions = Cropper.GetCroppedCanvasOptions;

type Options = Cropper.Options;

const defaultOptions: Options = {
  aspectRatio: 1,
  viewMode: 1,
  zoomable: true,
  zoomOnTouch: true,
  zoomOnWheel: true,
  cropBoxMovable: true,
  cropBoxResizable: true,
  toggleDragModeOnDblclick: true,
  autoCrop: true,
  background: true,
  highlight: true,
  center: true,
  responsive: true,
  restore: true,
  checkCrossOrigin: true,
  checkOrientation: true,
  scalable: true,
  autoCropArea: 1,
  modal: true,
  guides: true,
  movable: true,
  rotatable: true
};

const props = {
  src: { type: String, required: true },
  errSrc: { type: String, required: true },
  quality: { type: Number, required: false, default: 0.98 },
  type: { type: String, required: false, default: "image/png" },
  alt: { type: String },
  circled: { type: Boolean, default: false },
  /** 是否可以通过点击裁剪区域关闭右键弹出的功能菜单，默认 `true` */
  isClose: { type: Boolean, default: true },
  realTimePreview: { type: Boolean, default: true },
  height: { type: [String, Number], default: "360px" },
  crossorigin: {
    type: String as PropType<"" | "anonymous" | "use-credentials" | undefined>,
    default: undefined
  },
  imageStyle: { type: Object as PropType<CSSProperties>, default: () => ({}) },
  options: { type: Object as PropType<Options>, default: () => ({}) },
  canvasOption: {
    type: Object as PropType<GetCroppedCanvasOptions>,
    default: () => ({ maxHeight: 1280, maxWidth: 960 })
  }
};

export default defineComponent({
  name: "ReCropper",
  props,
  setup(props, { attrs, emit }) {
    const tippyElRef = ref<ElRef<HTMLImageElement>>();
    const imgElRef = ref<ElRef<HTMLImageElement>>();
    const cropper = ref<Nullable<Cropper>>();
    const inCircled = ref(props.circled);
    const isInClose = ref(props.isClose);
    const isReady = ref(false);
    const inSrc = ref(props.src);
    const imgBase64 = ref();
    let scaleX = 1;
    let scaleY = 1;
    const onImageError = () => {
      inSrc.value = props.errSrc;
      cropper.value?.destroy();
      delay(400).then(() => {
        init();
      });
    };
    const debounceRealTimeCroppered = debounce(realTimeCroppered, 80);
    const { t } = useI18n();
    const getImageStyle = computed((): CSSProperties => {
      return {
        height: props.height,
        maxWidth: "100%",
        ...props.imageStyle
      };
    });

    const getClass = computed(() => {
      return [
        attrs.class,
        {
          ["re-circled"]: inCircled.value
        }
      ];
    });

    const iconClass = computed(() => {
      return [
        "p-[6px]",
        "h-[30px]",
        "w-[30px]",
        "outline-none",
        "rounded-[4px]",
        "cursor-pointer",
        "hover:bg-[rgba(0,0,0,0.06)]"
      ];
    });

    const getWrapperStyle = computed((): CSSProperties => {
      return { height: `${props.height}`.replace(/px/, "") + "px" };
    });

    onMounted(init);

    onUnmounted(() => {
      cropper.value?.destroy();
    });

    useResizeObserver(tippyElRef, () => handCropper("reset"));

    async function init() {
      const imgEl = unref(imgElRef);
      if (!imgEl) return;
      cropper.value = new Cropper(imgEl, {
        ...defaultOptions,
        ready: () => {
          isReady.value = true;
          realTimeCroppered();
          delay(400).then(() => emit("readied", cropper.value));
        },
        crop() {
          debounceRealTimeCroppered();
        },
        zoom() {
          debounceRealTimeCroppered();
        },
        cropmove() {
          debounceRealTimeCroppered();
        },
        ...props.options
      });
    }

    function realTimeCroppered() {
      props.realTimePreview && croppered();
    }

    function croppered() {
      if (!cropper.value) return;
      const sourceCanvas = cropper.value!.getCroppedCanvas(props.canvasOption);
      const canvas = inCircled.value
        ? getRoundedCanvas(sourceCanvas)
        : sourceCanvas;
      let quality = props.quality;
      let type = props.type;
      if (quality == 0) {
        const rules = [
          { value: 0, type: "image/png", quality: 1 },
          { value: 0.1, type: "image/jpeg", quality: 0.98 },
          { value: 0.2, type: "image/jpeg", quality: 0.7 },
          { value: 1, type: "image/jpeg", quality: 0.6 },
          { value: 5, type: "image/jpeg", quality: 0.5 },
          { value: 10, type: "image/jpeg", quality: 0.2 }
        ];
        rules.sort((a, b) => {
          return b.value - a.value;
        });
        const size = canvas.width * canvas.height;
        for (let i = 0; i < rules.length; i++) {
          if (size > 1024 * 1024 * rules[i].value) {
            quality = rules[i].quality;
            type = rules[i].type;
            console.log("get quality", size / 1024, rules[i]);
            break;
          }
        }
      }
      // https://developer.mozilla.org/zh-CN/docs/Web/API/HTMLCanvasElement/toBlob
      canvas.toBlob(
        blob => {
          if (!blob) return;
          const fileReader: FileReader = new FileReader();
          fileReader.readAsDataURL(blob);
          fileReader.onloadend = e => {
            if (!e.target?.result || !blob) return;
            imgBase64.value = e.target.result;
            emit("cropper", {
              base64: e.target.result,
              blob,
              // info: { size: blob.size, ...cropper.value.getData() }
              info: {
                size: blob.size,
                width: canvas.width,
                height: canvas.height
              }
            });
          };
          fileReader.onerror = () => {
            emit("error");
          };
        },
        type,
        quality
      );
    }

    function getRoundedCanvas(sourceCanvas) {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d")!;
      const width = sourceCanvas.width;
      const height = sourceCanvas.height;
      canvas.width = width;
      canvas.height = height;
      context.imageSmoothingEnabled = true;
      context.drawImage(sourceCanvas, 0, 0, width, height);
      context.globalCompositeOperation = "destination-in";
      context.beginPath();
      context.arc(
        width / 2,
        height / 2,
        Math.min(width, height) / 2,
        0,
        2 * Math.PI,
        true
      );
      context.fill();
      return canvas;
    }

    function handCropper(event: string, arg?: number | Array<number>) {
      if (event === "scaleX") {
        scaleX = arg = scaleX === -1 ? 1 : -1;
      }
      if (event === "scaleY") {
        scaleY = arg = scaleY === -1 ? 1 : -1;
      }
      arg && isArray(arg)
        ? cropper.value?.[event]?.(...arg)
        : cropper.value?.[event]?.(arg);
    }

    function beforeUpload(file) {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      inSrc.value = "";
      reader.onload = e => {
        inSrc.value = e.target?.result as string;
      };
      reader.onloadend = () => {
        init();
      };
      return false;
    }

    const menuContent = defineComponent({
      directives: {
        tippy,
        longpress
      },
      setup() {
        return () => (
          <div class="flex flex-wrap w-[60px] justify-between">
            <ElUpload
              accept="image/*"
              show-file-list={false}
              before-upload={beforeUpload}
            >
              <Upload
                class={iconClass.value}
                v-tippy={{
                  content: t("cropper.upload"),
                  placement: "left-start"
                }}
              />
            </ElUpload>
            <DownloadIcon
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.download"),
                placement: "right-start"
              }}
              onClick={() => downloadByBase64(imgBase64.value, "cropping.png")}
            />
            <ChangeIcon
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.change"),
                placement: "left-start"
              }}
              onClick={() => {
                inCircled.value = !inCircled.value;
                realTimeCroppered();
              }}
            />
            <Reload
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.reset"),
                placement: "right-start"
              }}
              onClick={() => handCropper("reset")}
            />
            <ArrowUp
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.up"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("move", [0, -10]), "0:100"]}
            />
            <ArrowDown
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.down"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("move", [0, 10]), "0:100"]}
            />
            <ArrowLeft
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.left"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("move", [-10, 0]), "0:100"]}
            />
            <ArrowRight
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.right"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("move", [10, 0]), "0:100"]}
            />
            <ArrowH
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.flipHorizontal"),
                placement: "left-start"
              }}
              onClick={() => handCropper("scaleX", -1)}
            />
            <ArrowV
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.flipVertical"),
                placement: "right-start"
              }}
              onClick={() => handCropper("scaleY", -1)}
            />
            <RotateLeft
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.anticlockwise"),
                placement: "left-start"
              }}
              onClick={() => handCropper("rotate", -45)}
            />
            <RotateRight
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.clockwise"),
                placement: "right-start"
              }}
              onClick={() => handCropper("rotate", 45)}
            />
            <SearchPlus
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.zoomIn"),
                placement: "left-start"
              }}
              v-longpress={[() => handCropper("zoom", 0.1), "0:100"]}
            />
            <SearchMinus
              class={iconClass.value}
              v-tippy={{
                content: t("cropper.zoomOut"),
                placement: "right-start"
              }}
              v-longpress={[() => handCropper("zoom", -0.1), "0:100"]}
            />
          </div>
        );
      }
    });

    function onContextmenu(event) {
      event.preventDefault();

      const { show, setProps, destroy, state } = useTippy(tippyElRef, {
        content: menuContent,
        arrow: false,
        theme: "light",
        trigger: "manual",
        interactive: true,
        appendTo: "parent",
        // hideOnClick: false,
        animation: "perspective",
        placement: "bottom-end"
      });

      setProps({
        getReferenceClientRect: () => ({
          width: 0,
          height: 0,
          top: event.clientY,
          bottom: event.clientY,
          left: event.clientX,
          right: event.clientX
        })
      });
      if (isInClose.value) {
        if (!state.value.isShown && !state.value.isVisible) return;
        useEventListener(tippyElRef, "click", destroy);
      }
      show();
    }

    return {
      inSrc,
      props,
      imgElRef,
      tippyElRef,
      getClass,
      getWrapperStyle,
      getImageStyle,
      isReady,
      onImageError,
      croppered,
      onContextmenu
    };
  },

  render() {
    const {
      inSrc,
      isReady,
      onImageError,
      getClass,
      getImageStyle,
      onContextmenu,
      getWrapperStyle
    } = this;
    const { alt, crossorigin } = this.props;

    return inSrc ? (
      <div
        ref="tippyElRef"
        class={getClass}
        style={getWrapperStyle}
        onContextmenu={event => onContextmenu(event)}
      >
        <img
          v-show={isReady}
          ref="imgElRef"
          style={getImageStyle}
          src={inSrc}
          alt={alt}
          onError={onImageError}
          crossorigin={crossorigin}
        />
      </div>
    ) : null;
  }
});
