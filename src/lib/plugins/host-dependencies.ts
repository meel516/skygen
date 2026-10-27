import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

export function findHostPackageJson(): string {
  const candidates: string[] = [];
  if (process.env.HOST_PACKAGE_JSON) candidates.push(path.resolve(process.env.HOST_PACKAGE_JSON));
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    candidates.push(path.join(dir, 'package.json'));
    const parent = path.dirname(dir);
    if (dir === parent) break;
    dir = parent;
  }
  for (const file of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (pkg.dependencies?.react && pkg.dependencies?.['react-dom'] && pkg.dependencies?.remotion) return file;
    } catch { /* Try the next host root. */ }
  }
  throw new Error('Cannot find the SkyGen host package.json. Set HOST_PACKAGE_JSON to the deployed app manifest.');
}

const exactVersion = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
let cache: { key: string; versions: Record<string, string> } | undefined;

/** Installed versions describe the running app, including Bun deployments.
 * The npm lock is a fallback for source checkouts. Never treat a caret range
 * as the actual version running in the player. */
export function readHostDependencyVersions(): Record<string, string> {
  const manifest = findHostPackageJson();
  const root = path.dirname(manifest);
  const lockPath = path.join(root, 'package-lock.json');
  const stamp = (file: string) => { try { return fs.statSync(file).mtimeMs; } catch { return 0; } };
  const key = [manifest, stamp(manifest), stamp(lockPath), stamp(path.join(root, 'node_modules')), stamp(path.join(root, 'bun.lock'))].join(':');
  if (cache?.key === key) return { ...cache.versions };
  const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
  let lock: { packages?: Record<string, { version?: string }> } = {};
  try { lock = JSON.parse(fs.readFileSync(lockPath, 'utf8')); } catch { /* Deployments may omit the lock. */ }
  const hostRequire = createRequire(manifest);
  const declarations = { ...pkg.devDependencies, ...pkg.dependencies } as Record<string, string>;
  const names = new Set([...Object.keys(declarations), 'esbuild', 'typescript', 'buffer', 'semver', 'react-reconciler']);
  const versions: Record<string, string> = {};
  for (const name of names) {
    let installed: string | undefined;
    try {
      let packageFile: string;
      try {
        packageFile = hostRequire.resolve(`${name}/package.json`);
      } catch {
        // Some packages do not export package.json. Find it from their entry.
        let location = path.dirname(hostRequire.resolve(name));
        packageFile = '';
        while (location !== path.dirname(location)) {
          const candidate = path.join(location, 'package.json');
          if (fs.existsSync(candidate) && JSON.parse(fs.readFileSync(candidate, 'utf8')).name === name) {
            packageFile = candidate;
            break;
          }
          location = path.dirname(location);
        }
      }
      installed = JSON.parse(fs.readFileSync(packageFile, 'utf8')).version;
    } catch { /* Fall back to the lock or an exact manifest version. */ }
    const version = installed ?? lock.packages?.[`node_modules/${name}`]?.version ?? declarations[name];
    if (typeof version === 'string' && exactVersion.test(version)) versions[name] = version;
  }
  cache = { key, versions };
  return { ...versions };
}
