// Generates a pad + in-key plucks soundtrack with ffmpeg, chords changing on scene cuts.
// Usage: node scripts/make-music.mjs <prequel|landed> <out.m4a>
import { execFileSync } from "node:child_process";

const SONGS = {
  prequel: {
    dur: 21,
    cuts: [0, 3.0, 6.4, 10.6, 14.6, 18.0],
    // A minor: Am, F, C, G, Am, Am(add9)
    chords: [
      [110, 130.81, 164.81],
      [87.31, 110, 130.81],
      [130.81, 164.81, 196],
      [98, 123.47, 146.83],
      [110, 130.81, 164.81],
      [110, 164.81, 246.94],
    ],
  },
  landed: {
    dur: 22,
    cuts: [0, 3.6, 7.4, 11.8, 15.2, 18.6],
    // D major: Dmaj7, Bm7, Gmaj7, A, Dmaj7, Dmaj9
    chords: [
      [146.83, 185, 220, 277.18],
      [123.47, 146.83, 185, 220],
      [98, 123.47, 146.83, 185],
      [110, 138.59, 164.81, 220],
      [146.83, 185, 220, 277.18],
      [146.83, 220, 277.18, 329.63],
    ],
  },
};

const [name, out] = process.argv.slice(2);
const song = SONGS[name];
if (!song || !out) throw new Error("usage: make-music.mjs <prequel|landed> <out.m4a>");
const X = 0.45; // crossfade half-width at each cut

const f = (x) => x.toFixed(3);
const parts = [];
song.chords.forEach((ch, i) => {
  const a = song.cuts[i];
  const b = song.cuts[i + 1] ?? song.dur;
  const env = `clip((t-${f(a - X)})/${f(2 * X)},0,1)*clip((${f(b + X)}-t)/${f(2 * X)},0,1)`;
  // detuned pairs for warmth, a slow breathing tremolo, and a soft sub on the root
  const voices = ch.map((hz) => `sin(2*PI*${f(hz)}*t)+0.6*sin(2*PI*${f(hz * 1.004)}*t+1.3)`).join("+");
  const sub = `0.7*sin(2*PI*${f(ch[0] / 2)}*t)`;
  parts.push(`${env}*(1+0.12*sin(2*PI*0.21*t))*(0.055*(${voices})+0.06*${sub})`);
  // pluck on the cut: fifth of the chord, two octaves up, fast attack, gentle decay
  if (i > 0) {
    const hz = ch[Math.min(2, ch.length - 1)] * 4;
    parts.push(`gt(t,${f(a)})*exp(-(t-${f(a)})*4.5)*0.07*sin(2*PI*${f(hz)}*t)*clip((t-${f(a)})*80,0,1)`);
  }
});
const expr = parts.join("+");
const filter = [
  `aevalsrc=exprs='${expr}':s=48000:d=${song.dur}`,
  "lowpass=f=2600",
  "aecho=0.8:0.6:70|140:0.22|0.14",
  "afade=t=in:st=0:d=0.8",
  `afade=t=out:st=${song.dur - 1.6}:d=1.6`,
  "loudnorm=I=-19:TP=-2:LRA=9",
  "aformat=channel_layouts=stereo",
].join(",");
execFileSync("ffmpeg", ["-loglevel", "error", "-y", "-filter_complex", filter, "-t", String(song.dur), "-c:a", "aac", "-b:a", "192k", out], { stdio: "inherit" });
console.log("wrote", out);
