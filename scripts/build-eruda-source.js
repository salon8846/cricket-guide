const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const erudaPath = require.resolve('eruda', { paths: [projectRoot] });
const outputPath = path.join(projectRoot, 'src/constants/erudaSource.js');
const source = fs.readFileSync(erudaPath, 'utf8');

fs.writeFileSync(
    outputPath,
    `const erudaSource = ${JSON.stringify(source)};\n\nexport default erudaSource;\n`,
);
