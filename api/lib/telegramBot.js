'use strict';

const { parseSessionMutation } = require('./sessionMutation');
const { normalizeOptionalText } = require('./sessionMetadata');

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const DEFAULT_CONNECTOR_OPTIONS = ['CCS - DC', 'CCS AC', 'Wallbox AC'];
const DEFAULT_VEHICLE = 'CUPRA Born 79 kWh';
const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

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

function isCancelText(value) {
  const normalized = normalizeControlText(value);
  return normalized === '/cancel'
    || normalized === 'abbrechen'
    || normalized === 'cancel'
    || normalized === '❌ abbrechen';
}

function isSkipText(value) {
  const normalized = normalizeControlText(value);
  const choiceNumber = extractChoiceNumber(value);
  return choiceNumber === 1
    || normalized === '/skip'
    || normalized === 'überspringen'
    || normalized === 'ueberspringen'
    || normalized === 'skip'
    || normalized === 'ohne angabe'
    || normalized === '1 - ohne angabe'
    || normalized === '⏭️ 1 - ohne angabe';
}

function isNewSessionText(value) {
  const normalized = normalizeControlText(value);
  return normalized === '/new'
    || normalized === 'neue session'
    || normalized === 'neu'
    || normalized === '✨ neue session starten';
}

function isRestartText(value) {
  const normalized = normalizeControlText(value);
  return extractChoiceNumber(value) === 2
    || normalized === 'neu starten'
    || normalized === '🔄 2 - neu starten';
}

function isSaveText(value) {
  const normalized = normalizeControlText(value);
  return extractChoiceNumber(value) === 1
    || normalized === 'speichern'
    || normalized === '/save'
    || normalized === '✅ 1 - speichern';
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
  if (choiceNumber === 1) return 'CCS - DC';
  if (choiceNumber === 2) return 'CCS AC';
  if (choiceNumber === 3) return 'Wallbox AC';

  const compact = raw.replace(/\s+/g, ' ').trim();
  const withoutPrefix = compact.replace(/^\d+\s*[-.)]?\s*/, '').trim();
  const normalized = withoutPrefix.replace(/\s*-\s*/g, ' - ');

  const aliases = new Map([
    ['1', 'CCS - DC'],
    ['ccs - dc', 'CCS - DC'],
    ['ccs dc', 'CCS - DC'],
    ['dc', 'CCS - DC'],
    ['2', 'CCS AC'],
    ['ccs ac', 'CCS AC'],
    ['ac', 'CCS AC'],
    ['3', 'Wallbox AC'],
    ['wallbox ac', 'Wallbox AC'],
    ['wallbox', 'Wallbox AC'],
    ['home', 'Wallbox AC'],
  ]);

  return aliases.get(compact) || aliases.get(normalized) || null;
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
  ]);
}

