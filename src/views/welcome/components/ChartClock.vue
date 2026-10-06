<script lang="ts" setup>
import { onBeforeUnmount, ref, watch, type Ref } from "vue";
import { useDark, useResizeObserver } from "@pureadmin/utils";
import { epColor } from "@/utils/chartTheme";

defineOptions({ name: "Clock" });
const digit = [
  [
    [0, 0, 1, 1, 1, 0, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 0, 1, 1, 0],
    [0, 0, 1, 1, 1, 0, 0]
  ], //0
  [
    [0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [1, 1, 1, 1, 1, 1, 1]
  ], //1
  [
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 1, 1, 1, 1, 1]
  ], //2
  [
    [1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 1, 1, 0, 0],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 0]
  ], //3
  [
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 0],
    [0, 0, 1, 1, 1, 1, 0],
    [0, 1, 1, 0, 1, 1, 0],
    [1, 1, 0, 0, 1, 1, 0],
    [1, 1, 1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 1, 1]
  ], //4
  [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0],
    [1, 1, 1, 1, 1, 1, 0],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 0]
  ], //5
  [
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 1, 1, 0, 0, 0],
    [0, 1, 1, 0, 0, 0, 0],
    [1, 1, 0, 0, 0, 0, 0],
    [1, 1, 0, 1, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 0]
  ], //6
  [
    [1, 1, 1, 1, 1, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0],
    [0, 0, 1, 1, 0, 0, 0]
  ], //7
  [
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 1, 1, 0]
  ], //8
  [
    [0, 1, 1, 1, 1, 1, 0],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [1, 1, 0, 0, 0, 1, 1],
    [0, 1, 1, 1, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 0, 1, 1],
    [0, 0, 0, 0, 1, 1, 0],
    [0, 0, 0, 1, 1, 0, 0],
    [0, 1, 1, 0, 0, 0, 0]
  ], //9
  [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 1, 1, 0],
    [0, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ] //:
];
/** 下落小球（数字由小球拼成，物理参数随帧更新） */
interface Ball {
  x: number;
  y: number;
  g: number;
  vx: number;
  vy: number;
  color: string;
}

const canvasRef = ref<HTMLCanvasElement>();
const divRef = ref<HTMLDivElement>();
const timer = ref<ReturnType<typeof setInterval>>();
// 画布上下文在 initCanvas 就绪后保存，供定时器与可见性恢复共用
let renderContext: CanvasRenderingContext2D | undefined;

const startTimer = () => {
  // 已在跑或画布尚未初始化时不重复启动；页面在后台时不启动（恢复可见时由
  // visibilitychange 拉起），避免重建画布发生在后台时空转
  if (timer.value || document.hidden) return;
  const context = renderContext;
  if (!context) return;
  timer.value = setInterval(() => {
    render(context);
  }, 50);
};

const stopTimer = () => {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = undefined;
  }
};

// 页面切到后台时暂停重绘（后台定时器被浏览器节流，持续空转无意义），回到前台恢复
const handleVisibilityChange = () => {
  if (document.hidden) {
    stopTimer();
  } else {
    startTimer();
  }
};
document.addEventListener("visibilitychange", handleVisibilityChange);

const maxBallCount = ref(100);
const storeTime = ref(new Date());
const radius = ref(7);
const winWidth = ref(0);
const winHeight = ref(0);
const balls = ref<Ball[]>([]);
const marginLeft = ref(10);
const marginTop = ref(30);
const distNumber = ref(15);
const { isDark } = useDark();
/** 小球色板与数字色：均取 EP 语义色，主题切换后重算（见 refreshTheme） */
const colors = ref<string[]>([]);
const digitColor = ref("");

const refreshTheme = () => {
  digitColor.value = epColor("primary");
  colors.value = [
    epColor("primary"),
    epColor("success"),
    epColor("warning"),
    epColor("danger"),
    epColor("info")
  ];
};

