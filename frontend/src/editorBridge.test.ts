import { afterEach, describe, expect, it, vi } from 'vitest';
import source from '../public/editor/bridge.js?raw';

interface EditorGlobals {
  UserAppState?: { currentScreen: string };
  checkAndRestoreDraft?: () => Promise<void>;
  openTemplate?: (id: string, type: string) => Promise<void>;
}

/** Выполняет мост на странице с заглушками редактора v2 и «запускает» редактор. */
async function startEditor(search: string, screenAfterDraft = 'start') {
  const openTemplate = vi.fn().mockResolvedValue(undefined);
  const draft = vi.fn().mockResolvedValue(undefined);
  const globals: EditorGlobals = {
    UserAppState: { currentScreen: screenAfterDraft },
    checkAndRestoreDraft: draft,
    openTemplate,
  };
  const listeners: (() => void)[] = [];
  const page = {
    ...globals,
    fetch: vi.fn(),
    location: { origin: 'http://app', search },
    addEventListener: (_: string, listener: () => void) => listeners.push(listener),
  };
  const document = { addEventListener: page.addEventListener };
  new Function('window', 'document', 'UserAppState', source)(page, document, globals.UserAppState);
  listeners.forEach((listener) => listener());
  await page.checkAndRestoreDraft?.();
  return { openTemplate, draft };
}

afterEach(() => vi.restoreAllMocks());

describe('editor bridge: opening a template from the address', () => {
  it('opens the requested template after the editor has started', async () => {
    const { openTemplate, draft } = await startEditor('?template=abc&type=personal');

    expect(draft).toHaveBeenCalled();
    expect(openTemplate).toHaveBeenCalledWith('abc', 'personal');
  });

  it('treats an unknown type as shared', async () => {
    const { openTemplate } = await startEditor('?template=abc&type=other');

    expect(openTemplate).toHaveBeenCalledWith('abc', 'shared');
  });

  it('does nothing without a template in the address', async () => {
    const { openTemplate } = await startEditor('');

    expect(openTemplate).not.toHaveBeenCalled();
  });

  it('keeps a draft the user chose to restore', async () => {
    const { openTemplate } = await startEditor('?template=abc', 'editor');

    expect(openTemplate).not.toHaveBeenCalled();
  });
});
