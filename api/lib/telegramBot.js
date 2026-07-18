'use strict';

const sharedConfig = require('../../shared/domain/config.cjs');

const { parseSessionMutation } = require('./sessionMutation');
const { normalizeOptionalText } = require('./sessionMetadata');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_CONNECTOR_OPTIONS = ['CCS - DC', 'CCS AC', 'Wallbox AC'];
const DEFAULT_VEHICLE = String(sharedConfig?.defaultVehicle || 'Elektroauto');
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;
const CONTROL_TEXT_ALIASES = {
  cancel: new Set(['/cancel', 'abbrechen', 'cancel', '❌ abbrechen']),
  skip: new Set(['/skip', 'überspringen', 'ueberspringen', 'skip', 'ohne angabe', '1 - ohne angabe', '⏭️ 1 - ohne angabe']),
  newSession: new Set(['/new', 'neue session', 'neu', '✨ neue session starten']),
  restart: new Set(['neu starten', '🔄 2 - neu starten']),
  save: new Set(['speichern', '/save', '✅ 1 - speichern']),
};
const CONNECTOR_ALIASES = new Map([
  ['ccs - dc', 'CCS - DC'],
  ['ccs dc', 'CCS - DC'],
  ['dc', 'CCS - DC'],
  ['ccs ac', 'CCS AC'],
  ['ac', 'CCS AC'],
  ['wallbox ac', 'Wallbox AC'],
  ['wallbox', 'Wallbox AC'],
  ['home', 'Wallbox AC'],
]);
const SKIPPABLE_STEPS = new Set(['provider', 'location', 'tags', 'odometer_km', 'note']);
const STEP_KEYBOARD_ROWS = {
  date: [
    [
      { text: '📅 1 - Heute', callback_data: 'date:today' },
      { text: '🕘 2 - Gestern', callback_data: 'date:yesterday' },
    ],
    [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
  ],
  connector: [
    [
      { text: '⚡ 1 - CCS - DC', callback_data: 'connector:dc' },
      { text: '🔌 2 - CCS AC', callback_data: 'connector:ac' },
    ],
    [{ text: '🏠 3 - Wallbox AC', callback_data: 'connector:wallbox' }],
    [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
  ],
  vehicle: [
    [
      { text: '🚗 1 - Standardfahrzeug', callback_data: 'vehicle:default' },
      { text: '⏭️ 2 - Ohne Angabe', callback_data: 'vehicle:skip' },
    ],
    [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
  ],
  confirm: [
    [{ text: '✅ 1 - Speichern', callback_data: 'confirm:save' }],
    [
      { text: '🔄 2 - Neu starten', callback_data: 'confirm:restart' },
      { text: '❌ 3 - Abbrechen', callback_data: 'confirm:cancel' },
    ],
  ],
};
const CALLBACK_ACTIONS = new Map([
  ['menu:new', { type: 'command', text: '/new' }],
  ['menu:summary', { type: 'command', text: '/summary' }],
  ['nav:cancel', { type: 'command', text: '/cancel' }],
  ['date:today', { type: 'step', step: 'date', text: '1' }],
  ['date:yesterday', { type: 'step', step: 'date', text: '2' }],
  ['connector:dc', { type: 'step', step: 'connector', text: '1' }],
  ['connector:ac', { type: 'step', step: 'connector', text: '2' }],
  ['connector:wallbox', { type: 'step', step: 'connector', text: '3' }],
  ['provider:skip', { type: 'step', step: 'provider', text: '1' }],
  ['location:skip', { type: 'step', step: 'location', text: '1' }],
  ['vehicle:default', { type: 'step', step: 'vehicle', text: '1' }],
  ['vehicle:skip', { type: 'step', step: 'vehicle', text: '2' }],
  ['tags:skip', { type: 'step', step: 'tags', text: '1' }],
  ['odometer_km:skip', { type: 'step', step: 'odometer_km', text: '1' }],
  ['note:skip', { type: 'step', step: 'note', text: '1' }],
  ['confirm:save', { type: 'step', step: 'confirm', text: '1' }],
  ['confirm:restart', { type: 'step', step: 'confirm', text: '2' }],
  ['confirm:cancel', { type: 'step', step: 'confirm', text: '3' }],
]);
const STEP_PROMPTS = {
  date: 'Hallo 👋\nSchön, dass du da bist. Ich begleite dich jetzt Schritt für Schritt durch den Eintrag deines Ladevorgangs 🙂\n\nSo funktioniert es:\n• Ich frage dich nacheinander alle wichtigen Angaben.\n• Bei optionalen Feldern kannst du einfach auf den Button tippen oder nur die Zahl senden.\n• Mit „❌ Abbrechen“ kannst du jederzeit stoppen.\n\n1/13 Datum\nWann war der Ladevorgang?\nDu kannst „1 - Heute“, „2 - Gestern“ oder ein Datum wie 15.03.2026 senden.',
  connector: '2/13 Anschluss ⚡\nWelchen Anschluss hast du genutzt?\n\n1. CCS - DC\n2. CCS AC\n3. Wallbox AC\n\nWenn dir Telegram keine Buttons zeigt, antworte einfach mit 1, 2 oder 3.',
  provider: '3/13 Betreiber 🙂\nWer war der Betreiber?\nZum Beispiel: Ionity, EnBW oder Aral Pulse.\n\nWenn du das Feld leer lassen möchtest, tippe einfach auf „⏭️ 1 - Ohne Angabe“ oder sende nur 1.',
  location: '4/13 Standort 📍\nWo hast du geladen?\nZum Beispiel: Raststätte Holmmoor West oder Zuhause.\n\nWenn du keinen Standort angeben möchtest, tippe einfach 1.',
  tags: '6/13 Tags 🏷️\nMöchtest du Tags vergeben?\nDu kannst mehrere Tags mit Komma trennen, zum Beispiel: Reise, HPC, Urlaub.\n\nWenn du keine Tags setzen möchtest, tippe einfach 1.',
  soc_start: '7/13 SoC Start 🔋\nWie hoch war der Akkustand zu Beginn?\nBitte als Prozentzahl senden, zum Beispiel 12.',
  soc_end: '8/13 SoC Ende 🔋\nDanke dir. Wie hoch war der Akkustand am Ende?\nBitte wieder als Prozentzahl senden, zum Beispiel 80.',
  energy_kwh: '9/13 Geladene Energie ⚡\nWie viel Energie wurde geladen?\nBitte in kWh senden, zum Beispiel 42,5.',
  price_per_kwh: '10/13 Preis 💶\nWie hoch war der Preis pro kWh?\nBitte in Euro senden, zum Beispiel 0,59.',
  duration_hhmm: '11/13 Dauer ⏱️\nWie lange hat der Ladevorgang gedauert?\nDu kannst HH:MM oder einfach Minuten senden, zum Beispiel 00:32 oder 32.',
  odometer_km: '12/13 Kilometerstand 🚙\nWenn du magst, sende jetzt den Kilometerstand in km.\nWenn du ihn nicht angeben möchtest, tippe einfach 1.',
  note: '13/13 Notiz ✍️\nFast geschafft 😊\nWenn du noch eine kurze Notiz ergänzen möchtest, schick sie mir jetzt.\nWenn nicht, tippe einfach 1.',
};

function pad2(value) {
  return String(value).padStart(2, '0');
}

function formatLocalDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeControlText(value) {
  return normalizeOptionalText(value)?.toLowerCase() || '';
}

function extractChoiceNumber(value) {
  const normalized = normalizeControlText(value);
  const match = normalized.match(/^\D*(\d+)/u);
  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isInteger(parsed) ? parsed : null;
}

function matchesControlAlias(value, aliasSet, expectedChoiceNumber = null) {
  const normalized = normalizeControlText(value);
  if (expectedChoiceNumber != null && extractChoiceNumber(value) === expectedChoiceNumber) {
    return true;
  }
  return aliasSet.has(normalized);
}

function isCancelText(value) {
  return matchesControlAlias(value, CONTROL_TEXT_ALIASES.cancel);
}

function isSkipText(value) {
  return matchesControlAlias(value, CONTROL_TEXT_ALIASES.skip, 1);
}

function isNewSessionText(value) {
  return matchesControlAlias(value, CONTROL_TEXT_ALIASES.newSession);
}

function isRestartText(value) {
  return matchesControlAlias(value, CONTROL_TEXT_ALIASES.restart, 2);
}

function isSaveText(value) {
  return matchesControlAlias(value, CONTROL_TEXT_ALIASES.save, 1);
}

function parseDateInput(value, now) {
  const raw = normalizeOptionalText(value);
  if (!raw) return null;

  const normalized = raw.toLowerCase();
  const choiceNumber = extractChoiceNumber(value);
  if (choiceNumber === 1) {
    return formatLocalDate(now());
  }
  if (choiceNumber === 2) {
    return formatLocalDate(addDays(now(), -1));
  }

  if (normalized === 'heute' || normalized === 'today') {
    return formatLocalDate(now());
  }
  if (normalized === 'gestern' || normalized === 'yesterday') {
    return formatLocalDate(addDays(now(), -1));
  }

  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const candidate = new Date(Date.UTC(year, month - 1, day));
    if (
      candidate.getUTCFullYear() === year
      && candidate.getUTCMonth() === month - 1
      && candidate.getUTCDate() === day
    ) {
      return raw;
    }
    return null;
  }

  const deMatch = raw.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!deMatch) return null;

  const day = Number(deMatch[1]);
  const month = Number(deMatch[2]);
  const year = Number(deMatch[3]);
  const candidate = new Date(Date.UTC(year, month - 1, day));

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function parseIntegerInput(value, { min, max }) {
  const raw = normalizeOptionalText(value);
  if (!raw || !/^-?\d+$/.test(raw)) return null;

  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) return null;
  return parsed;
}

function parseDecimalInput(value, { minExclusive }) {
  const raw = normalizeOptionalText(value);
  if (!raw) return null;

  const normalized = raw.replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) return null;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= minExclusive) return null;
  return parsed;
}

