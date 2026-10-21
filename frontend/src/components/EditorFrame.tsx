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
}

export function EditorFrame({ mode }: EditorFrameProps) {
  const title = mode === 'builder' ? t.editor.builderTitle : t.editor.title;
  return <iframe className="editor-frame" src={EDITOR_URLS[mode]} title={title} />;
}
