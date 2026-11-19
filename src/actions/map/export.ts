// @ts-nocheck
import { EX, exSave, exportJob, runExport } from '../../export/dialog';
import { renderDialog } from '../../ui/dialog';

/** Export dialog. Keys are data-act names. */
export const exportActions = {
  queue: () => runExport(),
  excancel: () => { if (exportJob) exportJob.cancel = true; },
  exsave: () => exSave(),
  expfmt: (el) => { EX.fmt = el.dataset.v; renderDialog(); },
  expres: (el) => { EX.res[EX.fmt] = +el.dataset.v; renderDialog(); },
  expfps: (el) => { EX.fps[EX.fmt] = +el.dataset.v; renderDialog(); },
  exptrans: () => { EX.trans = !EX.trans; renderDialog(); },
};
