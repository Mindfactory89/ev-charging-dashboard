const test = require('node:test');
const assert = require('node:assert/strict');

const { createTelegramBot } = require('../lib/telegramBot');

function createFetchStub(sentMessages) {
  return async (url, options) => {
    const payload = JSON.parse(options.body);

    if (String(url).includes('/sendMessage')) {
      sentMessages.push(payload);
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: sentMessages.length } }),
      };
    }

    if (String(url).includes('/getUpdates')) {
      return {
        ok: true,
        json: async () => ({ ok: true, result: [] }),
      };
    }

    if (String(url).includes('/answerCallbackQuery') || String(url).includes('/editMessageReplyMarkup')) {
      return {
        ok: true,
        json: async () => ({ ok: true, result: true }),
      };
    }

    throw new Error(`Unexpected Telegram call: ${url}`);
  };
}

function createMessage(text, chatId = 12345) {
  return {
    update_id: Date.now(),
    message: {
      chat: {
        id: chatId,
        type: 'private',
      },
      from: {
        username: 'bjorn',
      },
      text,
    },
  };
}

function createCallbackQuery(data, chatId = 12345, messageId = 99) {
  return {
    update_id: Date.now(),
    callback_query: {
      id: `cb-${Date.now()}`,
      data,
      from: {
        id: chatId,
        username: 'bjorn',
      },
      message: {
        message_id: messageId,
        chat: {
          id: chatId,
          type: 'private',
        },
      },
    },
  };
}

test('telegram bot creates a charging session from the guided draft flow', async () => {
  const sentMessages = [];
  const createdRows = [];
  const bot = createTelegramBot({
    telegramConfig: {
      enabled: true,
      botToken: '123:abc',
      allowedChatIds: ['12345'],
    },
    prisma: {
      chargingSession: {
        create: async ({ data }) => {
          createdRows.push(data);
          return { id: 'session-1', ...data };
        },
      },
    },
    logger: {},
    fetchImpl: createFetchStub(sentMessages),
    now: () => new Date('2026-03-15T10:00:00+01:00'),
  });

  const sequence = [
    '/new',
    '1 - Heute',
    '1',
    'Ionity',
    'Raststätte Holmmoor West',
    '1',
    'reise, hpc',
    '12',
    '80',
    '42,5',
    '0,59',
    '00:32',
    '1',
    'Autobahn-Stopp',
    '✅ 1 - Speichern',
  ];

  for (const text of sequence) {
    await bot.handleUpdate(createMessage(text));
  }

  assert.equal(createdRows.length, 1);
  assert.equal(createdRows[0].provider, 'Ionity');
  assert.equal(createdRows[0].vehicle, 'CUPRA Born 79 kWh');
  assert.equal(createdRows[0].duration_seconds, 32 * 60);
  assert.equal(createdRows[0].total_cost, 25.07);
  assert.match(sentMessages[0].text, /Schön, dass du da bist/i);
  assert.match(sentMessages[1].text, /1\.\s+CCS - DC/i);
  assert.equal(Array.isArray(sentMessages[1].reply_markup.inline_keyboard), true);
  assert.match(sentMessages.at(-1).text, /Perfekt, dein Ladevorgang ist gespeichert/i);
});

test('telegram bot accepts inline button callbacks for the dialog flow', async () => {
  const sentMessages = [];
  const bot = createTelegramBot({
    telegramConfig: {
      enabled: true,
      botToken: '123:abc',
      allowedChatIds: ['12345'],
    },
    prisma: {
      chargingSession: {
        create: async ({ data }) => ({ id: 'session-2', ...data }),
      },
    },
    logger: {},
    fetchImpl: createFetchStub(sentMessages),
    now: () => new Date('2026-03-15T10:00:00+01:00'),
  });

  await bot.handleUpdate(createMessage('/new'));
  await bot.handleUpdate(createCallbackQuery('date:today'));

  assert.match(sentMessages[0].text, /1\/13 Datum/i);
  assert.match(sentMessages[1].text, /2\/13 Anschluss/i);
  assert.equal(sentMessages[1].reply_markup.inline_keyboard[0][0].callback_data, 'connector:dc');
});

test('telegram bot rejects unauthorized chats', async () => {
  const sentMessages = [];
  const bot = createTelegramBot({
    telegramConfig: {
      enabled: true,
      botToken: '123:abc',
      allowedChatIds: ['12345'],
    },
    prisma: {
      chargingSession: {
        create: async () => {
          throw new Error('should not be called');
        },
      },
    },
    logger: {},
    fetchImpl: createFetchStub(sentMessages),
  });

  await bot.handleUpdate(createMessage('/new', 99999));

  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0].text, /privat/i);
});