const initConfig = () => {
  refreshTheme();
  winWidth.value = divRef.value?.offsetWidth ?? 0;
  winHeight.value = divRef.value?.offsetHeight ?? 0;
  radius.value = Math.round((winWidth.value * 3) / 4 / 98) - 1;
};
const initCanvas = () => {
  const context = canvasRef.value?.getContext("2d");
  if (canvasRef.value && context) {
    canvasRef.value.width = winWidth.value;
    canvasRef.value.height = winHeight.value;
    renderContext = context;
    render(context); //初始启动绘画
    startTimer();
  }
};

const renderBall = (
  nextHours: number,
  nextMinutes: number,
  nextSeconds: number,
  beforeHours: number,
  beforeMinutes: number,
  beforeSeconds: number
) => {
  if (parseInt(beforeHours / 10) != parseInt(nextHours / 10))
    addBalls(marginLeft.value + 0, marginTop.value, parseInt(nextHours / 10));
  if (parseInt(beforeHours % 10) != parseInt(nextHours % 10))
    addBalls(
      marginLeft.value + 1 * distNumber.value * (radius.value + 1),
      marginTop.value,
      parseInt(nextHours % 10)
    );
  if (parseInt(beforeMinutes / 10) != parseInt(nextMinutes / 10))
    addBalls(
      marginLeft.value + 3 * distNumber.value * (radius.value + 1),
      marginTop.value,
      parseInt(nextMinutes / 10)
    );
  if (parseInt(beforeMinutes % 10) != parseInt(nextMinutes % 10))
    addBalls(
      marginLeft.value + 4 * distNumber.value * (radius.value + 1),
      marginTop.value,
      parseInt(nextMinutes % 10)
    );
  if (parseInt(beforeSeconds / 10) != parseInt(nextSeconds / 10))
    addBalls(
      marginLeft.value + 6 * distNumber.value * (radius.value + 1),
      marginTop.value,
      parseInt(nextSeconds / 10)
    );
  if (parseInt(beforeSeconds % 10) != parseInt(nextSeconds % 10))
    addBalls(
      marginLeft.value + 7 * distNumber.value * (radius.value + 1),
      marginTop.value,
      parseInt(nextSeconds % 10)
    );
};

const render = (cxt: CanvasRenderingContext2D) => {
  let nextTime = new Date();

  const nextHours = nextTime.getHours();
  const nextMinutes = nextTime.getMinutes();
  const nextSeconds = nextTime.getSeconds();

  const beforeHours = storeTime.value.getHours();
  const beforeMinutes = storeTime.value.getMinutes();
  const beforeSeconds = storeTime.value.getSeconds();

  cxt.clearRect(0, 0, cxt.canvas.width, cxt.canvas.height); //清除画布
  renderBall(
    nextHours,
    nextMinutes,
    nextSeconds,
    beforeHours,
    beforeMinutes,
    beforeSeconds
  ); //添加小球

  updateBalls(); //更新小球信息
  renderTime(nextHours, nextMinutes, nextSeconds, cxt); //绘制时间
  storeTime.value = nextTime;
};

