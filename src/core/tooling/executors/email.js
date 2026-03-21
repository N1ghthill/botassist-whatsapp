const Imap = require('imap');
const { simpleParser } = require('mailparser');

const { clampNumber } = require('../../../shared/settingsSchema');
const { formatAddressList, truncateText } = require('../helpers');

async function toolEmailRead(args = {}, context = {}) {
  const email = context.email || {};
  if (!email.enabled) throw new Error('Leitura de email desativada.');
  if (!email.imapHost || !email.imapUser || !email.imapPassword) {
    throw new Error('Configuracao IMAP incompleta.');
  }
  const mailbox = String(args.mailbox || email.mailbox || 'INBOX').trim() || 'INBOX';
  const limit = clampNumber(args.limit, 1, 50, email.maxMessages || 5);
  const unseenOnly = Boolean(args.unseenOnly);
  const messages = await new Promise((resolve, reject) => {
    const imap = new Imap({
      user: email.imapUser,
      password: email.imapPassword,
      host: email.imapHost,
      port: Number(email.imapPort || 993),
      tls: email.imapSecure !== false,
    });

    let finished = false;
    const finish = (err, result = []) => {
      if (finished) return;
      finished = true;
      try {
        imap.end();
      } catch {
        // ignore
      }
      if (err) reject(err);
      else resolve(result);
    };

    imap.once('ready', () => {
      imap.openBox(mailbox, true, (err) => {
        if (err) return finish(err);
        const criteria = unseenOnly ? ['UNSEEN'] : ['ALL'];
        imap.search(criteria, (err, results) => {
          if (err) return finish(err);
          const ordered = Array.isArray(results) ? results.sort((a, b) => a - b) : [];
          const selected = ordered.slice(-limit);
          if (selected.length === 0) return finish(null, []);

          const fetcher = imap.fetch(selected, { bodies: '', struct: true });
          const parsePromises = [];

          fetcher.on('message', (msg) => {
            let buffer = '';
            let attrs = null;
            msg.on('body', (stream) => {
              stream.on('data', (chunk) => {
                buffer += chunk.toString('utf8');
              });
            });
            msg.once('attributes', (value) => {
              attrs = value;
            });
            msg.once('end', () => {
              const parsePromise = (async () => {
                let parsed = null;
                try {
                  parsed = await simpleParser(buffer);
                } catch {
                  parsed = null;
                }
                const fromList = parsed?.from?.value || [];
                const text = String(parsed?.text || parsed?.html || '').trim();
                return {
                  uid: attrs?.uid || null,
                  subject: parsed?.subject || '',
                  from: formatAddressList(fromList),
                  date: parsed?.date ? new Date(parsed.date).toISOString() : '',
                  snippet: truncateText(text, 400),
                };
              })();
              parsePromises.push(parsePromise);
            });
          });

          fetcher.once('error', (err) => finish(err));
          fetcher.once('end', async () => {
            try {
              const parsed = await Promise.all(parsePromises);
              finish(null, parsed.filter(Boolean));
            } catch (err) {
              finish(err);
            }
          });
        });
      });
    });

    imap.once('error', (err) => finish(err));
    imap.once('end', () => {
      if (!finished) finish(null, []);
    });

    imap.connect();
  });

  return { mailbox, count: messages.length, messages };
}

module.exports = {
  toolEmailRead,
};
