import { render } from 'preact';
import './ui/theme.css';
import { App } from './app/App';
import { initPWA } from './app/pwa';
import { initFonts } from './text/fonts';

initPWA();
void initFonts();
render(<App />, document.getElementById('app')!);
