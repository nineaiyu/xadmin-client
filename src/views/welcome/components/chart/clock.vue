<script lang="ts" setup>
import { onBeforeUnmount, ref } from "vue";
import { useResizeObserver } from "@pureadmin/utils";

defineOptions({ name: "clock" });
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
const canvasRef = ref(null);
const divRef = ref(null);
const timer = ref(null);

const maxBallCount = ref(100);
const storeTime = ref(new Date());
const radius = ref(7);
const winWidth = ref(0);
const winHeight = ref(0);
const balls = ref([]);
const marginLeft = ref(10);
const marginTop = ref(30);
const distNumber = ref(15);
const colors = ref([
  "red",
  "#33B5E5",
  "#0099CC",
  "#AA66CC",
  "#9933CC",
  "#99CC00",
  "#669900",
  "#FFBB33",
  "#FF8800",
  "#FF444"
]);

const initConfig = () => {
  winWidth.value = divRef.value?.offsetWidth;
  winHeight.value = divRef.value?.offsetHeight;
  radius.value = Math.round((winWidth.value * 3) / 4 / 98) - 1;
};
const initCanvas = () => {
  let context = canvasRef.value?.getContext("2d");
  if (canvasRef.value) {
    canvasRef.value.width = winWidth.value;
    canvasRef.value.height = winHeight.value;
    render(context); //初始启动绘画
    timer.value = setInterval(() => {
      render(context);
    }, 50);
  }
};

const renderBall = (
  nextHours,
  nextMinutes,
  nextSeconds,
  beforeHours,
  beforeMinutes,
  beforeSeconds
) => {
  if (parseInt(beforeHours / 10) != parseInt(nextHours / 10))
    addBalls(marginLeft.value + 0, marginTop, parseInt(nextHours / 10));
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

const render = cxt => {
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

const addBalls = (x, y, num) => {
  digit[num].forEach((digit, i) => {
    digit.forEach((item, j) => {
      if (item == 1) {
        let aBall = {
          x: x + j * 2 * (radius.value + 1) + (radius.value + 1),
          y: y + i * 2 * (radius.value + 1) + (radius.value + 1),
          g: 1.5 + Math.random(),
          vx: Math.pow(-1, Math.ceil(Math.random() * 1000)) * 4,
          vy: -10,
          color: colors.value[Math.floor(Math.random() * colors.value.length)]
        };
        balls.value.push(aBall);
      }
    });
  });
};
const updateBalls = () => {
  balls.value.forEach((ball, index) => {
    ball.x += ball.vx;
    ball.y += ball.vy;
    ball.vy += ball.g;
    if (ball.y >= winHeight.value - radius.value) {
      ball.y = winHeight.value - radius.value;
      ball.vy = -ball.vy * 0.75;
    }

    let cnt = 0;
    balls.value.forEach((item, index) => {
      if (item.x + radius.value > 0 && item.x - radius.value < winWidth.value)
        balls.value[cnt++] = item;
    }); //在这个屏幕内的小球
    while (balls.value.length > cnt) {
      balls.value.pop();
    } //删除屏幕外的小球
    if (balls.value.length - maxBallCount.value) {
      let delLen = balls.value.length - maxBallCount.value;
      for (let i = 0; i < delLen; i++) {
        let max = balls.value.length - 20;
        let min = 1;
        let num = Math.floor(Math.random() * (max - min + 1) + min);
        balls.value.splice(num, 1);
      }
    } //随机删除超出200个小球的球
  });
};
const renderTime = (hours, minutes, seconds, cxt) => {
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

  balls.value.forEach((ball, index) => {
    cxt.fillStyle = ball.color;
    cxt.beginPath();
    cxt.arc(ball.x, ball.y, radius.value, 0, 2 * Math.PI, true);
    cxt.closePath();
    cxt.fill();
  });
};
const renderDigit = (x, y, num, cxt) => {
  cxt.fillStyle = "#3893fa";
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

useResizeObserver(divRef, () => {
  clearInterval(timer.value);
  initConfig();
  initCanvas();
});

onBeforeUnmount(() => {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
});
</script>

<template>
  <div ref="divRef" class="h-full w-full">
    <canvas ref="canvasRef" />
  </div>
</template>
