const BOT_TOKEN   = ''; // Введите Ваш токен бота
const ADMIN_ID    = ''; // Узнайте Ваш ID через @userinfobot
const SHEET_ID    = ''; // https://docs.google.com/spreadsheets/d/<ВАШ_ID>/edi
const TELEGRAM_API = 'https://api.telegram.org/bot' + BOT_TOKEN; // Не трогать

// Установка вебхука
function setWebhook() {
  const webAppUrl = '<Вставьте вашу развёртку приложения.>';
  UrlFetchApp.fetch(TELEGRAM_API + '/setWebhook?url=' + encodeURIComponent(webAppUrl));
  Logger.log('Webhook установлен: ' + webAppUrl);
}

// Обработчик входящих апдейтов
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  if (data.message) {
    // Игнорируем все, что приходит не от человека (на самом деле, это проверка необязательна, так как Вы можете просто запретить добавлять бота в группы)
    if (data.message.from.is_bot) return;
    handleMessage(data.message);
  }
}

// Обработка сообщений
function handleMessage(msg) {
  // Игнорируем группы, каналы и супергруппы — работаем только в личных чатах (на самом деле, это проверка необязательна, так как Вы можете просто запретить добавлять бота в группы)
  if (msg.chat.type !== 'private') return;

  const chatId  = String(msg.chat.id);
  const fromId  = String(msg.from.id);
  const text    = msg.text || '';
  const isAdmin = (fromId === ADMIN_ID);
  const sheet   = SpreadsheetApp.openById(SHEET_ID).getActiveSheet();

  // Если админ (Вы) отвечает reply'ем на сообщение бота
  if (isAdmin && msg.reply_to_message) {
  const orig = msg.reply_to_message.text || '';
  let userId = orig.split('ID: ')[1]?.split('\n')[0];
  
  // Если не нашли ID в обычном формате, пробуем найти в INITIALIZE (INITIALIZE - когда пользователь пишет /start в боте)
  if (!userId && orig.includes('INITIALIZE BY')) {
    userId = orig.split('BY ')[1]?.split(' with')[0];
  }

  if (userId) {
    sendMessage(userId, '💬 Ответ владельца:\n\n' + text);
    sheet.appendRow([new Date(), userId, 'ADMIN_REPLY', text]);
    sendMessage(ADMIN_ID, '✅')
  } else {
    sendMessage(ADMIN_ID, '⚠️ Не удалось извлечь ID пользователя');
    Logger.log('Оригинальное сообщение: ' + orig);
  }
  return;
}

// ОБРАБОТКА СТАРТА
if (!isAdmin && msg.text && msg.text.trim() === '/start') {
  // Форматируем сообщение для админа с ID в удобном для извлечения формате
  const adminMsg = 
    `🎱 INITIALIZE!\n` +
    `От: ${msg.from.first_name} (ID: ${chatId})\n\n` +
    `Пользователь начал диалог`;
  
  sheet.appendRow([new Date(), chatId, 'INITIALIZE', text]);
  sendMessage(ADMIN_ID, adminMsg);
  sendMessage(chatId, '👋 Привет, это бот для связи с Владельцем, просто напиши своё сообщение ниже (без всяких команд) и оно отправится. Вы получите обратный ответ тогда, когда Вам ответит Владелец.');
} 
  
// Обработка обычных сообщений
else if (!isAdmin) {
  sheet.appendRow([new Date(), chatId, 'USER_MSG', text]);
  const adminMsg = 
    `✉️ Новое сообщение!\n` +
    `От: ${msg.from.first_name} (ID: ${chatId})\n\n` +
    text;
  sendMessage(ADMIN_ID, adminMsg);
  sendMessage(chatId, '✅ Ваше сообщение отправлено Владельцу!');
}

// Утилита для отправки сообщений
function sendMessage(chatId, text) {
  if (!text || !text.trim()) return;
  const payload = {
    method: 'post',
    payload: {
      chat_id: chatId,
      text:    text,
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

// Удаление вебхука (если понадобится)
function deleteWebhook() {
  const resp = UrlFetchApp.fetch(TELEGRAM_API + '/deleteWebhook');
  Logger.log('Webhook удалён: ' + resp.getContentText());
}
}
