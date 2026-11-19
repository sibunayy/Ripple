// Some modules look up their elements (#stage, #ink, ...) when they load, as the prototype did.
// Give them the real page skeleton from index.html before any test imports them.
import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf8');
const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)![1].replace(/<script[\s\S]*?<\/script>/gi, '');
document.body.innerHTML = body;
