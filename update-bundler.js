const fs = require('fs');
const dump = JSON.parse(fs.readFileSync('exports-dump.json', 'utf8'));
let content = fs.readFileSync('src/lib/plugins/preview-bundler.ts', 'utf8');

const mappings = {
  'three': '__pv_three',
  '@react-three/fiber': '__pv_react_three_fiber',
  '@react-three/drei': '__pv_react_three_drei',
  '@react-three/postprocessing': '__pv_react_three_postprocessing',
  'postprocessing': '__pv_postprocessing',
  '@remotion/three': '__pv_remotion_three'
};

let coreAdditions = '';
for (const [pkg, exports] of Object.entries(dump)) {
  const globalKey = mappings[pkg];
  coreAdditions += `  '${pkg}': ['${globalKey}', [\n`;
  let line = '    ';
  for (const exp of exports) {
    const item = `'${exp}',`;
    if (line.length + item.length > 80) {
      coreAdditions += line + '\n';
      line = '    ' + item;
    } else {
      line += line === '    ' ? item : ' ' + item;
    }
  }
  if (line !== '    ') coreAdditions += line + '\n';
  coreAdditions += `  ]],\n`;
}

const coreEndIndex = content.indexOf('};\n\nconst DYNAMIC_BRIDGE_PACKAGES');
if (coreEndIndex === -1) throw new Error('Could not find end of CORE_BRIDGE_PACKAGES');

content = content.slice(0, coreEndIndex) + coreAdditions + content.slice(coreEndIndex);

content = content.replace(
  /const DYNAMIC_BRIDGE_PACKAGES: Record<string, string> = \{[^}]*\};/s,
  'const DYNAMIC_BRIDGE_PACKAGES: Record<string, string> = {};'
);

fs.writeFileSync('src/lib/plugins/preview-bundler.ts', content);
console.log('Successfully updated preview-bundler.ts');
