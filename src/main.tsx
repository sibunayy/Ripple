import { render } from 'preact';
import './ui/theme.css';
import { App } from './app/App';
import { initPWA } from './app/pwa';

initPWA();
render(<App />, document.getElementById('app')!);
