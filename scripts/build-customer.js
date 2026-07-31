#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { validatePetpack } = require('../src/petpack-validator');

const projectRoot = path.resolve(__dirname, '..');

function printUsage() {
  console.log([
    '客户桌宠一键交付构建',
    '',
    '用法：',
    '  npm run build:customer -- --pet <file.petpack> [选项]',
    '',
    '选项：',
    '  --name <程序名称>          默认：<宠物名称>桌面宠物',
    '  --icon <icon.ico|png>      默认：使用宠物包预览图',
    '  --delivery-id <ascii-id>  默认：宠物 id',
    '  --output <目录>            默认：dist/customers/<宠物 id>',
    '  --allow-management        显示导入、切换和宠物库菜单',
    '  --keep-temp               保留临时构建目录便于排错',
    '  --help                    显示帮助',
    '',
    '示例：',
    '  npm run build:customer -- --pet pets/packages/xiaogou.petpack --name "小狗桌面宠物"'
  ].join('\n'));
}

function parseArgs(argv) {
  const options = { allowManagement: false, keepTemp: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--allow-management') options.allowManagement = true;
    else if (argument === '--keep-temp') options.keepTemp = true;
    else if (['--pet', '--name', '--icon', '--delivery-id', '--output'].includes(argument)) {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('参数缺少值：' + argument);
      options[{ '--pet': 'pet', '--name': 'name', '--icon': 'icon', '--delivery-id': 'deliveryId', '--output': 'output' }[argument]] = value;
      index += 1;
    } else throw new Error('未知参数：' + argument);
  }
  return options;
}

function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function runPetpackValidator(petPath) {
  const validator = path.join(projectRoot, 'skills', 'desktop-pet-maker', 'scripts', 'petpack_tool.py');
  if (!fs.statSync(validator, { throwIfNoEntry: false })?.isFile()) throw new Error('找不到 petpack_tool.py');
  const candidates = [];
  if (process.env.PYTHON) candidates.push({ command: process.env.PYTHON, prefix: [] });
  candidates.push({ command: 'python', prefix: [] }, { command: 'py', prefix: ['-3'] });
  for (const candidate of candidates) {
    const result = spawnSync(candidate.command, candidate.prefix.concat([validator, 'validate', petPath]), { cwd: projectRoot, stdio: 'inherit' });
    if (result.error && result.error.code === 'ENOENT') continue;
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('宠物资源包验证失败');
    return;
  }
  throw new Error('找不到 Python；请先安装 Python 和 Pillow');
}

function safeFileBase(value) {
  const cleaned = value.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').trim();
  if (!cleaned) throw new Error('程序名称不能生成合法的 Windows 文件名');
  return cleaned.slice(0, 80);
}

function ensureInside(base, target) {
  const resolvedBase = path.resolve(base);
  const resolvedTarget = path.resolve(target);
  if (resolvedTarget !== resolvedBase && !resolvedTarget.startsWith(resolvedBase + path.sep)) throw new Error('临时目录越界');
}

