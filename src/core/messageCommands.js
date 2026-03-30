const os = require('os');

const { resolveActiveProfile } = require('../shared/settingsSchema');
const { SETTINGS_UPDATE_ACTIONS } = require('../shared/ipcContracts');
const { isGroupAllowed, parsePairingCommand, senderMatchesList } = require('./messageUtils');
const { getToolAccess, toolFsList, toolFsRead } = require('./tools');

function formatTaggedText(botTag, text) {
  return (botTag ? `${botTag} ` : '') + text;
}

async function sendTaggedMessage({ sendMessage, remoteJid, botTag, text, quotedMessage }) {
  await sendMessage(remoteJid, { text: formatTaggedText(botTag, text) }, { quoted: quotedMessage });
}

async function handleAccessCommand(context, deps) {
  const {
    command,
    text,
    prefix,
    remoteJid,
    isGroup,
    mentionSelf,
    isOwner,
    botTag,
    message,
    settings,
    dmPolicy,
    groupPolicy,
    groupAccessKey,
    senderJid,
    senderPhone,
    pairingId,
  } = context;
  const {
    sendMessage,
    normalizeOwnerClaimToken,
    verifyOwnerClaimToken,
    requestSettingsUpdate,
    getPairingEntry,
    ensurePairingEntry,
    clearPairingEntry,
  } = deps;

  if (
    !isGroup &&
    command.isCommand &&
    (command.command === 'owner' || command.command === 'setowner')
  ) {
    const providedToken = normalizeOwnerClaimToken(command.rawArgs);
    if (!providedToken) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: `Use: ${prefix}owner <token>\nGere o token no app em Configuracoes > Basico.`,
        quotedMessage: message,
      });
      return true;
    }

    if (!senderJid && !senderPhone) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Nao consegui identificar seu usuario. Tente novamente em alguns segundos.',
        quotedMessage: message,
      });
      return true;
    }

    if (isOwner) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Voce ja esta configurado como owner.',
        quotedMessage: message,
      });
      return true;
    }

    const tokenCheck = verifyOwnerClaimToken(settings, providedToken);
    if (!tokenCheck.ok) {
      if (tokenCheck.reason === 'expired') {
        requestSettingsUpdate(SETTINGS_UPDATE_ACTIONS.CLEAR_OWNER_TOKEN);
      }
      const errorText =
        tokenCheck.reason === 'expired'
          ? 'Token expirado. Gere um novo token no app e tente novamente.'
          : tokenCheck.reason === 'missing'
            ? 'Nenhum token ativo encontrado. Gere um token no app em Configuracoes > Basico.'
            : 'Token invalido. Confira o codigo e tente novamente.';
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: errorText,
        quotedMessage: message,
      });
      return true;
    }

    requestSettingsUpdate(SETTINGS_UPDATE_ACTIONS.SET_OWNER, {
      ownerNumber: senderPhone || '',
      ownerJid: senderJid || '',
    });
    requestSettingsUpdate(SETTINGS_UPDATE_ACTIONS.CLEAR_OWNER_TOKEN);

    const phoneLabel = senderPhone ? senderPhone : 'n/a';
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: [
        'Owner configurado com sucesso!',
        `Numero: ${phoneLabel}`,
        `JID: ${senderJid || 'n/a'}`,
        'Agora comandos administrativos e aprovacoes de ferramentas estao liberados.',
      ].join('\n'),
      quotedMessage: message,
    });
    return true;
  }

  if (!isGroup && dmPolicy === 'pairing' && !isOwner) {
    const allowedUsers = Array.isArray(settings.allowedUsers)
      ? settings.allowedUsers.map((value) => String(value).trim()).filter(Boolean)
      : [];
    const allowlisted = senderMatchesList(senderJid, senderPhone, allowedUsers);
    if (!allowlisted) {
      const providedCode = parsePairingCommand(text, prefix);
      if (providedCode) {
        const entry = getPairingEntry(pairingId);
        if (entry && providedCode === entry.code) {
          const userRef = senderPhone || senderJid;
          if (userRef) {
            requestSettingsUpdate(SETTINGS_UPDATE_ACTIONS.ALLOWLIST_USER, { userRef });
          }
          clearPairingEntry(pairingId);
          await sendTaggedMessage({
            sendMessage,
            remoteJid,
            botTag,
            text: 'Pareamento concluído! Você já pode falar comigo.',
            quotedMessage: message,
          });
        } else {
          await sendTaggedMessage({
            sendMessage,
            remoteJid,
            botTag,
            text: 'Código inválido. Envie "pair CODIGO" ou aguarde um novo código.',
            quotedMessage: message,
          });
        }
        return true;
      }

      const entry = ensurePairingEntry(pairingId);
      if (entry) {
        await sendTaggedMessage({
          sendMessage,
          remoteJid,
          botTag,
          text:
            `Para liberar acesso, responda com: pair ${entry.code}\n` +
            'O código expira em 10 minutos.',
          quotedMessage: message,
        });
      }
      return true;
    }
  }

  if (
    isGroup &&
    mentionSelf &&
    command.isCommand &&
    (command.command === 'autorizar' || command.command === 'liberar' || command.command === 'pair')
  ) {
    if (!isOwner) return true;
    if (!groupAccessKey) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'A chave de acesso do grupo não está configurada.',
        quotedMessage: message,
      });
      return true;
    }

    if (groupPolicy === 'disabled') {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Respostas em grupos estão desativadas.',
        quotedMessage: message,
      });
      return true;
    }

    const provided = String(command.rawArgs || '').trim();
    if (!provided) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: `Use: ${prefix}autorizar <chave>`,
        quotedMessage: message,
      });
      return true;
    }

    if (provided !== groupAccessKey) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Chave inválida.',
        quotedMessage: message,
      });
      return true;
    }

    if (groupPolicy === 'open') {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Este bot já está liberado para grupos.',
        quotedMessage: message,
      });
      return true;
    }

    requestSettingsUpdate(SETTINGS_UPDATE_ACTIONS.ALLOWLIST_GROUP, { groupJid: remoteJid });
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: 'Grupo autorizado! Você já pode falar comigo aqui.',
      quotedMessage: message,
    });
    return true;
  }

  if (isGroup && mentionSelf && isOwner && command.isCommand && command.command === 'groupid') {
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text:
        `JID do grupo:\n${remoteJid}\n\n` +
        'Cole isso em “Allowlist de grupos” nas Configurações para habilitar respostas aqui.',
      quotedMessage: message,
    });
    return true;
  }

  return false;
}

