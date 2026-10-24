import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const target = 'node_modules/metal-fx';
const patch = join(root, 'patches/metal-fx@2.0.11.patch');

function gitApply(...flags) {
  const result = spawnSync('git', ['apply', ...flags, `--directory=${target}`, '--', patch], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.error) throw new Error(`Git is required to apply the metal-fx patch: ${result.error.message}`);
  return result;
}

try {
  const installed = JSON.parse(readFileSync(join(root, target, 'package.json'), 'utf8'));
  if (installed.version !== '2.0.11') {
    throw new Error(`The maintained metal-fx patch requires 2.0.11; installed version is ${installed.version}. Update the patch before changing this dependency.`);
  }
  readFileSync(patch);
  const check = gitApply('--check');
  if (check.status === 0) {
    const applied = gitApply();
    if (applied.status !== 0) throw new Error(`Could not apply the metal-fx patch: ${applied.stderr.trim()}`);
    if (gitApply('--reverse', '--check').status !== 0) throw new Error('The metal-fx patch applied but verification failed. Reinstall dependencies before retrying.');
    console.log('Applied metal-fx 2.0.11 WebGL context patch.');
  } else if (gitApply('--reverse', '--check').status === 0) {
    console.log('metal-fx 2.0.11 WebGL context patch is already applied.');
  } else {
    throw new Error(`Cannot apply metal-fx 2.0.11 patch: installed files match neither the original nor patched version. Reinstall dependencies and verify patches/metal-fx@2.0.11.patch.\n${check.stderr.trim()}`);
  }
} catch (error) {
  console.error(`Dependency patch failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
