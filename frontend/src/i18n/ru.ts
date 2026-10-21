/** Русские тексты. Ключи ошибок совпадают с кодами бэкенда. Другие языки добавляются рядом. */
export const ru = {
  appName: 'Почтелье',
  home: {
    title: 'Главная',
    greeting: 'Вы вошли как',
    role: 'Роль',
    unnamed: 'Пользователь без имени',
  },
  roles: {
    admin: 'Администратор',
    editor: 'Редактор',
    viewer: 'Наблюдатель',
  },
  errors: {
    auth_missing: 'Нет токена платформы. Откройте приложение из skript.rt.ru.',
    auth_expired: 'Сессия истекла. Перезапустите приложение на платформе.',
    auth_invalid: 'Токен платформы не распознан.',
    network_error: 'Нет связи с сервером.',
    bad_response: 'Сервер вернул неожиданный ответ.',
    unknown: 'Что-то пошло не так.',
  },
} as const;

export type Messages = typeof ru;
export type ErrorCode = keyof Messages['errors'];