async function handleUtilityCommand(context, deps) {
  const {
    command,
    prefix,
    remoteJid,
    isGroup,
    isOwner,
    botTag,
    message,
    settings,
    scopedSettings,
    profile,
    providerLabel,
    model,
    dmPolicy,
    groupPolicy,
    groupAccessKey,
    senderJid,
    senderPhone,
    ownerConfig,
    ownerJid,
    toolContext,
  } = context;
  const { sendMessage, clearSessionState } = deps;

  if (isOwner && command.isCommand && command.command === 'status') {
    if (isGroup && !isGroupAllowed(settings, remoteJid)) return true;
    const dmPolicyLabel =
      dmPolicy === 'owner'
        ? 'somente owner'
        : dmPolicy === 'allowlist'
          ? 'allowlist'
          : dmPolicy === 'pairing'
            ? 'pairing'
            : 'aberto';
    const groupPolicyLabel =
      groupPolicy === 'disabled' ? 'desativado' : groupPolicy === 'open' ? 'aberto' : 'allowlist';
    const activeProfile = profile || resolveActiveProfile(settings);
    const profileLabel = activeProfile?.name ? `Perfil: ${activeProfile.name}\n` : '';
    const summary =
      `Status: online\n` +
      `Provedor: ${providerLabel}\n` +
      profileLabel +
      `Modelo: ${model}\n` +
      `DM: ${dmPolicyLabel}\n` +
      `Grupos: ${groupPolicyLabel}\n` +
      `Memória: ${settings.historyEnabled ? 'ativa' : 'desativada'}\n` +
      `Ferramentas: ${toolContext.tools.enabled ? 'ativas' : 'desativadas'}\n` +
      'Somente mention (grupos): sim\n' +
      `Comandos em grupos: ${settings.groupRequireCommand ? `sim (${prefix})` : 'não'}\n` +
      `Cooldown DM: ${settings.cooldownSecondsDm}s | Grupo: ${settings.cooldownSecondsGroup}s`;
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: summary,
      quotedMessage: message,
    });
    return true;
  }

  if (command.isCommand && (command.command === 'me' || command.command === 'whoami')) {
    if (isGroup) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Use este comando no DM para sua privacidade.',
        quotedMessage: message,
      });
      return true;
    }

    const senderIsLid = Boolean(senderJid && senderJid.endsWith('@lid'));
    const phoneLabel = senderIsLid ? 'n/a (JID @lid)' : senderPhone || 'n/a';
    const lines = [
      `Seu JID: ${senderJid || 'n/a'}`,
      `Seu numero (WhatsApp): ${phoneLabel}`,
      `Owner: ${isOwner ? 'sim' : 'não'}`,
    ];
    if (isOwner) {
      lines.push(`Owner numero (config): ${ownerConfig.raw || 'n/a'}`);
      lines.push(`Owner JID (config): ${ownerJid || 'n/a'}`);
    }
    lines.push(
      'JID e o identificador interno do WhatsApp. Se terminar com @lid, copie e cole em Configuracoes > Avancado > Owner JID.'
    );
    lines.push(`Metodo recomendado: gere um token no app e envie ${prefix}owner <token> neste DM.`);
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: lines.join('\n'),
      quotedMessage: message,
    });
    return true;
  }

  if (command.isCommand && command.command === 'tools') {
    if (isGroup) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Use este comando no DM.',
        quotedMessage: message,
      });
      return true;
    }

    const access = getToolAccess(scopedSettings, { isGroup, isOwner });
    const reason = access.enabled
      ? 'ok'
      : access.reason === 'disabled'
        ? 'ferramentas desativadas'
        : access.reason === 'owner'
          ? 'somente owner pode usar'
          : access.reason === 'groups'
            ? 'bloqueado em grupos'
            : 'bloqueado';
    const lines = [
      `Tools: ${access.enabled ? 'ativas' : 'bloqueadas'}`,
      `Motivo: ${reason}`,
      `Owner: ${isOwner ? 'sim' : 'não'}`,
    ];
    if (isOwner) {
      lines.push(`Permitir em grupos: ${access.tools?.allowInGroups ? 'sim' : 'não'}`);
      lines.push(`Require owner: ${access.tools?.requireOwner ? 'sim' : 'não'}`);
    }
    if (!isOwner && access.tools?.requireOwner) {
      lines.push(
        `Dica: gere um token no app e envie ${prefix}owner <token> no DM para virar owner.`
      );
    }
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: lines.join('\n'),
      quotedMessage: message,
    });
    return true;
  }

  if (command.isCommand && (command.command === 'fslist' || command.command === 'fsread')) {
    if (isGroup) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Use este comando no DM.',
        quotedMessage: message,
      });
      return true;
    }

    if (!isOwner) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: 'Somente o owner pode usar este comando.',
        quotedMessage: message,
      });
      return true;
    }

    const access = getToolAccess(scopedSettings, { isGroup, isOwner });
    if (!access.enabled) {
      const reason =
        access.reason === 'disabled'
          ? 'Ferramentas desativadas.'
          : access.reason === 'owner'
            ? 'Somente o owner pode usar ferramentas.'
            : access.reason === 'groups'
              ? 'Ferramentas bloqueadas em grupos.'
              : 'Ferramentas bloqueadas.';
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: reason,
        quotedMessage: message,
      });
      return true;
    }

    const rawPath = String(command.rawArgs || '').trim();
    const targetPath = rawPath || os.homedir();
    try {
      if (command.command === 'fslist') {
        const result = await toolFsList({ path: targetPath }, toolContext);
        const entries = Array.isArray(result?.entries) ? result.entries : [];
        const max = 80;
        const lines = entries.slice(0, max).map((entry) => {
          const typePrefix =
            entry.type === 'dir' ? '[DIR]' : entry.type === 'file' ? '[FILE]' : '[ITEM]';
          return `${typePrefix} ${entry.name}`;
        });
        if (entries.length > max) lines.push(`…e mais ${entries.length - max} itens`);
        await sendTaggedMessage({
          sendMessage,
          remoteJid,
          botTag,
          text: `Conteúdo de ${result.path}:\n` + (lines.length ? lines.join('\n') : '(vazio)'),
          quotedMessage: message,
        });
      } else {
        const result = await toolFsRead({ path: targetPath }, toolContext);
        if (result?.error) {
          await sendTaggedMessage({
            sendMessage,
            remoteJid,
            botTag,
            text: `Erro: ${result.error}`,
            quotedMessage: message,
          });
        } else {
          await sendTaggedMessage({
            sendMessage,
            remoteJid,
            botTag,
            text:
              `Arquivo: ${result.path}\n` +
              `Tamanho: ${result.size ?? 'n/a'} bytes\n\n` +
              `${result.content || ''}`,
            quotedMessage: message,
          });
        }
      }
    } catch (err) {
      await sendTaggedMessage({
        sendMessage,
        remoteJid,
        botTag,
        text: `Erro: ${err?.message || String(err)}`,
        quotedMessage: message,
      });
    }
    return true;
  }

  if (
    isOwner &&
    command.isCommand &&
    (command.command === 'limparmemoria' || command.command === 'resetmemoria')
  ) {
    const ok = clearSessionState(remoteJid);
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: ok
        ? 'Memória desta conversa foi apagada.'
        : 'Não foi possível apagar a memória desta conversa.',
      quotedMessage: message,
    });
    return true;
  }

  if (command.isCommand && command.command === 'help') {
    if (isGroup && !isGroupAllowed(settings, remoteJid) && !isOwner) return true;

    const lines = ['Comandos:', `${prefix}help — ajuda`];
    if (!isGroup) {
      lines.push(`${prefix}me — mostra seu JID/numero`);
      lines.push(`${prefix}tools — status das ferramentas`);
      lines.push(`${prefix}owner <token> — definir owner com token do app`);
    }
    if (isOwner) {
      lines.push(`${prefix}status — status (owner)`);
      lines.push(`${prefix}groupid — mostra o JID do grupo (owner)`);
    }
    if (groupAccessKey && groupPolicy === 'allowlist' && isOwner) {
      lines.push(`${prefix}autorizar <chave> — liberar este grupo (owner)`);
    }
    if (!isGroup && dmPolicy === 'pairing') {
      lines.push('pair <codigo> — parear no DM');
    }
    if (isOwner && toolContext.tools.enabled) {
      lines.push(`${prefix}aprovar <id> — aprovar ação de ferramenta (owner)`);
      lines.push(`${prefix}negar <id> — negar ação de ferramenta (owner)`);
    }
    if (isOwner) {
      lines.push(`${prefix}limparmemoria — limpar memória desta conversa (owner)`);
    }
    lines.push('', 'Segurança: em grupos, eu só respondo quando você me menciona.');
    await sendTaggedMessage({
      sendMessage,
      remoteJid,
      botTag,
      text: lines.join('\n'),
      quotedMessage: message,
    });
    return true;
  }

  return false;
}

module.exports = {
  handleAccessCommand,
  handleUtilityCommand,
};
