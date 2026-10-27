import https from 'https';

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
  });
}

function transformPluginBundle(code) {
  const specifiers = ['react', 'react/jsx-dev-runtime', 'react/jsx-runtime', 'react-dom', 'remotion'];

  for (const spec of specifiers) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/');
    code = code.replace(
      new RegExp(`import\\s+(\\w+)\\s*,\\s*\\{([^}]+)\\}\\s*from\\s*["']${escaped}["']\\s*;?`, 'g'),
      (_match, defaultName, namedNames) => {
        const jsNames = namedNames.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2');
        return `const ${defaultName} = globalThis.__pluginDeps["${spec}"];\nconst {${jsNames}} = globalThis.__pluginDeps["${spec}"];`;
      }
    );
  }

  for (const spec of specifiers) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/');
    code = code.replace(
      new RegExp(`import\\s+(\\w+)\\s+from\\s*["']${escaped}["']\\s*;?`, 'g'),
      (_match, name) => `const ${name} = globalThis.__pluginDeps["${spec}"];`
    );
  }

  for (const spec of specifiers) {
    const escaped = spec.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\//g, '\\/');
    code = code.replace(
      new RegExp(`import\\s*\\{([^}]+)\\}\\s*from\\s*["']${escaped}["']\\s*;?`, 'g'),
      (_match, names) => {
        const jsNames = names.replace(/(\w+)\s+as\s+(\w+)/g, '$1: $2');
        return `const {${jsNames}} = globalThis.__pluginDeps["${spec}"];`;
      }
    );
  }

  return code;
}

function transformExports(code) {
  code = code.replace(/export\s*\{\s*(\w+)\s+as\s+default\s*\}\s*;?/g, (_, name) => `return { default: ${name} }`);
  code = code.replace(/export\s*\{[^}]*\}\s*;?/g, '');
  code = code.replace(/export\s+default\s+(function|class)\s+(\w+)/g, (_, kind, name) => `${kind} ${name}\nreturn { default: ${name} }`);
  code = code.replace(/export\s+default\s+/g, 'return { default: ');
  return code;
}

const url = 'https://remotionlambda-useast1-l722vmwfn0.s3.us-east-1.amazonaws.com/sites/skygen-renderer/plugins/docu-blood-v3.js';
const raw = await fetch(url);
console.log('=== ORIGINAL (first 3 lines) ===');
raw.split('\n').slice(0, 3).forEach(l => console.log(l));

const afterImports = transformPluginBundle(raw);
console.log('\n=== AFTER transformPluginBundle (first 5 lines) ===');
afterImports.split('\n').slice(0, 5).forEach(l => console.log(l));

// Check remaining imports
const remainingImports = afterImports.match(/^import\s/gm);
console.log('\nRemaining import statements:', remainingImports?.length || 0);

const afterExports = transformExports(afterImports);
console.log('\n=== AFTER transformExports (last 5 lines) ===');
afterExports.split('\n').slice(-5).forEach(l => console.log(l));

console.log('\nHas return { default:', afterExports.includes('return { default:'));

// Try to evaluate
try {
  globalThis.__pluginDeps = {
    'react': { default: { createElement: () => {}, useState: () => [null, () => {}], useEffect: () => {} } },
    'remotion': { AbsoluteFill: () => {}, useCurrentFrame: () => 0, useVideoConfig: () => ({ fps: 30, durationInFrames: 90 }), interpolate: () => 0, spring: () => 1, Img: () => {}, Audio: () => {}, delayRender: () => {}, continueRender: () => {} },
  };
  const factory = new Function(afterExports);
  const mod = factory();
  console.log('\nEval succeeded! Module:', typeof mod, 'default:', typeof mod?.default);
} catch (e) {
  console.log('\nEval FAILED:', e.message);
  // Show the line that failed
  const lines = afterExports.split('\n');
  const lineMatch = e.message.match(/line (\d+)/);
  if (lineMatch) {
    const line = parseInt(lineMatch[1]);
    console.log('Context:', lines.slice(Math.max(0, line - 3), line + 2).join('\n'));
  }
}
