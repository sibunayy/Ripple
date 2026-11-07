import { render } from 'preact';
import './ui/theme.css';
import { App } from './app/App';
import { initPWA } from './app/pwa';
import { initFonts } from './text/fonts';
import { restoreJobs } from './export/queue';

// iPadOS Safari ignores user-scalable=no; stop its pinch-zoom gesture on the UI (the viewer zooms its own canvas).
for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, (e) => e.preventDefault());

initPWA();
void initFonts();
void restoreJobs();
render(<App />, document.getElementById('app')!);