const addBalls = (x: number, y: number, num: number) => {
  digit[num].forEach((digit, i) => {
    digit.forEach((item, j) => {
      if (item == 1) {
        let aBall: Ball = {
          x: x + j * 2 * (radius.value + 1) + (radius.value + 1),
          y: y + i * 2 * (radius.value + 1) + (radius.value + 1),
          g: 1.5 + Math.random(),
          vx: Math.pow(-1, Math.ceil(Math.random() * 1000)) * 4,
          vy: -10,
          // 色板为空（首帧尚未 initConfig）时回退主色，避免写入 undefined
          color:
            colors.value[Math.floor(Math.random() * colors.value.length)] ??
            epColor("primary")
        };
        balls.value.push(aBall);
      }
    });
  });
};
const updateBalls = () => {
  // 物理推进：逐球更新位置与速度
  balls.value.forEach(ball => {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += ball.g;
    if (ball.y >= winHeight.value - radius.value) {
      ball.y = winHeight.value - radius.value;
      ball.vy = -ball.vy * 0.75;
    }
  });
  // 淘汰飞出屏幕的小球：整帧只做一次压缩（原实现在每个球的循环里重复压缩，整帧 O(n²)）
  let cnt = 0;
  balls.value.forEach(item => {
    if (item.x + radius.value > 0 && item.x - radius.value < winWidth.value)
      balls.value[cnt++] = item;
  });
  while (balls.value.length > cnt) {
    balls.value.pop();
  }
  // 超出上限时随机丢弃，控制总量
  if (balls.value.length > maxBallCount.value) {
    const delLen = balls.value.length - maxBallCount.value;
    for (let i = 0; i < delLen; i++) {
      const max = balls.value.length - 20;
      const min = 1;
      const num = Math.floor(Math.random() * (max - min + 1) + min);
      balls.value.splice(num, 1);
    }
  }
};
const renderTime = (
  hours: number,
  minutes: number,
  seconds: number,
  cxt: CanvasRenderingContext2D
) => {
  renderDigit(marginLeft.value, marginTop.value, parseInt(hours / 10), cxt); //绘制数字
  renderDigit(
    marginLeft.value + distNumber.value * (radius.value + 1),
    marginTop.value,
    parseInt(hours % 10),
    cxt
  );
  renderDigit(
    marginLeft.value + 2 * distNumber.value * (radius.value + 1),
    marginTop.value,
    10,
    cxt
  );
  renderDigit(
    marginLeft.value + 3 * distNumber.value * (radius.value + 1),
    marginTop.value,
    parseInt(minutes / 10),
    cxt
  );
  renderDigit(
    marginLeft.value + 4 * distNumber.value * (radius.value + 1),
    marginTop.value,
    parseInt(minutes % 10),
    cxt
  );
  renderDigit(
    marginLeft.value + 5 * distNumber.value * (radius.value + 1),
    marginTop.value,
    10,
    cxt
  );
  renderDigit(
    marginLeft.value + 6 * distNumber.value * (radius.value + 1),
    marginTop.value,
    parseInt(seconds / 10),
    cxt
  );
  renderDigit(
    marginLeft.value + 7 * distNumber.value * (radius.value + 1),
    marginTop.value,
    parseInt(seconds % 10),
    cxt
  );

  balls.value.forEach(ball => {
    cxt.fillStyle = ball.color;
    cxt.beginPath();
    cxt.arc(ball.x, ball.y, radius.value, 0, 2 * Math.PI, true);
    cxt.closePath();
    cxt.fill();
  });
};
const renderDigit = (
  x: number,
  y: number,
  num: number,
  cxt: CanvasRenderingContext2D
) => {
  cxt.fillStyle = digitColor.value;
  digit[num].forEach((item, i) => {
    item.forEach((dig, j) => {
      if (dig == 1) {
        let R = radius.value;
        let centerX = x + j * 2 * (R + 1) + (R + 1);
        let centerY = y + i * 2 * (R + 1) + (R + 1);
        cxt.beginPath();
        cxt.arc(centerX, centerY, R, 0, 2 * Math.PI);
        cxt.closePath();
        cxt.fill();
      }
    });
  });
};

/** 重建画布：容器尺寸变化与主题切换共用（色板在 initConfig 内按主题重算） */
const restart = () => {
  stopTimer();
  initConfig();
  initCanvas();
};

// 模板 ref 挂载后必然有值；useResizeObserver 的 ElementRef 不含 undefined，边界收窄
useResizeObserver(divRef as Ref<HTMLDivElement>, restart);
// 暗色/亮色切换：数字与小球取色不同，重建一次画布
watch(isDark, restart);

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  stopTimer();
});
</script>

<template>
  <div ref="divRef" class="size-full">
    <canvas ref="canvasRef" />
  </div>
</template>
