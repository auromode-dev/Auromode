const fs = require('node:fs');
const descriptions = { de: 'Baumbeschatteter Innenhof bei Auromode', es: 'Patio sombreado por árboles en Auromode', fr: 'Cour ombragée par les arbres à Auromode', hi: 'ऑरोमोड में पेड़ों की छाया वाला आँगन', it: 'Cortile ombreggiato dagli alberi ad Auromode', nl: 'Binnenplaats in de schaduw van bomen bij Auromode', ru: 'Двор в тени деревьев в Auromode', ta: 'ஆரோமோடில் மர நிழல் சூழ்ந்த முற்றம்', 'zh-Hans': 'Auromode 树荫下的庭院' };
for (const [locale, description] of Object.entries(descriptions)) {
  const path = `lib/translations/${locale}.json`;
  const content = fs.readFileSync(path, 'utf8');
  fs.writeFileSync(path, content.replace(/\n}(\s*)$/, `,\n  "Tree-shaded courtyard at Auromode": ${JSON.stringify(description)}\n}$1`));
  JSON.parse(fs.readFileSync(path, 'utf8'));
}
const path = 'public/images/sources.json';
let content = fs.readFileSync(path, 'utf8');
const entries = [1, 2, 3].map(i => `    "slide0${i}.webp": "User-supplied public/slide0${i}.JPG; converted to 2560px-wide WebP for the home hero.",`).join('\n');
fs.writeFileSync(path, content.replace('{', '{\n' + entries));
