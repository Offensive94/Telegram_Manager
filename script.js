const BOT_TOKEN   = ''; // Введите Ваш токен бота
const ADMIN_ID    = ''; // Узнайте Ваш ID через @userinfobot
const SHEET_ID    = ''; // https://docs.google.com/spreadsheets/d/<ВАШ_ID>/edit
const TELEGRAM_API = 'https://api.telegram.org/bot' + BOT_TOKEN; // Не трогать

// Установка вебхука
function setWebhook() {
  const webAppUrl = '<Вставьте вашу развёртку приложения.>';
  UrlFetchApp.fetch(TELEGRAM_API + '/setWebhook?url=' + encodeURIComponent(webAppUrl));
  Logger.log('Webhook установлен: ' + webAppUrl);
}

// Удаление вебхука (если понадобится)
function deleteWebhook() {
  const resp = UrlFetchApp.fetch(TELEGRAM_API + '/deleteWebhook');
  Logger.log('Webhook удалён: ' + resp.getContentText());
}

// Обработчик входящих апдейтов
function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) return;
  const data = JSON.parse(e.postData.contents);
  if (data.message) {
    if (data.message.from && data.message.from.is_bot) return;
    handleMessage(data.message);
  }
}

// Извлечение User ID из сообщения бота (при ответе админа)
function extractUserId(text) {
  if (!text) return null;
  
  // Поиск шаблона "ID: 1234567" или "(ID: 1234567)"
  const idMatch = text.match(/ID:\s*(\d+)/i);
  if (idMatch && idMatch[1]) {
    return idMatch[1];
  }
  
  // Совместимость со старым форматом INITIALIZE BY ...
  if (text.includes('INITIALIZE BY')) {
    const initMatch = text.match(/INITIALIZE BY\s*(\d+)/i);
    if (initMatch && initMatch[1]) return initMatch[1];
  }
  
  return null;
}

// Обработка сообщений
function handleMessage(msg) {
  if (!msg.chat || msg.chat.type !== 'private') return;

  const chatId  = String(msg.chat.id);
  const fromId  = String(msg.from.id);
  const isAdmin = (fromId === ADMIN_ID);
  const sheet   = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();

  const text = msg.text || msg.caption || '';

  // Определение типов медиаконтента
  let mediaNotice = '';
  if (msg.photo) mediaNotice = '[🖼 Фотография]';
  else if (msg.voice) mediaNotice = '[🎙 Голосовое сообщение]';
  else if (msg.document) mediaNotice = '[📄 Документ]';
  else if (msg.sticker) mediaNotice = '[🎭 Стикер]';
  else if (msg.video) mediaNotice = '[🎥 Видео]';

  const fullContentText = text ? (mediaNotice ? mediaNotice + '\n' + text : text) : (mediaNotice || '[Сообщение]');

  // Если админ отвечает (Reply) на сообщение бота
  if (isAdmin && msg.reply_to_message) {
    const orig = msg.reply_to_message.text || msg.reply_to_message.caption || '';
    const userId = extractUserId(orig);

    if (userId) {
      if (msg.photo) {
        const photoId = msg.photo[msg.photo.length - 1].file_id;
        sendPhoto(userId, photoId, '💬 Ответ владельца:\n\n' + text);
      } else {
        sendMessage(userId, '💬 Ответ владельца:\n\n' + fullContentText);
      }
      sheet.appendRow([new Date(), userId, 'ADMIN_REPLY', fullContentText]);
      sendMessage(ADMIN_ID, '✅ Ответ отправлен пользователю!');
    } else {
      sendMessage(ADMIN_ID, '⚠️ Не удалось извлечь ID пользователя из сообщения.');
      Logger.log('Оригинальное сообщение: ' + orig);
    }
    return;
  }

  // ОБРАБОТКА КОМАНДЫ /start
  if (!isAdmin && msg.text && msg.text.trim() === '/start') {
    const adminMsg = 
      `🎱 INITIALIZE!\n` +
      `От: ${msg.from.first_name || 'Пользователь'} (ID: ${chatId})\n\n` +
      `Пользователь начал диалог`;
    
    sheet.appendRow([new Date(), chatId, 'INITIALIZE', text]);
    sendMessage(ADMIN_ID, adminMsg);
    sendMessage(chatId, '👋 Привет! Это бот для связи с Владельцем. Напиши своё сообщение ниже, и оно будет переслано.');
    return;
  } 
  
  // ОБРАБОТКА ОБЫЧНЫХ СООБЩЕНИЙ ПОЛЬЗОВАТЕЛЯ
  if (!isAdmin) {
    sheet.appendRow([new Date(), chatId, 'USER_MSG', fullContentText]);
    const adminMsg = 
      `✉️ Новое сообщение!\n` +
      `От: ${msg.from.first_name || 'Пользователь'} (ID: ${chatId})\n\n` +
      fullContentText;
    
    if (msg.photo) {
      const photoId = msg.photo[msg.photo.length - 1].file_id;
      sendPhoto(ADMIN_ID, photoId, adminMsg);
    } else {
      sendMessage(ADMIN_ID, adminMsg);
    }
    
    sendMessage(chatId, '✅ Ваше сообщение отправлено Владельцу!');
  }
}

// Утилита для отправки текстовых сообщений
function sendMessage(chatId, text) {
  if (!text || !text.trim()) return;
  const payload = {
    method: 'post',
    payload: {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML'
    },
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(TELEGRAM_API + '/sendMessage', payload);
  const data = JSON.parse(resp.getContentText());
  if (!data.ok) {
    Logger.log('sendMessage error: ' + data.description);
  }
}

// Утилита для отправки фотографий
function sendPhoto(chatId, photoFileId, caption) {
  const payload = {
    method: 'post',
    payload: {
      chat_id: chatId,
      photo: photoFileId,
      caption: caption || '',
      parse_mode: 'HTML'
    },
    muteHttpExceptions: true
  };
  const resp = UrlFetchApp.fetch(TELEGRAM_API + '/sendPhoto', payload);
  const data = JSON.parse(resp.getContentText());
  if (!data.ok) {
    Logger.log('sendPhoto error: ' + data.description);
  }
}