function buildCustomer(options) {
  if (!options.pet) throw new Error('必须提供 --pet <file.petpack>');
  const petPath = path.resolve(projectRoot, options.pet);
  if (!fs.statSync(petPath, { throwIfNoEntry: false })?.isFile() || path.extname(petPath).toLowerCase() !== '.petpack') throw new Error('找不到 .petpack：' + petPath);

  console.log('[1/5] 验证客户宠物包');
  const inspected = validatePetpack(petPath);
  runPetpackValidator(petPath);
  const manifest = inspected.manifest;
  const appName = String(options.name || (manifest.name + '桌面宠物')).trim();
  if (!appName || appName.length > 80) throw new Error('程序名称长度必须为 1 到 80 个字符');
  const deliveryId = String(options.deliveryId || manifest.id);
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(deliveryId)) throw new Error('delivery-id 只能使用小写字母、数字和连字符');
  const artifactBase = safeFileBase(appName);
  const packageHash = sha256(petPath);
  const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  const tempBase = path.join(projectRoot, 'tmp', 'customer-build');
  const stageRoot = path.join(tempBase, deliveryId + '-' + process.pid + '-' + Date.now());
  ensureInside(tempBase, stageRoot);
  const deliveryRoot = path.join(stageRoot, 'delivery');
  const buildOutput = path.join(stageRoot, 'output');
  fs.mkdirSync(deliveryRoot, { recursive: true });

  try {
    console.log('[2/5] 准备专属交付配置');
    fs.copyFileSync(petPath, path.join(deliveryRoot, 'pet.petpack'));
    let iconExtension;
    let iconData;
    if (options.icon) {
      const iconPath = path.resolve(projectRoot, options.icon);
      if (!fs.statSync(iconPath, { throwIfNoEntry: false })?.isFile()) throw new Error('找不到图标：' + iconPath);
      iconExtension = path.extname(iconPath).toLowerCase();
      if (!['.ico', '.png'].includes(iconExtension)) throw new Error('图标只支持 .ico 或 .png');
      iconData = fs.readFileSync(iconPath);
    } else {
      iconExtension = path.extname(manifest.preview).toLowerCase();
      if (iconExtension !== '.png') throw new Error('自动程序图标要求 pet.json 的 preview 为 PNG；也可以使用 --icon 指定图标');
      iconData = inspected.previewEntry.getData();
    }
    const iconName = 'app-icon' + iconExtension;
    fs.writeFileSync(path.join(deliveryRoot, iconName), iconData);
    const delivery = {
      schemaVersion: 1, mode: 'customer', deliveryId, petId: manifest.id, appName,
      petpack: 'pet.petpack', packageSha256: packageHash, allowPetManagement: options.allowManagement
    };
    fs.writeFileSync(path.join(deliveryRoot, 'delivery.json'), JSON.stringify(delivery, null, 2) + '\n', 'utf8');

    console.log('[3/5] 生成 Electron 客户构建配置');
    const relativeDelivery = path.relative(projectRoot, deliveryRoot).replace(/\\/g, '/');
    const relativeIcon = path.relative(projectRoot, path.join(deliveryRoot, iconName)).replace(/\\/g, '/');
    const config = {
      appId: 'com.desktop-pet.delivery.' + deliveryId.replace(/-/g, '.'),
      productName: appName,
      asar: true,
      ...(process.env.CUSTOMER_ELECTRON_DIST
        ? { electronDist: path.resolve(process.env.CUSTOMER_ELECTRON_DIST) }
        : {}),
      directories: { output: buildOutput },
      win: { icon: relativeIcon, target: ['portable'], signExecutable: false },
      portable: { artifactName: artifactBase + '-' + packageJson.version + '.${ext}' },
      files: [
        'src/main-v3.js',
        'src/preload-v3.js',
        'src/index-v3.html',
        'src/styles-v3.css',
        'src/renderer-v3.js',
        'src/petpack-validator.js',
        'src/window-interactions.js',
        'src/window-discovery.js',
        'src/interaction-controller.js',
        'src/topmost-guard.js',
        { from: relativeDelivery, to: 'delivery', filter: ['**/*'] },
        'package.json'
      ]
    };
    const configPath = path.join(stageRoot, 'electron-builder.json');
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

    console.log('[4/5] 构建 Windows 便携版 EXE');
    const builderCli = path.join(projectRoot, 'node_modules', 'electron-builder', 'out', 'cli', 'cli.js');
    if (!fs.statSync(builderCli, { throwIfNoEntry: false })?.isFile()) throw new Error('找不到 electron-builder，请先运行 npm install');
    const result = spawnSync(process.execPath, [builderCli, '--win', 'portable', '--config', configPath, '--publish', 'never'], { cwd: projectRoot, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error('electron-builder 构建失败');

    console.log('[5/5] 输出客户交付文件');
    const executable = fs.readdirSync(buildOutput).filter((name) => name.toLowerCase().endsWith('.exe')).map((name) => path.join(buildOutput, name))[0];
    if (!executable) throw new Error('构建完成但没有找到便携版 EXE');
    const destinationRoot = path.resolve(projectRoot, options.output || path.join('dist', 'customers', deliveryId));
    fs.mkdirSync(destinationRoot, { recursive: true });
    const destination = path.join(destinationRoot, path.basename(executable));
    fs.copyFileSync(executable, destination);
    const report = {
      schemaVersion: 1, builtAt: new Date().toISOString(), appName, deliveryId, petId: manifest.id,
      petName: manifest.name, petpack: path.basename(petPath), petpackSha256: packageHash,
      executable: path.basename(destination), executableSha256: sha256(destination), version: packageJson.version
    };
    fs.writeFileSync(path.join(destinationRoot, 'build-report.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
    console.log('\n客户交付构建完成：\n' + destination);
    console.log('构建报告：\n' + path.join(destinationRoot, 'build-report.json'));
    return destination;
  } finally {
    if (options.keepTemp) console.log('已保留临时目录：' + stageRoot);
    else if (fs.existsSync(stageRoot)) { ensureInside(tempBase, stageRoot); fs.rmSync(stageRoot, { recursive: true, force: true }); }
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) printUsage();
  else buildCustomer(options);
} catch (error) {
  console.error('\n客户交付构建失败：' + error.message);
  process.exitCode = 1;
}