function cancelKeyboard() {
  return buildInlineKeyboard([
    [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
  ]);
}

function stepKeyboard(step) {
  if (step === 'date') {
    return buildInlineKeyboard([
      [
        { text: '📅 1 - Heute', callback_data: 'date:today' },
        { text: '🕘 2 - Gestern', callback_data: 'date:yesterday' },
      ],
      [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
    ]);
  }

  if (step === 'connector') {
    return buildInlineKeyboard([
      [
        { text: '⚡ 1 - CCS - DC', callback_data: 'connector:dc' },
        { text: '🔌 2 - CCS AC', callback_data: 'connector:ac' },
      ],
      [{ text: '🏠 3 - Wallbox AC', callback_data: 'connector:wallbox' }],
      [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
    ]);
  }

  if (step === 'vehicle') {
    return buildInlineKeyboard([
      [
        { text: '🚗 1 - Standardfahrzeug', callback_data: 'vehicle:default' },
        { text: '⏭️ 2 - Ohne Angabe', callback_data: 'vehicle:skip' },
      ],
      [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
    ]);
  }

  if (step === 'confirm') {
    return buildInlineKeyboard([
      [{ text: '✅ 1 - Speichern', callback_data: 'confirm:save' }],
      [
        { text: '🔄 2 - Neu starten', callback_data: 'confirm:restart' },
        { text: '❌ 3 - Abbrechen', callback_data: 'confirm:cancel' },
      ],
    ]);
  }

  if (step === 'provider' || step === 'location' || step === 'tags' || step === 'odometer_km' || step === 'note') {
    return buildInlineKeyboard([
      [{ text: '⏭️ 1 - Ohne Angabe', callback_data: `${step}:skip` }],
      [{ text: '❌ Abbrechen', callback_data: 'nav:cancel' }],
    ]);
  }

  return cancelKeyboard();
}

function parseCallbackAction(data) {
  switch (String(data || '')) {
    case 'menu:new':
      return { type: 'command', text: '/new' };
    case 'nav:cancel':
      return { type: 'command', text: '/cancel' };
    case 'date:today':
      return { type: 'step', step: 'date', text: '1' };
    case 'date:yesterday':
      return { type: 'step', step: 'date', text: '2' };
    case 'connector:dc':
      return { type: 'step', step: 'connector', text: '1' };
    case 'connector:ac':
      return { type: 'step', step: 'connector', text: '2' };
    case 'connector:wallbox':
      return { type: 'step', step: 'connector', text: '3' };
    case 'provider:skip':
      return { type: 'step', step: 'provider', text: '1' };
    case 'location:skip':
      return { type: 'step', step: 'location', text: '1' };
    case 'vehicle:default':
      return { type: 'step', step: 'vehicle', text: '1' };
    case 'vehicle:skip':
      return { type: 'step', step: 'vehicle', text: '2' };
    case 'tags:skip':
      return { type: 'step', step: 'tags', text: '1' };
    case 'odometer_km:skip':
      return { type: 'step', step: 'odometer_km', text: '1' };
    case 'note:skip':
      return { type: 'step', step: 'note', text: '1' };
    case 'confirm:save':
      return { type: 'step', step: 'confirm', text: '1' };
    case 'confirm:restart':
      return { type: 'step', step: 'confirm', text: '2' };
    case 'confirm:cancel':
      return { type: 'step', step: 'confirm', text: '3' };
    default:
      return null;
  }
}

function buildPrompt(step) {
  switch (step) {
    case 'date':
      return 'Hallo 👋\nSchön, dass du da bist. Ich begleite dich jetzt Schritt für Schritt durch den Eintrag deines Ladevorgangs 🙂\n\nSo funktioniert es:\n• Ich frage dich nacheinander alle wichtigen Angaben.\n• Bei optionalen Feldern kannst du einfach auf den Button tippen oder nur die Zahl senden.\n• Mit „❌ Abbrechen“ kannst du jederzeit stoppen.\n\n1/13 Datum\nWann war der Ladevorgang?\nDu kannst „1 - Heute“, „2 - Gestern“ oder ein Datum wie 15.03.2026 senden.';
    case 'connector':
      return '2/13 Anschluss ⚡\nWelchen Anschluss hast du genutzt?\n\n1. CCS - DC\n2. CCS AC\n3. Wallbox AC\n\nWenn dir Telegram keine Buttons zeigt, antworte einfach mit 1, 2 oder 3.';
    case 'provider':
      return '3/13 Betreiber 🙂\nWer war der Betreiber?\nZum Beispiel: Ionity, EnBW oder Aral Pulse.\n\nWenn du das Feld leer lassen möchtest, tippe einfach auf „⏭️ 1 - Ohne Angabe“ oder sende nur 1.';
    case 'location':
      return '4/13 Standort 📍\nWo hast du geladen?\nZum Beispiel: Raststätte Holmmoor West oder Zuhause.\n\nWenn du keinen Standort angeben möchtest, tippe einfach 1.';
    case 'vehicle':
      return `5/13 Fahrzeug 🚗\nWelches Fahrzeug war es?\n\n1. Standardfahrzeug verwenden\n2. Ohne Angabe weiter\n\nDein Standardfahrzeug ist aktuell: ${DEFAULT_VEHICLE}\nDu kannst aber auch einfach einen eigenen Fahrzeugnamen senden.`;
    case 'tags':
      return '6/13 Tags 🏷️\nMöchtest du Tags vergeben?\nDu kannst mehrere Tags mit Komma trennen, zum Beispiel: Reise, HPC, Urlaub.\n\nWenn du keine Tags setzen möchtest, tippe einfach 1.';
    case 'soc_start':
      return '7/13 SoC Start 🔋\nWie hoch war der Akkustand zu Beginn?\nBitte als Prozentzahl senden, zum Beispiel 12.';
    case 'soc_end':
      return '8/13 SoC Ende 🔋\nDanke dir. Wie hoch war der Akkustand am Ende?\nBitte wieder als Prozentzahl senden, zum Beispiel 80.';
    case 'energy_kwh':
      return '9/13 Geladene Energie ⚡\nWie viel Energie wurde geladen?\nBitte in kWh senden, zum Beispiel 42,5.';
    case 'price_per_kwh':
      return '10/13 Preis 💶\nWie hoch war der Preis pro kWh?\nBitte in Euro senden, zum Beispiel 0,59.';
    case 'duration_hhmm':
      return '11/13 Dauer ⏱️\nWie lange hat der Ladevorgang gedauert?\nDu kannst HH:MM oder einfach Minuten senden, zum Beispiel 00:32 oder 32.';
    case 'odometer_km':
      return '12/13 Kilometerstand 🚙\nWenn du magst, sende jetzt den Kilometerstand in km.\nWenn du ihn nicht angeben möchtest, tippe einfach 1.';
    case 'note':
      return '13/13 Notiz ✍️\nFast geschafft 😊\nWenn du noch eine kurze Notiz ergänzen möchtest, schick sie mir jetzt.\nWenn nicht, tippe einfach 1.';
    default:
      return 'Bitte antworte über die eingeblendeten Optionen 🙂';
  }
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
    } catch {
      // Alte Buttons dürfen im Fehlerfall einfach stehenbleiben.
    }
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
      'Hallo 👋\nIch bin dein privater Session-Assistent für dein Mobility Dashboard 😊\n\nWenn du möchtest, trage ich mit dir Schritt für Schritt einen neuen Ladevorgang ein.\nStarte einfach über den Button „✨ Neue Session starten“ oder mit /new.\n\nHilfreiche Befehle:\n/new\n/cancel\n/help\n/whoami',
      menuKeyboard()
    );
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

  async function handleDraftInput(chatId, draft, text) {
    if (isCancelText(text)) {
      await cancelDraft(chatId);
      return;
    }

    if (isNewSessionText(text)) {
      await beginDraft(chatId);
      return;
    }

    const nextDraft = {
      ...draft,
      data: { ...draft.data },
    };

    switch (draft.step) {
      case 'date': {
        const date = parseDateInput(text, now);
        if (!date) {
          await sendMessage(chatId, 'Das Datum konnte ich leider nicht verstehen 😕\nBitte sende YYYY-MM-DD, DD.MM.YYYY oder nutze einfach 1 für Heute bzw. 2 für Gestern.', stepKeyboard('date'));
          return;
        }
        nextDraft.data.date = date;
        await moveToNextStep(chatId, nextDraft, 'connector');
        return;
      }

      case 'connector': {
        const connector = parseConnectorInput(text);
        if (!connector) {
          await sendMessage(chatId, 'Ich brauche hier einen gültigen Anschluss 🙂\nBitte wähle einen Button oder sende einfach 1, 2 oder 3.', stepKeyboard('connector'));
          return;
        }
        nextDraft.data.connector = connector;
        await moveToNextStep(chatId, nextDraft, 'provider');
        return;
      }

      case 'provider': {
        nextDraft.data.provider = isSkipText(text) ? null : normalizeOptionalText(text);
        await moveToNextStep(chatId, nextDraft, 'location');
        return;
      }

      case 'location': {
        nextDraft.data.location = isSkipText(text) ? null : normalizeOptionalText(text);
        await moveToNextStep(chatId, nextDraft, 'vehicle');
        return;
      }

      case 'vehicle': {
        const vehicleChoice = parseVehicleInput(text);
        if (!vehicleChoice) {
          await sendMessage(chatId, 'Hier kannst du 1 für dein Standardfahrzeug, 2 für „ohne Angabe“ oder einen eigenen Fahrzeugnamen senden 🙂', stepKeyboard('vehicle'));
          return;
        }
        nextDraft.data.vehicle = vehicleChoice.value;
        await moveToNextStep(chatId, nextDraft, 'tags');
        return;
      }

      case 'tags': {
        nextDraft.data.tags = isSkipText(text) ? null : normalizeOptionalText(text);
        await moveToNextStep(chatId, nextDraft, 'soc_start');
        return;
      }

      case 'soc_start': {
        const value = parseIntegerInput(text, { min: 0, max: 100 });
        if (value == null) {
          await sendMessage(chatId, 'Bitte sende den SoC Start als Zahl zwischen 0 und 100 🙂', stepKeyboard('soc_start'));
          return;
        }
        nextDraft.data.soc_start = value;
        await moveToNextStep(chatId, nextDraft, 'soc_end');
        return;
      }

      case 'soc_end': {
        const value = parseIntegerInput(text, { min: 0, max: 100 });
        if (value == null) {
          await sendMessage(chatId, 'Bitte sende den SoC Ende als Zahl zwischen 0 und 100 🙂', stepKeyboard('soc_end'));
          return;
        }
        if (value < Number(nextDraft.data.soc_start)) {
          await sendMessage(chatId, 'Der SoC am Ende darf nicht kleiner sein als der SoC am Anfang 🙂', stepKeyboard('soc_end'));
          return;
        }
        nextDraft.data.soc_end = value;
        await moveToNextStep(chatId, nextDraft, 'energy_kwh');
        return;
      }

      case 'energy_kwh': {
        const value = parseDecimalInput(text, { minExclusive: 0 });
        if (value == null) {
          await sendMessage(chatId, 'Bitte sende eine gültige Energiemenge größer als 0, zum Beispiel 42,5 🙂', stepKeyboard('energy_kwh'));
          return;
        }
        nextDraft.data.energy_kwh = value;
        await moveToNextStep(chatId, nextDraft, 'price_per_kwh');
        return;
      }

      case 'price_per_kwh': {
        const value = parseDecimalInput(text, { minExclusive: 0 });
        if (value == null) {
          await sendMessage(chatId, 'Bitte sende einen gültigen Preis größer als 0, zum Beispiel 0,59 🙂', stepKeyboard('price_per_kwh'));
          return;
        }
        nextDraft.data.price_per_kwh = value;
        await moveToNextStep(chatId, nextDraft, 'duration_hhmm');
        return;
      }

      case 'duration_hhmm': {
        const value = parseDurationInput(text);
        if (!value) {
          await sendMessage(chatId, 'Bitte sende die Dauer als HH:MM oder in Minuten, zum Beispiel 00:32 oder 32 🙂', stepKeyboard('duration_hhmm'));
          return;
        }
        nextDraft.data.duration_hhmm = value;
        await moveToNextStep(chatId, nextDraft, 'odometer_km');
        return;
      }

      case 'odometer_km': {
        if (isSkipText(text)) {
          nextDraft.data.odometer_km = null;
        } else {
          const value = parseIntegerInput(text, { min: 0, max: 2000000 });
          if (value == null) {
            await sendMessage(chatId, 'Bitte sende den Kilometerstand als ganze Zahl oder tippe einfach 1 für „ohne Angabe“ 🙂', stepKeyboard('odometer_km'));
            return;
          }
          nextDraft.data.odometer_km = value;
        }
        await moveToNextStep(chatId, nextDraft, 'note');
        return;
      }

      case 'note': {
        nextDraft.data.note = isSkipText(text) ? null : normalizeOptionalText(text);
        const summary = buildSummary(nextDraft.data);
        if (summary.error) {
          await sendMessage(chatId, `Fast geschafft, aber hier fehlt noch etwas 😕\n${summary.error}`, stepKeyboard('note'));
          return;
        }
        upsertDraft(chatId, { ...nextDraft, step: 'confirm' });
        await sendMessage(chatId, summary.text, stepKeyboard('confirm'));
        return;
      }

      case 'confirm':
        await handleConfirm(chatId, nextDraft, text);
        return;

      default:
        await beginDraft(chatId);
    }
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
