import { t } from '../i18n';

/**
 * Редактор писем v2 во встроенном iframe; блоки переносятся на React по одному.
 * Письма: открыть готовый шаблон, заполнить, сохранить личную копию.
 * Конструктор: создание и правка шаблонов (в v2 это административный режим).
 */
export const EDITOR_URLS = {
  editor: 'editor/index.html',
  builder: 'editor/admin.html',
} as const;

interface EditorFrameProps {
  mode: keyof typeof EDITOR_URLS;
  /** Параметры адреса: template и type открываемого шаблона (их читает bridge.js). */
  params?: string;
}

export function EditorFrame({ mode, params }: EditorFrameProps) {
  const title = mode === 'builder' ? t.editor.builderTitle : t.editor.title;
  // Повторная сборка строки экранирует всё, что пришло из адресной строки.
  const query = mode === 'editor' && params ? `?${new URLSearchParams(params)}` : '';
  return <iframe className="editor-frame" src={`${EDITOR_URLS[mode]}${query}`} title={title} />;
}
