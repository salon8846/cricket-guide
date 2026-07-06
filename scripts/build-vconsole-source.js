const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const vConsolePath = require.resolve('vconsole/dist/vconsole.min.js', { paths: [projectRoot] });
const outputPath = path.join(projectRoot, 'src/constants/vconsoleSource.js');
const source = fs.readFileSync(vConsolePath, 'utf8');

fs.writeFileSync(
    outputPath,
    `const vConsoleSource = ${JSON.stringify(source)};\n\nexport default vConsoleSource;\n`,
);
