// Downloads the Galmuri font package (SIL OFL 1.1) that build-font.mjs packs into js/core/fontdata.js.
// Only needed to regenerate the font data; the game itself ships the packed result.
// Usage: node fetch-font.mjs [--dest <folder>]   (default: tools/tmp)
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const VERSION = '2.40.3';
const here = path.dirname(fileURLToPath(import.meta.url));
const i = process.argv.indexOf('--dest');
const dest = path.resolve(i > 0 ? process.argv[i + 1] : path.join(here, 'tmp'));
const dist = path.join(dest, 'package', 'dist');

if (fs.existsSync(path.join(dist, 'Galmuri11.bdf'))) {
  console.log('갈무리 글꼴 원본이 이미 있습니다:', dist);
  process.exit(0);
}
fs.mkdirSync(dest, { recursive: true });
console.log(`galmuri@${VERSION} 내려받는 중...`);
execSync(`npm pack galmuri@${VERSION} --pack-destination "${dest}"`, { stdio: 'inherit' });
const tgz = path.join(dest, `galmuri-${VERSION}.tgz`);
execSync(`tar -xzf "${tgz}" -C "${dest}"`, { stdio: 'inherit' });
if (!fs.existsSync(path.join(dist, 'Galmuri11.bdf'))) {
  console.error('압축을 풀었지만 BDF 파일을 찾지 못했습니다:', dist);
  process.exit(1);
}
console.log('완료:', dist);