function parseDurationInput(value) {
  const raw = normalizeOptionalText(value);
  if (!raw) return null;

  const hhmmMatch = raw.match(/^(\d{1,3}):(\d{2})$/);
  if (hhmmMatch) {
    const hours = Number(hhmmMatch[1]);
    const minutes = Number(hhmmMatch[2]);
    if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || minutes < 0 || minutes > 59) {
      return null;
    }
    return `${hours}:${pad2(minutes)}`;
  }

  if (!/^\d{1,4}$/.test(raw)) return null;

  const totalMinutes = Number(raw);
  if (!Number.isInteger(totalMinutes) || totalMinutes <= 0) return null;

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${pad2(minutes)}`;
}

function parseConnectorInput(value) {
  const raw = normalizeControlText(value);
  if (!raw) return null;

  const choiceNumber = extractChoiceNumber(value);
  if (choiceNumber != null && DEFAULT_CONNECTOR_OPTIONS[choiceNumber - 1]) {
    return DEFAULT_CONNECTOR_OPTIONS[choiceNumber - 1];
  }

  const compact = raw.replace(/\s+/g, ' ').trim();
  const withoutPrefix = compact.replace(/^\d+\s*[-.)]?\s*/, '').trim();
  const normalized = withoutPrefix.replace(/\s*-\s*/g, ' - ');
  return CONNECTOR_ALIASES.get(compact) || CONNECTOR_ALIASES.get(normalized) || null;
}

function parseVehicleInput(value) {
  const normalized = normalizeControlText(value);
  const choiceNumber = extractChoiceNumber(value);

  if (choiceNumber === 1 || normalized === '🚗 1 - standardfahrzeug' || normalized === 'standardfahrzeug') {
    return { type: 'default', value: DEFAULT_VEHICLE };
  }

  if (choiceNumber === 2 || normalized === '⏭️ 2 - ohne angabe' || normalized === 'ohne angabe' || isSkipText(value)) {
    return { type: 'skip', value: null };
  }

  const vehicle = normalizeOptionalText(value);
  if (!vehicle) return null;

  return { type: 'custom', value: vehicle };
}

function formatDecimal(value, digits = 2) {
  return Number(value).toLocaleString('de-DE', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function buildInlineKeyboard(rows) {
  return {
    inline_keyboard: rows,
  };
}

function menuKeyboard() {
  return buildInlineKeyboard([
    [{ text: '✨ Neue Session starten', callback_data: 'menu:new' }],
    [{ text: '📊 Jahresübersicht', callback_data: 'menu:summary' }],
  ]);
}

function cancelKeyboard() {
  return buildInlineKeyboard([
    [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
  ]);
}

function stepKeyboard(step) {
  if (STEP_KEYBOARD_ROWS[step]) {
    return buildInlineKeyboard(STEP_KEYBOARD_ROWS[step]);
  }

  if (SKIPPABLE_STEPS.has(step)) {
    return buildInlineKeyboard([
      [{ text: '⏭️ 1 - Ohne Angabe', callback_data: `${step}:skip` }],
      [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
    ]);
  }

  return cancelKeyboard();
}

function parseCallbackAction(data) {
  const action = CALLBACK_ACTIONS.get(String(data || ''));
  return action ? { ...action } : null;
}

function buildPrompt(step) {
  if (step === 'vehicle') {
    return `5/13 Fahrzeug 🚗\nWelches Fahrzeug war es?\n\n1. Standardfahrzeug verwenden\n2. Ohne Angabe weiter\n\nDein Standardfahrzeug ist aktuell: ${DEFAULT_VEHICLE}\nDu kannst aber auch einfach einen eigenen Fahrzeugnamen senden.`;
  }

  return STEP_PROMPTS[step] || 'Bitte antworte über die eingeblendeten Optionen 🙂';
}

function buildSummary(payload) {
  const parsed = parseSessionMutation(payload);
  if (parsed.error) {
    return {
      error: parsed.error,
    };
  }

  const optionalLines = [];
  const missingOptionalFields = [];

  if (parsed.data.provider) {
    optionalLines.push(`🏢 Betreiber: ${parsed.data.provider}`);
  } else {
    missingOptionalFields.push('Betreiber');
  }

  if (parsed.data.location) {
    optionalLines.push(`📍 Standort: ${parsed.data.location}`);
  } else {
    missingOptionalFields.push('Standort');
  }

  if (parsed.data.vehicle) {
    optionalLines.push(`🚗 Fahrzeug: ${parsed.data.vehicle}`);
  } else {
    missingOptionalFields.push('Fahrzeug');
  }

  if (parsed.data.tags) {
    optionalLines.push(`🏷️ Tags: ${parsed.data.tags}`);
  } else {
    missingOptionalFields.push('Tags');
  }

  if (payload.duration_hhmm) {
    optionalLines.push(`⏱️ Dauer: ${payload.duration_hhmm}`);
  }

  if (parsed.data.odo_end_km != null) {
    optionalLines.push(`🛣️ Kilometerstand: ${parsed.data.odo_end_km} km`);
  } else {
    missingOptionalFields.push('Kilometerstand');
  }

  if (parsed.data.note) {
    optionalLines.push(`✍️ Notiz: ${parsed.data.note}`);
  } else {
    missingOptionalFields.push('Notiz');
  }

  const lines = [
    '✨ Fast geschafft!',
    'Schau bitte noch einmal kurz über deinen Eintrag:',
    '',
    `📅 Datum: ${payload.date}`,
    `⚡ Anschluss: ${parsed.data.connector}`,
    `🔋 SoC: ${parsed.data.soc_start}% → ${parsed.data.soc_end}%`,
    `⚡ Energie: ${formatDecimal(parsed.data.energy_kwh, 1)} kWh`,
    `💶 Preis: ${formatDecimal(parsed.data.price_per_kwh)} EUR/kWh`,
    `🧾 Gesamtkosten: ${formatDecimal(parsed.data.total_cost)} EUR`,
  ];

  if (optionalLines.length) {
    lines.push('', '📝 Zusätzliche Angaben', ...optionalLines);
  }

  if (missingOptionalFields.length) {
    lines.push('', `➖ Ohne Angabe: ${missingOptionalFields.join(', ')}`);
  }

  return {
    parsed,
    text: `${lines.join('\n')}\n\nWenn alles passt, tippe unten auf „✅ 1 - Speichern“.\nWenn du noch etwas ändern möchtest, nimm „🔄 2 - Neu starten“.`,
  };
}

function createTelegramBot(options = {}) {
  const {
    telegramConfig = {},
    prisma,
    logger = {},
    fetchImpl = globalThis.fetch,
    now = () => new Date(),
  } = options;

  const botToken = String(telegramConfig.botToken || '').trim();
  const enabled = Boolean(telegramConfig.enabled && botToken);
  const allowedChatIds = new Set((telegramConfig.allowedChatIds || []).map((value) => String(value).trim()).filter(Boolean));
  const drafts = new Map();

  let nextOffset = 0;
  let running = false;
  let activeAbortController = null;
  let loopPromise = null;

  const log = {
    info: typeof logger.info === 'function' ? logger.info.bind(logger) : () => {},
    warn: typeof logger.warn === 'function' ? logger.warn.bind(logger) : () => {},
    error: typeof logger.error === 'function' ? logger.error.bind(logger) : () => {},
  };

  async function callTelegram(method, payload = {}, requestOptions = {}) {
    if (typeof fetchImpl !== 'function') {
      throw new Error('fetch ist für die Telegram-Anbindung nicht verfügbar.');
    }

    const response = await fetchImpl(`${TELEGRAM_API_BASE}/bot${botToken}/${method}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: requestOptions.signal,
    });

    if (!response.ok) {
      const errorBody = typeof response.text === 'function' ? await response.text() : '';
      throw new Error(`Telegram ${method} fehlgeschlagen (${response.status}): ${errorBody || 'unbekannter Fehler'}`);
    }

    const body = await response.json();
    if (!body?.ok) {
      throw new Error(body?.description || `Telegram ${method} fehlgeschlagen.`);
    }

    return body.result;
  }

  async function sendMessage(chatId, text, replyMarkup) {
    await callTelegram('sendMessage', {
      chat_id: chatId,
      text,
      ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
    });
  }

  async function answerCallbackQuery(callbackQueryId, text) {
    await callTelegram('answerCallbackQuery', {
      callback_query_id: callbackQueryId,
      ...(text ? { text } : {}),
    });
  }

  async function clearCallbackButtons(callbackQuery) {
    const chatId = callbackQuery?.message?.chat?.id;
    const messageId = callbackQuery?.message?.message_id;
    if (chatId == null || messageId == null) return;

    try {
      await callTelegram('editMessageReplyMarkup', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [],
        },
      });
    } catch {}
  }

  function clearExpiredDrafts() {
    const cutoff = now().getTime() - DRAFT_TTL_MS;
    for (const [chatId, draft] of drafts.entries()) {
      if ((draft.updatedAt || 0) < cutoff) {
        drafts.delete(chatId);
      }
    }
  }

  function upsertDraft(chatId, draft) {
    drafts.set(chatId, {
      ...draft,
      updatedAt: now().getTime(),
    });
  }

  async function sendStep(chatId, step) {
    await sendMessage(chatId, buildPrompt(step), stepKeyboard(step));
  }

  async function beginDraft(chatId) {
    upsertDraft(chatId, { step: 'date', data: {} });
    await sendStep(chatId, 'date');
  }

  async function cancelDraft(chatId) {
    drafts.delete(chatId);
    await sendMessage(chatId, 'Alles klar 🙂\nIch habe den aktuellen Entwurf verworfen. Wenn du magst, starten wir gleich einen neuen.', menuKeyboard());
  }

  async function sendWelcome(chatId) {
    await sendMessage(
      chatId,
      'Hallo 👋\nIch bin dein privater Session-Assistent für dein Mobility Dashboard 😊\n\nWenn du möchtest, trage ich mit dir Schritt für Schritt einen neuen Ladevorgang ein.\nStarte einfach über den Button „✨ Neue Session starten“ oder mit /new.\n\nHilfreiche Befehle:\n/new\n/summary\n/cancel\n/help\n/whoami',
      menuKeyboard()
    );
  }

  async function sendDashboardSummary(chatId) {
    const reference = now();
    const year = reference.getFullYear();
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    try {
      const rows = await prisma.chargingSession.findMany({
        where: { date: { gte: start, lt: end } },
        orderBy: { date: 'desc' },
      });
      if (!rows.length) {
        await sendMessage(chatId, `Für ${year} sind noch keine Ladevorgänge gespeichert.`, menuKeyboard());
        return;
      }
      const energy = rows.reduce((sum, row) => sum + (Number(row.energy_kwh) || 0), 0);
      const cost = rows.reduce((sum, row) => sum + (Number(row.total_cost) || 0), 0);
      const averagePrice = energy > 0 ? cost / energy : null;
      const latest = rows[0]?.date ? new Date(rows[0].date) : null;
      const latestLabel = latest && !Number.isNaN(latest.getTime())
        ? latest.toLocaleDateString('de-DE')
        : '–';
      await sendMessage(
        chatId,
        `📊 Deine Ladeübersicht ${year}\n\n🔌 Sessions: ${rows.length}\n⚡ Energie: ${formatDecimal(energy, 1)} kWh\n💶 Kosten: ${formatDecimal(cost)} EUR\n🏷️ Ø Preis: ${averagePrice != null ? `${formatDecimal(averagePrice, 3)} EUR/kWh` : '–'}\n📅 Letzte Session: ${latestLabel}\n\nDie priorisierten Hinweise und Datenqualitätsaufgaben findest du im Benachrichtigungs-Center des Dashboards.`,
        menuKeyboard()
      );
    } catch (error) {
      log.error({ error, chatId }, 'Telegram summary failed');
      await sendMessage(chatId, 'Die Jahresübersicht konnte gerade nicht geladen werden. Bitte versuche es später erneut.', menuKeyboard());
    }
  }

  async function sendUnauthorized(chatId, message) {
    await sendMessage(chatId, message, menuKeyboard());
  }

  async function handleConfirm(chatId, draft, text) {
    if (isSaveText(text)) {
      const summary = buildSummary(draft.data);
      if (summary.error) {
        await sendMessage(chatId, `Hier passt noch etwas nicht ganz 😕\n${summary.error}`, stepKeyboard('confirm'));
        return;
      }

      try {
        const created = await prisma.chargingSession.create({
          data: summary.parsed.data,
        });

        drafts.delete(chatId);
        await sendMessage(
          chatId,
          `🎉 Perfekt, dein Ladevorgang ist gespeichert!\n\n📅 Datum: ${draft.data.date}\n🧾 Gesamtkosten: ${formatDecimal(created.total_cost)} EUR\n\nWenn du magst, kannst du direkt den nächsten Eintrag starten 🙂`,
          menuKeyboard()
        );
      } catch (error) {
        log.error({ error, chatId }, 'Telegram session save failed');
        await sendMessage(
          chatId,
          'Beim Speichern ist leider etwas schiefgelaufen 😕\nDer Entwurf bleibt aber offen. Du kannst es direkt noch einmal mit „✅ 1 - Speichern“ versuchen oder mit „❌ Abbrechen“ beenden.',
          stepKeyboard('confirm')
        );
      }
      return;
    }

    if (isCancelText(text) || extractChoiceNumber(text) === 3) {
      await cancelDraft(chatId);
      return;
    }

    if (isRestartText(text) || isNewSessionText(text)) {
      await beginDraft(chatId);
      return;
    }

    await sendMessage(chatId, 'Fast geschafft 🙂\nBitte nutze jetzt einen der Buttons unter der Zusammenfassung.\n1 = Speichern\n2 = Neu starten\n3 = Abbrechen', stepKeyboard('confirm'));
  }

  async function moveToNextStep(chatId, draft, nextStep) {
    upsertDraft(chatId, { ...draft, step: nextStep });
    await sendStep(chatId, nextStep);
  }

  function cloneDraft(draft) {
    return {
      ...draft,
      data: { ...draft.data },
    };
  }

  async function sendDraftStepError(chatId, step, message) {
    await sendMessage(chatId, message, stepKeyboard(step));
  }

  async function updateDraftAndMove(chatId, draft, field, value, nextStep) {
    draft.data[field] = value;
    await moveToNextStep(chatId, draft, nextStep);
  }

  async function handleDateStep(chatId, draft, text) {
    const date = parseDateInput(text, now);
    if (!date) {
      await sendDraftStepError(chatId, 'date', 'Das Datum konnte ich leider nicht verstehen 😕\nBitte sende YYYY-MM-DD, DD.MM.YYYY oder nutze einfach 1 für Heute bzw. 2 für Gestern.');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'date', date, 'connector');
  }

  async function handleConnectorStep(chatId, draft, text) {
    const connector = parseConnectorInput(text);
    if (!connector) {
      await sendDraftStepError(chatId, 'connector', 'Ich brauche hier einen gültigen Anschluss 🙂\nBitte wähle einen Button oder sende einfach 1, 2 oder 3.');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'connector', connector, 'provider');
  }

  async function handleOptionalTextStep(chatId, draft, text, field, nextStep) {
    await updateDraftAndMove(
      chatId,
      draft,
      field,
      isSkipText(text) ? null : normalizeOptionalText(text),
      nextStep
    );
  }

  async function handleVehicleStep(chatId, draft, text) {
    const vehicleChoice = parseVehicleInput(text);
    if (!vehicleChoice) {
      await sendDraftStepError(chatId, 'vehicle', 'Hier kannst du 1 für dein Standardfahrzeug, 2 für „ohne Angabe“ oder einen eigenen Fahrzeugnamen senden 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'vehicle', vehicleChoice.value, 'tags');
  }

  async function handleSocStartStep(chatId, draft, text) {
    const value = parseIntegerInput(text, { min: 0, max: 100 });
    if (value == null) {
      await sendDraftStepError(chatId, 'soc_start', 'Bitte sende den SoC Start als Zahl zwischen 0 und 100 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'soc_start', value, 'soc_end');
  }

  async function handleSocEndStep(chatId, draft, text) {
    const value = parseIntegerInput(text, { min: 0, max: 100 });
    if (value == null) {
      await sendDraftStepError(chatId, 'soc_end', 'Bitte sende den SoC Ende als Zahl zwischen 0 und 100 🙂');
      return;
    }
    if (value < Number(draft.data.soc_start)) {
      await sendDraftStepError(chatId, 'soc_end', 'Der SoC am Ende darf nicht kleiner sein als der SoC am Anfang 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'soc_end', value, 'energy_kwh');
  }

  async function handleEnergyStep(chatId, draft, text) {
    const value = parseDecimalInput(text, { minExclusive: 0 });
    if (value == null) {
      await sendDraftStepError(chatId, 'energy_kwh', 'Bitte sende eine gültige Energiemenge größer als 0, zum Beispiel 42,5 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'energy_kwh', value, 'price_per_kwh');
  }

  async function handlePriceStep(chatId, draft, text) {
    const value = parseDecimalInput(text, { minExclusive: 0 });
    if (value == null) {
      await sendDraftStepError(chatId, 'price_per_kwh', 'Bitte sende einen gültigen Preis größer als 0, zum Beispiel 0,59 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'price_per_kwh', value, 'duration_hhmm');
  }

  async function handleDurationStep(chatId, draft, text) {
    const value = parseDurationInput(text);
    if (!value) {
      await sendDraftStepError(chatId, 'duration_hhmm', 'Bitte sende die Dauer als HH:MM oder in Minuten, zum Beispiel 00:32 oder 32 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'duration_hhmm', value, 'odometer_km');
  }

  async function handleOdometerStep(chatId, draft, text) {
    if (isSkipText(text)) {
      await updateDraftAndMove(chatId, draft, 'odometer_km', null, 'note');
      return;
    }

    const value = parseIntegerInput(text, { min: 0, max: 2000000 });
    if (value == null) {
      await sendDraftStepError(chatId, 'odometer_km', 'Bitte sende den Kilometerstand als ganze Zahl oder tippe einfach 1 für „ohne Angabe“ 🙂');
      return;
    }

    await updateDraftAndMove(chatId, draft, 'odometer_km', value, 'note');
  }

  async function handleNoteStep(chatId, draft, text) {
    draft.data.note = isSkipText(text) ? null : normalizeOptionalText(text);
    const summary = buildSummary(draft.data);

    if (summary.error) {
      await sendDraftStepError(chatId, 'note', `Fast geschafft, aber hier fehlt noch etwas 😕\n${summary.error}`);
      return;
    }

    upsertDraft(chatId, { ...draft, step: 'confirm' });
    await sendMessage(chatId, summary.text, stepKeyboard('confirm'));
  }

  const draftStepHandlers = {
    date: handleDateStep,
    connector: handleConnectorStep,
    provider: (chatId, draft, text) => handleOptionalTextStep(chatId, draft, text, 'provider', 'location'),
    location: (chatId, draft, text) => handleOptionalTextStep(chatId, draft, text, 'location', 'vehicle'),
    vehicle: handleVehicleStep,
    tags: (chatId, draft, text) => handleOptionalTextStep(chatId, draft, text, 'tags', 'soc_start'),
    soc_start: handleSocStartStep,
    soc_end: handleSocEndStep,
    energy_kwh: handleEnergyStep,
    price_per_kwh: handlePriceStep,
    duration_hhmm: handleDurationStep,
    odometer_km: handleOdometerStep,
    note: handleNoteStep,
    confirm: handleConfirm,
  };

  async function handleDraftInput(chatId, draft, text) {
    if (isCancelText(text)) {
      await cancelDraft(chatId);
      return;
    }

    if (isNewSessionText(text)) {
      await beginDraft(chatId);
      return;
    }

    const nextDraft = cloneDraft(draft);
    const handler = draftStepHandlers[draft.step];

    if (!handler) {
      await beginDraft(chatId);
      return;
    }

    await handler(chatId, nextDraft, text);
  }

  async function handleCommand(chatId, text) {
    const normalized = normalizeControlText(text).split('@')[0];

    if (normalized === '/start' || normalized === '/help') {
      await sendWelcome(chatId);
      return;
    }

    if (normalized === '/new') {
      await beginDraft(chatId);
      return;
    }

    if (normalized === '/summary') {
      await sendDashboardSummary(chatId);
      return;
    }

    if (normalized === '/cancel') {
      if (drafts.has(chatId)) {
        await cancelDraft(chatId);
        return;
      }
      await sendMessage(chatId, 'Es gibt aktuell keinen offenen Entwurf.', menuKeyboard());
      return;
    }

    if (normalized === '/whoami') {
      await sendMessage(chatId, `Deine Telegram Chat-ID ist ${chatId} 🙂`, menuKeyboard());
      return;
    }

    await sendWelcome(chatId);
  }

  async function handleCallbackQuery(callbackQuery) {
    const chatId = callbackQuery?.message?.chat?.id != null ? String(callbackQuery.message.chat.id) : null;
    if (!chatId) return;

    const action = parseCallbackAction(callbackQuery?.data);
    if (!action) {
      await answerCallbackQuery(callbackQuery.id, 'Diese Auswahl kenne ich leider nicht.');
      return;
    }

    if (!allowedChatIds.has(chatId)) {
      await answerCallbackQuery(callbackQuery.id, 'Dieser Bot ist privat.');
      await sendUnauthorized(chatId, 'Dieser Bot ist privat und für diesen Chat nicht freigeschaltet.');
      return;
    }

    if (callbackQuery?.message?.chat?.type && callbackQuery.message.chat.type !== 'private') {
      await answerCallbackQuery(callbackQuery.id, 'Bitte nur im privaten Chat verwenden.');
      await sendMessage(chatId, 'Bitte diesen Bot nur im privaten Direktchat verwenden.', menuKeyboard());
      return;
    }

    if (action.type === 'command') {
      await answerCallbackQuery(callbackQuery.id);
      await clearCallbackButtons(callbackQuery);
      await handleCommand(chatId, action.text);
      return;
    }

    const draft = drafts.get(chatId);
    if (!draft) {
      await answerCallbackQuery(callbackQuery.id, 'Ich starte dir kurz eine neue Session 🙂');
      await clearCallbackButtons(callbackQuery);
      await beginDraft(chatId);
      return;
    }

    if (draft.step !== action.step) {
      await answerCallbackQuery(callbackQuery.id, 'Ich bin schon beim nächsten Schritt. Ich sende dir die aktuelle Frage noch einmal 🙂');
      await sendStep(chatId, draft.step);
      return;
    }

    await answerCallbackQuery(callbackQuery.id);
    await clearCallbackButtons(callbackQuery);
    await handleDraftInput(chatId, draft, action.text);
  }

  async function handleUpdate(update) {
    clearExpiredDrafts();

    const callbackQuery = update?.callback_query;
    if (callbackQuery) {
      await handleCallbackQuery(callbackQuery);
      return;
    }

    const message = update?.message;
    const chatId = message?.chat?.id != null ? String(message.chat.id) : null;
    if (!chatId) return;

    const text = normalizeOptionalText(message?.text);
    if (!text) {
      if (allowedChatIds.has(chatId)) {
        await sendMessage(chatId, 'Bitte Textnachrichten oder die eingeblendeten Buttons verwenden.', drafts.has(chatId) ? stepKeyboard(drafts.get(chatId).step) : menuKeyboard());
      }
      return;
    }

    if (!allowedChatIds.has(chatId)) {
      log.warn({
        chatId,
        username: message?.from?.username || null,
      }, 'Rejected unauthorized Telegram chat');
      await sendUnauthorized(chatId, 'Dieser Bot ist privat und für diesen Chat nicht freigeschaltet.');
      return;
    }

    if (message?.chat?.type && message.chat.type !== 'private') {
      await sendMessage(chatId, 'Bitte diesen Bot nur im privaten Direktchat verwenden.', menuKeyboard());
      return;
    }

    if (text.startsWith('/')) {
      await handleCommand(chatId, text);
      return;
    }

    const draft = drafts.get(chatId);
    if (!draft) {
      if (isNewSessionText(text)) {
        await beginDraft(chatId);
        return;
      }
      await sendWelcome(chatId);
      return;
    }

    await handleDraftInput(chatId, draft, text);
  }

  async function pollLoop() {
    while (running) {
      const abortController = new AbortController();
      activeAbortController = abortController;

      try {
        const updates = await callTelegram('getUpdates', {
          offset: nextOffset,
          timeout: 25,
          allowed_updates: ['message', 'callback_query'],
        }, { signal: abortController.signal });

        for (const update of Array.isArray(updates) ? updates : []) {
          nextOffset = Math.max(nextOffset, Number(update?.update_id || 0) + 1);
          await handleUpdate(update);
        }
      } catch (error) {
        if (!running && error?.name === 'AbortError') {
          break;
        }

        log.error({ error }, 'Telegram polling failed');
        await new Promise((resolve) => setTimeout(resolve, 3000));
      } finally {
        activeAbortController = null;
      }
    }
  }

  function start() {
    if (!enabled || running) return;

    running = true;
    log.info({ chatIds: [...allowedChatIds] }, 'Telegram bot enabled');
    loopPromise = pollLoop();
  }

  async function stop() {
    running = false;
    if (activeAbortController) {
      activeAbortController.abort();
    }
    await loopPromise;
  }

  return {
    enabled,
    handleUpdate,
    start,
    stop,
  };
}

module.exports = {
  createTelegramBot,
  parseDateInput,
  parseDurationInput,
};
