#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  buildFailureMessages,
  parseBoolean,
  resolveSigningReadiness,
} = require('./check-signing-readiness');

const DEFAULT_REPO = 'N1ghthill/botassist-whatsapp';

function hasValue(value) {
  return String(value || '').trim().length > 0;
}

function parseRequireSignedReleases(value, fallback = 'keep') {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return fallback;
  if (normalized === 'keep') return 'keep';
  return parseBoolean(normalized, fallback === 'true') ? 'true' : 'false';
}

function parseArgs(argv) {
  const args = {
    repo: process.env.GITHUB_REPOSITORY || DEFAULT_REPO,
    dryRun: false,
    runReadinessWorkflow: false,
    requireSignedReleases: parseRequireSignedReleases(
      process.env.BOTASSIST_REQUIRE_SIGNED_RELEASES,
      'keep'
    ),
    windowsCertFile: '',
    windowsCertPasswordEnv: '',
    macCertFile: '',
    macCertPasswordEnv: '',
    macCertName: '',
    appleApiKeyFile: '',
    appleApiKeyId: '',
    appleApiIssuer: '',
    appleId: '',
    appleAppSpecificPasswordEnv: '',
    appleTeamId: '',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = String(argv[index] || '');
    const next = String(argv[index + 1] || '');

    if ((current === '--repo' || current === '-R') && next) {
      args.repo = next;
      index += 1;
      continue;
    }
    if (current === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (current === '--run-readiness-workflow') {
      args.runReadinessWorkflow = true;
      continue;
    }
    if (current === '--require-signed-releases' && next) {
      args.requireSignedReleases = parseRequireSignedReleases(next, args.requireSignedReleases);
      index += 1;
      continue;
    }
    if (current === '--windows-cert-file' && next) {
      args.windowsCertFile = next;
      index += 1;
      continue;
    }
    if (current === '--windows-cert-password-env' && next) {
      args.windowsCertPasswordEnv = next;
      index += 1;
      continue;
    }
    if (current === '--mac-cert-file' && next) {
      args.macCertFile = next;
      index += 1;
      continue;
    }
    if (current === '--mac-cert-password-env' && next) {
      args.macCertPasswordEnv = next;
      index += 1;
      continue;
    }
    if (current === '--mac-cert-name' && next) {
      args.macCertName = next;
      index += 1;
      continue;
    }
    if (current === '--apple-api-key-file' && next) {
      args.appleApiKeyFile = next;
      index += 1;
      continue;
    }
    if (current === '--apple-api-key-id' && next) {
      args.appleApiKeyId = next;
      index += 1;
      continue;
    }
    if (current === '--apple-api-issuer' && next) {
      args.appleApiIssuer = next;
      index += 1;
      continue;
    }
    if (current === '--apple-id' && next) {
      args.appleId = next;
      index += 1;
      continue;
    }
    if (current === '--apple-app-specific-password-env' && next) {
      args.appleAppSpecificPasswordEnv = next;
      index += 1;
      continue;
    }
    if (current === '--apple-team-id' && next) {
      args.appleTeamId = next;
      index += 1;
    }
  }

  return args;
}

function readRequiredEnv(env, envName) {
  if (!hasValue(envName)) {
    throw new Error('Informe o nome da variavel de ambiente para a credencial.');
  }
  const value = env[envName];
  if (!hasValue(value)) {
    throw new Error(`Variavel de ambiente ausente ou vazia: ${envName}`);
  }
  return String(value);
}

function readFile(filePath, encoding = 'utf8') {
  const resolvedPath = path.resolve(filePath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo nao encontrado: ${resolvedPath}`);
  }
  return encoding ? fs.readFileSync(resolvedPath, encoding) : fs.readFileSync(resolvedPath);
}

function buildSecretValueFromFile(filePath, mode) {
  if (mode === 'base64') {
    return readFile(filePath, null).toString('base64');
  }
  return String(readFile(filePath, 'utf8'));
}

function buildProjectedEnv(secretNames) {
  const env = {};
  for (const name of secretNames) {
    switch (name) {
      case 'WIN_CSC_LINK':
      case 'MAC_CSC_LINK':
      case 'CSC_LINK':
        env[name] = 'dGVzdA==';
        break;
      case 'WIN_CSC_KEY_PASSWORD':
      case 'MAC_CSC_KEY_PASSWORD':
      case 'CSC_KEY_PASSWORD':
      case 'APPLE_APP_SPECIFIC_PASSWORD':
        env[name] = 'secret';
        break;
      case 'APPLE_API_KEY':
        env[name] = '-----BEGIN PRIVATE KEY-----\nsecret\n-----END PRIVATE KEY-----\n';
        break;
      case 'APPLE_API_KEY_ID':
        env[name] = 'ABC1234567';
        break;
      case 'APPLE_API_ISSUER':
        env[name] = '00000000-0000-0000-0000-000000000000';
        break;
      case 'APPLE_ID':
        env[name] = 'build@example.com';
        break;
      case 'APPLE_TEAM_ID':
        env[name] = 'TEAMID1234';
        break;
      case 'MAC_CSC_NAME':
      case 'CSC_NAME':
        env[name] = 'Developer ID Application: BotAssist';
        break;
      default:
        env[name] = 'configured';
        break;
    }
  }
  return env;
}

function applyOperationNames(initialNames, operations) {
  const secretNames = new Set(initialNames);
  for (const operation of operations) {
    if (operation.type === 'secret') {
      secretNames.add(operation.name);
    }
  }
  return secretNames;
}

function buildProvisionPlan(args, env = process.env, repositoryState = { secretNames: new Set() }) {
  const operations = [];
  const usingWindows =
    hasValue(args.windowsCertFile) || hasValue(args.windowsCertPasswordEnv);
  const usingMacSigning =
    hasValue(args.macCertFile) || hasValue(args.macCertPasswordEnv) || hasValue(args.macCertName);
  const usingApiKey =
    hasValue(args.appleApiKeyFile) ||
    hasValue(args.appleApiKeyId) ||
    hasValue(args.appleApiIssuer);
  const usingAppleId =
    hasValue(args.appleId) ||
    hasValue(args.appleAppSpecificPasswordEnv) ||
    hasValue(args.appleTeamId);

  if (usingApiKey && usingAppleId) {
    throw new Error('Escolha apenas uma estrategia de notarizacao: API key ou Apple ID.');
  }

  if (usingWindows) {
    if (!hasValue(args.windowsCertFile) || !hasValue(args.windowsCertPasswordEnv)) {
      throw new Error(
        'Windows signing exige --windows-cert-file e --windows-cert-password-env.'
      );
    }
    operations.push({
      type: 'secret',
      name: 'WIN_CSC_LINK',
      value: buildSecretValueFromFile(args.windowsCertFile, 'base64'),
      source: path.resolve(args.windowsCertFile),
    });
    operations.push({
      type: 'secret',
      name: 'WIN_CSC_KEY_PASSWORD',
      value: readRequiredEnv(env, args.windowsCertPasswordEnv),
      source: `$${args.windowsCertPasswordEnv}`,
    });
  }

  if (usingMacSigning) {
    if (!hasValue(args.macCertFile) || !hasValue(args.macCertPasswordEnv)) {
      throw new Error('macOS signing exige --mac-cert-file e --mac-cert-password-env.');
    }
    operations.push({
      type: 'secret',
      name: 'MAC_CSC_LINK',
      value: buildSecretValueFromFile(args.macCertFile, 'base64'),
      source: path.resolve(args.macCertFile),
    });
    operations.push({
      type: 'secret',
      name: 'MAC_CSC_KEY_PASSWORD',
      value: readRequiredEnv(env, args.macCertPasswordEnv),
      source: `$${args.macCertPasswordEnv}`,
    });
    if (hasValue(args.macCertName)) {
      operations.push({
        type: 'secret',
        name: 'MAC_CSC_NAME',
        value: String(args.macCertName),
        source: 'arg',
      });
    }
  }

  if (usingApiKey) {
    if (
      !hasValue(args.appleApiKeyFile) ||
      !hasValue(args.appleApiKeyId) ||
      !hasValue(args.appleApiIssuer)
    ) {
      throw new Error(
        'Notarizacao por API key exige --apple-api-key-file, --apple-api-key-id e --apple-api-issuer.'
      );
    }
    operations.push({
      type: 'secret',
      name: 'APPLE_API_KEY',
      value: buildSecretValueFromFile(args.appleApiKeyFile, 'utf8'),
      source: path.resolve(args.appleApiKeyFile),
    });
    operations.push({
      type: 'secret',
      name: 'APPLE_API_KEY_ID',
      value: String(args.appleApiKeyId),
      source: 'arg',
    });
    operations.push({
      type: 'secret',
      name: 'APPLE_API_ISSUER',
      value: String(args.appleApiIssuer),
      source: 'arg',
    });
  }

  if (usingAppleId) {
    if (
      !hasValue(args.appleId) ||
      !hasValue(args.appleAppSpecificPasswordEnv) ||
      !hasValue(args.appleTeamId)
    ) {
      throw new Error(
        'Notarizacao por Apple ID exige --apple-id, --apple-app-specific-password-env e --apple-team-id.'
      );
    }
    operations.push({
      type: 'secret',
      name: 'APPLE_ID',
      value: String(args.appleId),
      source: 'arg',
    });
    operations.push({
      type: 'secret',
      name: 'APPLE_APP_SPECIFIC_PASSWORD',
      value: readRequiredEnv(env, args.appleAppSpecificPasswordEnv),
      source: `$${args.appleAppSpecificPasswordEnv}`,
    });
    operations.push({
      type: 'secret',
      name: 'APPLE_TEAM_ID',
      value: String(args.appleTeamId),
      source: 'arg',
    });
  }

  if (args.requireSignedReleases !== 'keep') {
    operations.push({
      type: 'variable',
      name: 'REQUIRE_SIGNED_RELEASES',
      value: args.requireSignedReleases,
      source: 'arg',
    });
  }

  const projectedSecretNames = applyOperationNames(repositoryState.secretNames, operations);
  const projectedReadiness = resolveSigningReadiness(buildProjectedEnv(projectedSecretNames));

  if (args.requireSignedReleases === 'true' && !projectedReadiness.readyForSignedRelease) {
    throw new Error(
      `Nao e seguro ativar REQUIRE_SIGNED_RELEASES=true agora. ${buildFailureMessages(
        projectedReadiness
      ).join(' ')}`
    );
  }

  return {
    repo: args.repo,
    dryRun: args.dryRun,
    runReadinessWorkflow: args.runReadinessWorkflow,
    operations,
    projectedReadiness,
  };
}

function runGh(args, input = '') {
  const result = spawnSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  if (result.status !== 0) {
    const details = String(result.stderr || result.stdout || '').trim();
    throw new Error(details || `Falha executando gh ${args.join(' ')}`);
  }
  return result.stdout;
}

function loadRepositoryState(repo, runCommand = runGh) {
  const secrets = JSON.parse(
    runCommand(['secret', 'list', '--repo', repo, '--app', 'actions', '--json', 'name'])
  );
  const variables = JSON.parse(runCommand(['variable', 'list', '--repo', repo, '--json', 'name,value']));
  return {
    secretNames: new Set((Array.isArray(secrets) ? secrets : []).map((entry) => entry.name)),
    variables: new Map(
      (Array.isArray(variables) ? variables : []).map((entry) => [entry.name, entry.value])
    ),
  };
}

function applyProvisionPlan(plan, runCommand = runGh) {
  for (const operation of plan.operations) {
    if (operation.type === 'secret') {
      runCommand(['secret', 'set', operation.name, '--repo', plan.repo], operation.value);
      continue;
    }
    if (operation.type === 'variable') {
      runCommand(['variable', 'set', operation.name, '--repo', plan.repo], operation.value);
    }
  }

  if (plan.runReadinessWorkflow) {
    runCommand(['workflow', 'run', 'signing-readiness.yml', '--repo', plan.repo, '--ref', 'main']);
  }
}

function renderPlan(plan) {
  const lines = [`Repo: ${plan.repo}`, `Operacoes: ${plan.operations.length}`];

  for (const operation of plan.operations) {
    lines.push(`- ${operation.type}: ${operation.name} <- ${operation.source}`);
  }

  lines.push(
    `Projected readiness: ${
      plan.projectedReadiness.readyForSignedRelease ? 'full' : 'partial'
    }`
  );
  if (!plan.projectedReadiness.readyForSignedRelease) {
    for (const failure of buildFailureMessages(plan.projectedReadiness)) {
      lines.push(`- gap: ${failure}`);
    }
  }
  if (plan.runReadinessWorkflow) {
    lines.push('- follow-up: workflow signing-readiness.yml sera disparado');
  }

  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const repositoryState = loadRepositoryState(args.repo);
  const plan = buildProvisionPlan(args, process.env, repositoryState);

  process.stdout.write(`${renderPlan(plan)}\n`);

  if (plan.dryRun) {
    return;
  }

  applyProvisionPlan(plan);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error?.message || String(error));
    process.exitCode = 1;
  }
}

module.exports = {
  applyOperationNames,
  buildProjectedEnv,
  buildProvisionPlan,
  loadRepositoryState,
  parseArgs,
  parseRequireSignedReleases,
  renderPlan,
};
