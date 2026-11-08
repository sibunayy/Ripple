import { ICONS, type IconName } from './icons-data';

export type { IconName };

/** Inline Lucide icon: stroke follows `currentColor`, decorative (`aria-hidden`) — give the parent button an aria-label. */
export function Icon({ name, size = 18, fill }: { name: IconName; size?: number; fill?: boolean }) {
  return (
    <svg class="ico" width={size} height={size} viewBox="0 0 24 24" fill={fill ? 'currentColor' : 'none'} stroke="currentColor"
      stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"
      dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
  );
}
