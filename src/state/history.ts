// @ts-nocheck
import { layers, saveProj, setLayers } from '../model/project';
import { lay } from '../anim/interpolate';
import { S } from './state';
import { buildCanvas } from '../render/stage';
import { renderAll } from '../ui/layout';

export let hist = [JSON.stringify(layers)], hi = 0;
export function commit(label) { hist = hist.slice(0, hi + 1); hist.push(JSON.stringify(layers)); hi = hist.length - 1; lastLabel = label; saveProj(); }
export let lastLabel = '';
export function undo() { if (hi <= 0) return; hi--; setLayers(JSON.parse(hist[hi])); afterHist(); }
export function redo() { if (hi >= hist.length - 1) return; hi++; setLayers(JSON.parse(hist[hi])); afterHist(); }
function afterHist() { if (S.sel && !lay(S.sel)) S.sel = null; S.keys = S.keys.filter((k) => lay(k.l)); buildCanvas(); renderAll(); }
export function setLastLabel(v) { return (lastLabel = v); }
