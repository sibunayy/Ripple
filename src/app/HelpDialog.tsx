import { useState } from 'preact/hooks';
import { useDialog } from '../ui/dialog';

declare const __APP_VERSION__: string;
type Tab = 'guide' | 'keys' | 'formats' | 'about';

export const SHORTCUTS: [string, string][] = [
  ['Space', 'Play / pause'], ['← / →', 'Step one frame (Shift: ten)'], ['Home / End', 'Jump to start / end'], ['Alt + ← / →', 'Previous / next keyframe'],
  ['I / O', 'Set work-area in / out'], ['M', 'Add marker'], ['⌘Z / ⇧⌘Z', 'Undo / redo'], ['⌘S', 'Save now'], ['⌘D', 'Duplicate layer'], ['⌘C / ⌘V', 'Copy / paste keyframes'], ['⌘⇧ ← / →', 'Nudge selected keyframes'],
  ['Delete', 'Delete keyframes, node or layer'], ['V', 'Select tool'], ['H', 'Hand tool'], ['R · E · Y · S', 'Rectangle · Ellipse · Polygon · Star'], ['L', 'Line'], ['P', 'Pen (Enter finishes, Esc cancels)'], ['T', 'Text'],
  ['Shift while scaling', 'Uniform scale'], ['Shift while rotating', 'Snap to 15°'], ['Alt while dragging', 'Disable snapping'], ['Alt while dragging a handle', 'Break node symmetry'], ['?', 'This help'],
];

const GUIDE: [string, string][] = [
  ['Draw & type', 'Pick a tool on the left of the viewer (or press R, E, Y, S, L, P, T). Drag to size a shape, tap for the default size. With the Pen, tap for corner points and drag for smooth curves; tap the first point to close. Double-tap a path to add a node.'],
  ['Animate', 'Tap the ◷ stopwatch beside any property to start animating it. Move the playhead and change the value to add keyframes. Open the Graph tab in the timeline to shape the easing curves, or apply a ready-made motion from Presets.'],
  ['Layers, masks & mattes', 'Layers stack top to bottom. Give a layer a blend mode, masks (Inspector → Masks), a track matte, or pre-compose a selection into its own composition. Adjustment layers apply effects to everything below.'],
  ['Effects & colour', 'Effects tab → Add effect. Blur, glow, shadows, distortions, Levels, Curves, 3D LUTs and your own shaders are all keyframable. Turn on linear-light compositing in Settings for physically based blending.'],
  ['Media', 'Import images, SVG (as editable shapes), video and Lottie files from the Library or the Assets tab, or drop files onto the viewer.'],
  ['Export & backup', 'Export → MP4, WebM, GIF, image sequences, stills or Lottie. “Project backup (.ripple)” bundles the project, media and fonts into one file you can import on any device.'],
  ['Touch & Pencil', 'Pinch to zoom the viewer, two fingers to pan. When you draw with the Pencil, resting palms are ignored. Numeric fields scrub: drag the small label sideways.'],
];

const FORMATS: [string, string][] = [
  ['Video', 'MP4 (H.264) and WebM (VP9) via WebCodecs — availability depends on your device and browser.'], ['GIF', 'Animated GIF, optional transparency, defaults to half size.'],
  ['Images', 'PNG, JPEG, WebP stills and sequences (zip); PNG/WebP can keep a transparent background.'],
  ['Lottie', 'Export targets lottie-web compatible players. Effects, shaders, video and adjustment layers have no Lottie equivalent and are listed in the compatibility report.'],
  ['Import', 'PNG, JPEG, WebP, AVIF, HEIC (where decodable), SVG, MP4/MOV/WebM video, Lottie (.json, .lottie), .ripple bundles, fonts (.ttf .otf .woff .woff2), 3D LUTs (.cube).'],
  ['Audio', 'Not part of v1: videos play muted and exports have no sound track.'],
];

const LICENCES: [string, string][] = [
  ['RippleFlow', 'MIT'], ['Preact, @preact/signals', 'MIT'], ['fflate', 'MIT'], ['mp4-muxer, webm-muxer', 'MIT'], ['gifenc', 'MIT'],
  ['Inter', 'SIL Open Font License 1.1'], ['Source Serif 4', 'SIL Open Font License 1.1'], ['JetBrains Mono', 'SIL Open Font License 1.1'], ['Space Grotesk', 'SIL Open Font License 1.1'],
];

export function HelpDialog({ onClose, start = 'guide' }: { onClose: () => void; start?: Tab }) {
  const [tab, setTab] = useState<Tab>(start);
  const ref = useDialog<HTMLDivElement>(onClose);
  const tabs: [Tab, string][] = [['guide', 'Guide'], ['keys', 'Shortcuts'], ['formats', 'Formats'], ['about', 'About']];
  return (
    <div class="scrim" onClick={onClose}>
      <div class="dialog help" role="dialog" aria-modal="true" aria-label="Help" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <nav class="tabs" role="tablist">{tabs.map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        {tab === 'guide' && <dl class="faq">{GUIDE.map(([h, b]) => <div key={h}><dt>{h}</dt><dd>{b}</dd></div>)}</dl>}
        {tab === 'keys' && <table class="keys"><tbody>{SHORTCUTS.map(([k, d]) => <tr key={k}><th scope="row"><kbd>{k}</kbd></th><td>{d}</td></tr>)}</tbody></table>}
        {tab === 'formats' && <dl class="faq">{FORMATS.map(([h, b]) => <div key={h}><dt>{h}</dt><dd>{b}</dd></div>)}</dl>}
        {tab === 'about' && (
          <div class="about">
            <p><strong>RippleFlow</strong> <span class="hint">v{__APP_VERSION__}</span> — a lightweight motion-graphics editor that runs entirely in your browser and works offline once installed. Your projects and media stay on this device.</p>
            <h3>Open-source licences</h3>
            <ul class="lic">{LICENCES.map(([n, l]) => <li key={n}><span>{n}</span><span>{l}</span></li>)}</ul>
            <p class="hint">The name “RippleFlow” is a working title and has not yet been through a trademark clearance.</p>
          </div>
        )}
        <div class="row"><button class="btn primary" onClick={onClose}>Close</button></div>
      </div>
    </div>
  );
}
