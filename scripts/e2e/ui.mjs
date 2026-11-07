// Single source of truth for how the e2e suite finds UI. When the interface is redesigned, keep the
// data-testid landmarks and aria-labels (docs/ui-contract.md) and this file is the only place that should change.
export const UI = {
  library: '[data-testid=library]',
  card: '[data-testid=project-card]',
  editor: '[data-testid=editor]',
  topbar: '[data-testid=topbar]',
  viewerPanel: '[data-testid=viewer-panel]',
  stage: '[data-testid=stage]',
  sidePanel: '[data-testid=side-panel]',
  timeline: '[data-testid=timeline]',
  layerRow: '[data-testid=layer-row]',
  layerRowSelected: '[data-testid=layer-row][data-selected=true]',
  dialog: '[role=dialog]',
};
