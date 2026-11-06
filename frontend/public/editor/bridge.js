/**
 * bridge.js — адаптер между редактором v2 и API Почтелья v3.
 *
 * Редактор v2 написан под Flask-эндпоинты (/api/templates/list, /api/config, ...).
 * Вместо переписывания его кода мы перехватываем fetch и переводим вызовы:
 *   - шаблоны            → REST API v3 (/api/templates), envelope {data, error, meta};
 *   - конфиг и профиль   → /api/editor/*;
 *   - отправка, учётные данные, массовая рассылка, ресурсы пользователя
 *                         → «недоступно», пока не будут перенесены в v3;
 *   - heartbeat, jslog, mode → локальные заглушки без сети.
 *
 * Загружается первым скриптом страницы. По мере переноса блоков на React
 * ненужные ветки удаляются.
 */
(function () {
    'use strict';

    const nativeFetch = window.fetch.bind(window);

    const PREVIEW_VERSION = 2;
    const PAGE_LIMIT = 200;
    const MAX_PAGES = 50;
    const CATEGORIES_KEY = 'pochtelye-extra-categories';
    const UNAVAILABLE = 'Недоступно в этой версии';

    const UNAVAILABLE_PREFIXES = [
        '/api/credentials',
        '/api/send',
        '/api/bulk',
        '/api/recipients',
        '/api/app-settings',
        '/api/user-resources',
        '/api/shared-resources',
        '/api/admin',
        '/api/open-url',
        '/api/open-log',
        '/api/update-',
    ];

    function json(body, status = 200, headers = {}) {
        return new Response(JSON.stringify(body), {
            status,
            headers: { 'Content-Type': 'application/json', ...headers },
        });
    }

    function failure(message, status) {
        return json({ success: false, error: message }, status);
    }

    async function v3(path, init) {
        const response = await nativeFetch(path, {
            ...init,
            headers: { Accept: 'application/json', ...(init && init.headers) },
        });
        let body = null;
        try {
            body = await response.json();
        } catch (_) {
            /* тело не JSON — обработаем как сбой ниже */
        }
        return { response, body };
    }

    function errorMessage(result) {
        return (result.body && result.body.error && result.body.error.message) || 'Ошибка сервера';
    }

    function toLegacy(t) {
        return {
            id: t.id,
            name: t.name,
            category: t.category || '',
            preview: t.preview || null,
            previewVersion: t.preview ? PREVIEW_VERSION : null,
            created: t.createdAt,
            updated: t.updatedAt,
            author: t.ownerSub,
            type: t.scope,
            isPreset: false,
            ...(t.blocks ? { blocks: t.blocks } : {}),
        };
    }

    async function listAll() {
        const items = [];
        for (let page = 1; page <= MAX_PAGES; page += 1) {
            const { response, body } = await v3(`/api/templates?limit=${PAGE_LIMIT}&page=${page}`);
            if (!response.ok || !body || !body.data) throw new Error(errorMessage({ body }));
            items.push(...body.data);
            if (items.length >= (body.meta ? body.meta.total : 0) || body.data.length === 0) break;
        }
        return items;
    }

    function storedCategories() {
        try {
            return JSON.parse(localStorage.getItem(CATEGORIES_KEY) || '[]');
        } catch (_) {
            return [];
        }
    }

    const handlers = {
        'GET /api/templates/list': async () => {
            const all = (await listAll()).map(toLegacy);
            return json({
                success: true,
                templates: {
                    shared: all.filter((t) => t.type === 'shared'),
                    personal: all.filter((t) => t.type === 'personal'),
                },
            });
        },

        'GET /api/templates/load': async (url) => {
            const id = url.searchParams.get('id');
            const result = await v3(`/api/templates/${encodeURIComponent(id)}`);
            if (result.response.status === 404) return failure('Шаблон не найден', 404);
            if (!result.response.ok) return failure(errorMessage(result), result.response.status);
            return json({ success: true, template: toLegacy(result.body.data) });
        },

        'POST /api/templates/save': async (url, data) => {
            const payload = {
                name: (data.name || '').trim(),
                category: data.category || '',
                scope: data.type === 'shared' ? 'shared' : 'personal',
                blocks: data.blocks || [],
                preview: data.preview || null,
            };
            const result = await v3('/api/templates', jsonRequest('POST', payload));
            if (!result.response.ok) return failure(errorMessage(result), result.response.status);
            return json({ success: true, id: result.body.data.id });
        },

        'PUT /api/templates/update': async (url, data) => {
            const changes = { blocks: data.blocks };
            if (data.preview) changes.preview = data.preview;
            return patchTemplate(data.id, changes);
        },

        'PATCH /api/templates/preview': (url, data) => patchTemplate(data.id, { preview: data.preview }),

        'PUT /api/templates/rename': (url, data) => patchTemplate(data.id, { name: (data.newName || '').trim() }),

        'DELETE /api/templates/delete': async (url) => {
            const id = url.searchParams.get('id');
            const result = await v3(`/api/templates/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!result.response.ok) return failure(errorMessage(result), result.response.status);
            return json({ success: true });
        },

        'GET /api/templates/categories': async () => {
            const fromTemplates = (await listAll()).map((t) => t.category).filter(Boolean);
            const categories = Array.from(new Set([...fromTemplates, ...storedCategories()])).sort();
            return json({ success: true, categories });
        },

        'POST /api/templates/categories': async (url, data) => {
            const name = (data.name || '').trim();
            if (!name) return failure('Название категории не указано', 400);
            const categories = Array.from(new Set([...storedCategories(), name])).sort();
            try {
                localStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
            } catch (_) {
                /* хранилище недоступно: категория появится после сохранения шаблона */
            }
            return json({ success: true, categories });
        },

        'GET /api/config': async () => {
            const result = await v3('/api/editor/config');
            if (!result.response.ok) return failure(errorMessage(result), result.response.status);
            return json({ success: true, config: result.body.data });
        },

        'GET /api/profile': async () => {
            const result = await v3('/api/editor/profile');
            if (!result.response.ok) return failure(errorMessage(result), result.response.status);
            return json({ success: true, profile: result.body.data });
        },

        'GET /api/mode': () => json({ success: true, mode: 'user', can_switch: false }),
        'POST /api/mode': () => json({ success: true, mode: 'user' }),
        'POST /api/heartbeat': () => json({ success: true }),
        'POST /api/jslog': () => json({ success: true }),
        // Плашку версии v2 не показываем: номер v2 в v3 вводил бы в заблуждение.
        'GET /api/version': () => failure('Недоступно в этой версии', 404),
    };

    function jsonRequest(method, payload) {
        return {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        };
    }

    async function patchTemplate(id, changes) {
        const result = await v3(`/api/templates/${encodeURIComponent(id)}`, jsonRequest('PATCH', changes));
        if (!result.response.ok) return failure(errorMessage(result), result.response.status);
        return json({ success: true });
    }

    async function readJsonBody(init) {
        if (!init || typeof init.body !== 'string') return {};
        try {
            return JSON.parse(init.body);
        } catch (_) {
            return {};
        }
    }

    window.fetch = async function (input, init) {
        const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const url = new URL(raw, window.location.origin);
        const method = ((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();

        // Файлы данных редактора лежат рядом с ним, а не в корне сайта.
        if (url.pathname.startsWith('/data/')) {
            return nativeFetch(`/editor${url.pathname}${url.search}`, init);
        }

        const handler = handlers[`${method} ${url.pathname}`];
        if (handler) {
            try {
                return await handler(url, await readJsonBody(init));
            } catch (error) {
                console.error('[bridge]', method, url.pathname, error);
                return failure('Ошибка подключения к серверу', 502);
            }
        }

        if (UNAVAILABLE_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
            return failure(UNAVAILABLE, 501);
        }
        return nativeFetch(input, init);
    };
})();
