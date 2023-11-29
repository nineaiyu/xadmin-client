export function formatTimes(times) {
  const h = Math.floor(times / 3600);
  const m = Math.floor((times - 3600 * h) / 60);
  const s = Math.floor(times % 60);
  let fs = "";
  if (h > 0) {
    fs = `${h}:`;
  }
  if (h > 0 || m > 0) {
    fs += `${m}:`;
  }
  fs += `${s}`;
  return fs;
}
