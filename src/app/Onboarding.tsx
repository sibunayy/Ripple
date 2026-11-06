import { useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import { useDialog } from '../ui/dialog';

const KEY = 'rf-onboarded-v1';
const seen = (() => { try { return localStorage.getItem(KEY) === '1'; } catch { return true; } })();
export const showOnboarding = signal(!seen);
export const finishOnboarding = () => { showOnboarding.value = false; try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ } };

const SLIDES: { title: string; body: string; glyph: string }[] = [
  { glyph: '✒︎', title: 'Draw, type, import', body: 'Shapes, the pen tool with editable curves, text with your own fonts, plus images, SVG, video and Lottie files.' },
  { glyph: '◷', title: 'Animate anything', body: 'Tap the stopwatch beside a property, move the playhead, change the value. Shape the motion in the graph editor or start from a preset.' },
  { glyph: '✦', title: 'Make it look great', body: 'Blend modes, masks, mattes, 29 effects, curves, 3D LUTs and custom shaders — all keyframable, all on the GPU.' },
  { glyph: '⇪', title: 'Share it', body: 'Export MP4, WebM, GIF, image sequences or Lottie. Back up whole projects as a single .ripple file. Add RippleFlow to your Home Screen to use it offline.' },
];

export function Onboarding() {
  const [i, setI] = useState(0);
  const ref = useDialog<HTMLDivElement>(finishOnboarding);
  const s = SLIDES[i]!, last = i === SLIDES.length - 1;
  return (
    <div class="scrim">
      <div class="dialog onboard" role="dialog" aria-modal="true" aria-label="Welcome to RippleFlow" ref={ref} tabIndex={-1}>
        <div class="glyph" aria-hidden="true">{s.glyph}</div>
        <h2>{s.title}</h2>
        <p>{s.body}</p>
        <div class="dots" aria-hidden="true">{SLIDES.map((_, k) => <i key={k} class={k === i ? 'on' : ''} />)}</div>
        <div class="row">
          <button class="btn" onClick={finishOnboarding}>Skip</button>
          <button class="btn primary" onClick={() => (last ? finishOnboarding() : setI(i + 1))}>{last ? 'Get started' : 'Next'}</button>
        </div>
      </div>
    </div>
  );
}
