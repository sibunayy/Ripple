import { S } from '../state/state';

/* Composition overlays: title/action safe areas and a rule-of-thirds grid. Drawn over the stage, never exported. */
export function guideHtml() {
  if (S.guide === 'safe') return '<div class="gd" aria-hidden="true"><i style="inset:5%"></i><i style="inset:10%"></i><b style="left:50%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="top:50%;left:0;right:0;height:0;border-top-width:1px"></b></div>';
  if (S.guide === 'thirds') return '<div class="gd" aria-hidden="true"><b style="left:33.333%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="left:66.666%;top:0;bottom:0;width:0;border-left-width:1px"></b><b style="top:33.333%;left:0;right:0;height:0;border-top-width:1px"></b><b style="top:66.666%;left:0;right:0;height:0;border-top-width:1px"></b></div>';
  return '';
}
