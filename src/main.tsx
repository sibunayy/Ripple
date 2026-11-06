import { render } from 'preact';
import './ui/theme.css';
import { App } from './app/App';
import { initPWA } from './app/pwa';
import { initFonts } from './text/fonts';
import { restoreJobs } from './export/queue';

initPWA();
void initFonts();
void restoreJobs();
render(<App />, document.getElementById('app')!);
