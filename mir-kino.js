(function () {
  'use strict';

  if (window.__mirKinoPlugin_loaded) return;
  window.__mirKinoPlugin_loaded = true;

  var STORAGE_PREFIX = 'mirkino';
  var SETTINGS_COMPONENT = STORAGE_PREFIX;
  var PANEL_COMPONENT = STORAGE_PREFIX + 'Panel';
  var HUB_COMPONENT = STORAGE_PREFIX + 'Hub';
  var HUB_PREVIEW_LIMIT = 12;

  var SERVERS = [
    { id: 'ru', label: 'RU вЂ” ru.mir-kino.pp.ru', url: 'https://ru.mir-kino.pp.ru' },
    { id: 'eu', label: 'EU вЂ” eu.mir-kino.pp.ru', url: 'https://eu.mir-kino.pp.ru' },
    { id: 'cf-eu', label: 'CF EU вЂ” cf-eu.mir-kino.pp.ru', url: 'https://cf-eu.mir-kino.pp.ru' },
  ];
  var DEFAULT_SERVER = '';
  var DEFAULT_LOGIN = '';
  var DEFAULT_PASSWORD = '';

  var HTTP_TIMEOUT_MS = 15000;
  var TMDB_TIMEOUT_MS = 10000;
  var TMDB_ENRICH_CONCURRENCY = 8;
  var PAGE_SIZE = 48;
  var IMG_PLACEHOLDER = './img/img_load.svg';
  var API_CACHE_TTL_MS = 30 * 60 * 1000;
  var API_USERDATA_TTL_MS = 3 * 60 * 1000;
  var API_LATEST_TTL_MS = 5 * 60 * 1000;
  var API_VIEWS_TTL_MS = 2 * 60 * 60 * 1000;
  var API_CACHE_MAX_ENTRIES = 72;
  var LIBRARY_INDEX_TTL_MS = 10 * 60 * 1000;
  var VIEWS_CACHE_TTL_MS = API_VIEWS_TTL_MS;
  var TMDB_META_TTL_MS = 24 * 60 * 60 * 1000;
  var TMDB_META_MAX_ENTRIES = 400;

  var RELEASE_FOLDER_RE =
    /(Season\s*\d+)|(S\d{1,2}\s*E\d{0,2}\s*WEB)|WEB-DL|WEBRip|BluRay|2160p|1080p|720p|HDR10|HDR\b|\bDV\b|NOIR\s+VER|COLOR\s+VER|x265|x264/i;

  var MANIFEST = {
    type: 'video',
    version: '1.0.13',
    author: '@pavelpikta',
    name: 'Mir Kino',
    description: 'Browse and play your Mir Kino library in Lampa',
    component: SETTINGS_COMPONENT,
    icon:
      '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16h.01"/><path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M21.946 12.013H2.054"/><path d="M6 16h.01"/></svg>',
  };

  var FULLSTART_BTN_ICON =
    '<svg class="mirkino-fullstart__icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 16h.01"/><path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M21.946 12.013H2.054"/><path d="M6 16h.01"/></svg>';

  var HEAD_ICON_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 16h.01"/><path d="M2.212 11.577a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/><path d="M21.946 12.013H2.054"/><path d="M6 16h.01"/></svg>';

  var cachedUserId = '';
  var cachedAccessToken = '';
  var authInflight = null;
  var libraryIndex = { byTmdb: {}, loadedAt: 0 };
  var viewsCache = { list: [], loadedAt: 0 };
  var tmdbMetaCache = {};
  var tmdbPosterInflight = {};
  var apiResponseCache = {};
  var apiCacheOrder = [];
  var apiInflight = {};
  var apiCacheEpoch = 0;
  var libraryIndexInflight = null;
  var hubDataInflight = null;

  function addLang() {
    Lampa.Lang.add({
      mirkino_title: { en: 'Mir Kino', ru: 'Mir Kino' },
      mirkino_movies: { en: 'Movies', ru: 'Р¤РёР»СЊРјС‹' },
      mirkino_series: { en: 'TV Series', ru: 'РЎРµСЂРёР°Р»С‹' },
      mirkino_resume: { en: 'Continue watching', ru: 'РџСЂРѕРґРѕР»Р¶РёС‚СЊ РїСЂРѕСЃРјРѕС‚СЂ' },
      mirkino_latest: { en: 'Latest added', ru: 'РќРµРґР°РІРЅРѕ РґРѕР±Р°РІР»РµРЅРѕ' },
      mirkino_stat_resume: { en: 'Continue', ru: 'РџСЂРѕРґРѕР»Р¶РёС‚СЊ' },
      mirkino_stat_latest: { en: 'Latest', ru: 'РќРµРґР°РІРЅРёРµ' },
      mirkino_stat_movies: { en: 'Movies', ru: 'Р¤РёР»СЊРјС‹' },
      mirkino_stat_series: { en: 'Series', ru: 'РЎРµСЂРёР°Р»С‹' },
      mirkino_open_folder: { en: 'Open', ru: 'РћС‚РєСЂС‹С‚СЊ' },
      mirkino_play: { en: 'Play', ru: 'РЎРјРѕС‚СЂРµС‚СЊ' },
      mirkino_open_card: { en: 'Open card', ru: 'РћС‚РєСЂС‹С‚СЊ РєР°СЂС‚РѕС‡РєСѓ' },
      mirkino_episodes: { en: 'Episodes', ru: 'Р­РїРёР·РѕРґС‹' },
      mirkino_pick_episode: { en: 'Choose episode', ru: 'Р’С‹Р±РµСЂРёС‚Рµ СЌРїРёР·РѕРґ' },
      mirkino_pick_quality: { en: 'Choose quality', ru: 'Р’С‹Р±РµСЂРёС‚Рµ РєР°С‡РµСЃС‚РІРѕ' },
      mirkino_empty: { en: 'Library is empty', ru: 'Р‘РёР±Р»РёРѕС‚РµРєР° РїСѓСЃС‚Р°' },
      mirkino_empty_descr: {
        en: 'Add media to Mir Kino or check connection settings',
        ru: 'Р”РѕР±Р°РІСЊС‚Рµ РјРµРґРёР° РІ Mir Kino РёР»Рё РїСЂРѕРІРµСЂСЊС‚Рµ РЅР°СЃС‚СЂРѕР№РєРё РїРѕРґРєР»СЋС‡РµРЅРёСЏ',
      },
      mirkino_retry: { en: 'Retry', ru: 'РџРѕРІС‚РѕСЂРёС‚СЊ' },
      mirkino_open_settings: { en: 'Open settings', ru: 'РћС‚РєСЂС‹С‚СЊ РЅР°СЃС‚СЂРѕР№РєРё' },
      mirkino_auth_ok: { en: 'Connection OK', ru: 'РџРѕРґРєР»СЋС‡РµРЅРёРµ СѓСЃРїРµС€РЅРѕ' },
      mirkino_auth_fail: { en: 'Connection failed', ru: 'РќРµ СѓРґР°Р»РѕСЃСЊ РїРѕРґРєР»СЋС‡РёС‚СЊСЃСЏ' },
      mirkino_test: { en: 'Test connection', ru: 'РџСЂРѕРІРµСЂРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ' },
      mirkino_server: { en: 'Server', ru: 'РЎРµСЂРІРµСЂ' },
      mirkino_login: { en: 'Login', ru: 'Р›РѕРіРёРЅ' },
      mirkino_password: { en: 'Password', ru: 'РџР°СЂРѕР»СЊ' },
      mirkino_no_tmdb: {
        en: 'No TMDB id on this item',
        ru: 'РќРµС‚ TMDB id Сѓ СЌС‚РѕРіРѕ СЌР»РµРјРµРЅС‚Р°',
      },
      mirkino_error: { en: 'Something went wrong', ru: 'Р§С‚Рѕ-С‚Рѕ РїРѕС€Р»Рѕ РЅРµ С‚Р°Рє' },
      mirkino_settings_name: { en: 'Mir Kino', ru: 'Mir Kino' },
      mirkino_settings_hint: {
        en: 'Pick a Mir Kino server and sign in with your account',
        ru: 'Р’С‹Р±РµСЂРёС‚Рµ СЃРµСЂРІРµСЂ Mir Kino Рё РІРѕР№РґРёС‚Рµ РїРѕ Р»РѕРіРёРЅСѓ Рё РїР°СЂРѕР»СЋ',
      },
      mirkino_set_dedupe: {
        en: 'Merge duplicates (TMDB)',
        ru: 'РћР±СЉРµРґРёРЅСЏС‚СЊ РґСѓР±Р»РёРєР°С‚С‹ (TMDB)',
      },
      mirkino_set_hide_folders: {
        en: 'Hide release folders',
        ru: 'РЎРєСЂС‹РІР°С‚СЊ РїР°РїРєРё СЂРµР»РёР·РѕРІ',
      },
      mirkino_set_tmdb_posters: {
        en: 'TMDB posters & titles',
        ru: 'РџРѕСЃС‚РµСЂС‹ Рё РЅР°Р·РІР°РЅРёСЏ РёР· TMDB',
      },
      mirkino_set_full_button: {
        en: 'Play button on Lampa card',
        ru: 'РљРЅРѕРїРєР° РІРѕСЃРїСЂРѕРёР·РІРµРґРµРЅРёСЏ РЅР° РєР°СЂС‚РѕС‡РєРµ',
      },
      mirkino_more: { en: 'More', ru: 'Р•С‰С‘' },
      mirkino_libraries: { en: 'Collections', ru: 'Р Р°Р·РґРµР»С‹' },
      mirkino_set_tap_play: {
        en: 'Tap card to play (long = menu)',
        ru: 'РќР°Р¶Р°С‚РёРµ вЂ” СЃРјРѕС‚СЂРµС‚СЊ (РґРѕР»РіРѕРµ вЂ” РјРµРЅСЋ)',
      },
      mirkino_set_stream_hint: {
        en: 'Direct streams only. 4K / 1080p versions come from Jellyfin MediaSources.',
        ru: 'РўРѕР»СЊРєРѕ РїСЂСЏРјРѕР№ РїРѕС‚РѕРє. Р’РµСЂСЃРёРё 4K / 1080p Р±РµСЂСѓС‚СЃСЏ РёР· MediaSources Jellyfin.',
      },
      mirkino_play_4k: { en: 'Play 4K', ru: 'РЎРјРѕС‚СЂРµС‚СЊ 4K' },
      mirkino_play_1080: { en: 'Play 1080p', ru: 'РЎРјРѕС‚СЂРµС‚СЊ 1080p' },
      mirkino_play_from_library: {
        en: 'Play from Mir Kino',
        ru: 'РЎРјРѕС‚СЂРµС‚СЊ РёР· Mir Kino',
      },
      mirkino_watched: { en: 'Watched', ru: 'РџСЂРѕСЃРјРѕС‚СЂРµРЅРѕ' },
      mirkino_mark_watched: { en: 'Mark as watched', ru: 'РћС‚РјРµС‚РёС‚СЊ РїСЂРѕСЃРјРѕС‚СЂРµРЅРЅС‹Рј' },
      mirkino_mark_unwatched: { en: 'Mark as unwatched', ru: 'РЎРЅСЏС‚СЊ РѕС‚РјРµС‚РєСѓ РїСЂРѕСЃРјРѕС‚СЂР°' },
      mirkino_mark_watched_ok: { en: 'Marked as watched', ru: 'РћС‚РјРµС‡РµРЅРѕ РєР°Рє РїСЂРѕСЃРјРѕС‚СЂРµРЅРѕ' },
      mirkino_mark_unwatched_ok: { en: 'Marked as unwatched', ru: 'РћС‚РјРµС‚РєР° РїСЂРѕСЃРјРѕС‚СЂР° СЃРЅСЏС‚Р°' },
      mirkino_season_n: { en: 'Season {0}', ru: 'РЎРµР·РѕРЅ {0}' },
      mirkino_user: { en: 'Signed in as', ru: 'Р’РѕС€Р»Рё РєР°Рє' },
      mirkino_auth_required: {
        en: 'Enter login and password, then test connection',
        ru: 'РЈРєР°Р¶РёС‚Рµ Р»РѕРіРёРЅ Рё РїР°СЂРѕР»СЊ, Р·Р°С‚РµРј РїСЂРѕРІРµСЂСЊС‚Рµ РїРѕРґРєР»СЋС‡РµРЅРёРµ',
      },
    });
  }

  function storageStr(suffix, fallback) {
    try {
      var v =
        String(Lampa.Storage.get(STORAGE_PREFIX + suffix) || '').trim() ||
        String(Lampa.Storage.field(STORAGE_PREFIX + suffix) || '').trim();
      if (v) return v;
    } catch (e) {}
    return fallback == null ? '' : String(fallback);
  }

  function storageToggle(suffix, defaultOn) {
    try {
      var v = Lampa.Storage.field(STORAGE_PREFIX + suffix);
      if (v === true) return true;
      if (v === false) return false;
    } catch (e) {}
    return defaultOn !== false;
  }

  function normalizeBase(raw) {
    var s = String(raw || '').trim().replace(/\/+$/, '');
    if (!s.length) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    return s;
  }

  function serverById(id) {
    var i;
    for (i = 0; i < SERVERS.length; i++) {
      if (SERVERS[i].id === id) return SERVERS[i];
    }
    return SERVERS[0];
  }

  function buildServerValues() {
    var values = {};
    SERVERS.forEach(function (server) {
      values[server.id] = server.label;
    });
    return values;
  }

  function apiBase() {
    return normalizeBase(serverById(storageStr('Server', DEFAULT_SERVER)).url);
  }

  function loginName() {
    return storageStr('Login', DEFAULT_LOGIN);
  }

  function loginPassword() {
    return storageStr('Password', DEFAULT_PASSWORD);
  }

  function accessToken() {
    return cachedAccessToken || storageStr('Token', '');
  }

  function embyAuthHeader() {
    return (
      'MediaBrowser Client="Lampa", Device="Lampa", DeviceId="' +
      getDeviceId() +
      '", Version="' +
      MANIFEST.version +
      '"'
    );
  }

  function apiCacheKey(url) {
    return apiCacheEpoch + '|' + String(url || '');
  }

  function apiCacheTtl(url) {
    var u = String(url || '');
    if (/\/Items\/Resume(?:\?|$)/i.test(u)) return 0;
    if (/MediaSources/i.test(u)) return 0;
    if (/\/PlayedItems\//i.test(u)) return 0;
    if (/\/Items\/Latest/i.test(u)) return API_LATEST_TTL_MS;
    if (/\/Views(?:\?|$)/i.test(u)) return API_VIEWS_TTL_MS;
    if (/UserData/i.test(u)) return API_USERDATA_TTL_MS;
    return API_CACHE_TTL_MS;
  }

  function trimApiCache() {
    while (apiCacheOrder.length > API_CACHE_MAX_ENTRIES) {
      var oldKey = apiCacheOrder.shift();
      delete apiResponseCache[oldKey];
    }
  }

  function readApiCache(url) {
    var ttl = apiCacheTtl(url);
    if (!ttl) return null;
    var key = apiCacheKey(url);
    var entry = apiResponseCache[key];
    if (!entry) return null;
    if (Date.now() - entry.loadedAt > ttl) {
      delete apiResponseCache[key];
      apiCacheOrder = apiCacheOrder.filter(function (k) {
        return k !== key;
      });
      return null;
    }
    return entry.data;
  }

  function writeApiCache(url, data) {
    if (!apiCacheTtl(url)) return;
    var key = apiCacheKey(url);
    if (apiResponseCache[key]) {
      apiCacheOrder = apiCacheOrder.filter(function (k) {
        return k !== key;
      });
    }
    apiResponseCache[key] = { data: data, loadedAt: Date.now() };
    apiCacheOrder.push(key);
    trimApiCache();
  }

  function resetApiCacheStore() {
    apiResponseCache = {};
    apiCacheOrder = [];
    apiInflight = {};
  }

  function clearApiCache() {
    apiCacheEpoch++;
    resetApiCacheStore();
  }

  function invalidateUserDataCaches() {
    apiCacheEpoch++;
    resetApiCacheStore();
    libraryIndex.loadedAt = 0;
    libraryIndexInflight = null;
    hubDataInflight = null;
  }

  function currentTmdbLang() {
    return Lampa.Storage.field('tmdb_lang') || Lampa.Storage.get('language') || 'en';
  }

  function tmdbCacheKey(tmdb) {
    return String(tmdb.method || '') + '/' + String(tmdb.id || '') + '/' + currentTmdbLang();
  }

  function trimTmdbMetaCache() {
    var keys = Object.keys(tmdbMetaCache);
    if (keys.length <= TMDB_META_MAX_ENTRIES) return;
    keys
      .sort(function (a, b) {
        return (tmdbMetaCache[a].loadedAt || 0) - (tmdbMetaCache[b].loadedAt || 0);
      })
      .slice(0, keys.length - TMDB_META_MAX_ENTRIES)
      .forEach(function (key) {
        delete tmdbMetaCache[key];
      });
  }

  function readTmdbMetaCache(tmdb) {
    var key = tmdbCacheKey(tmdb);
    var entry = tmdbMetaCache[key];
    if (!entry) return null;
    if (Date.now() - entry.loadedAt > TMDB_META_TTL_MS) {
      delete tmdbMetaCache[key];
      return null;
    }
    return entry.data;
  }

  function writeTmdbMetaCache(tmdb, meta) {
    if (!meta) return;
    tmdbMetaCache[tmdbCacheKey(tmdb)] = { data: meta, loadedAt: Date.now() };
    trimTmdbMetaCache();
  }

  function clearTmdbMetaCache() {
    tmdbMetaCache = {};
    tmdbPosterInflight = {};
  }

  function invalidateAuth() {
    cachedAccessToken = '';
    cachedUserId = '';
    try {
      Lampa.Storage.set(STORAGE_PREFIX + 'Token', '');
      Lampa.Storage.set(STORAGE_PREFIX + 'UserId', '');
      Lampa.Storage.set(STORAGE_PREFIX + 'UserLabel', '');
    } catch (e) {}
    clearApiCache();
    clearTmdbMetaCache();
    libraryIndex.loadedAt = 0;
    libraryIndexInflight = null;
    hubDataInflight = null;
    viewsCache.list = [];
    viewsCache.loadedAt = 0;
  }

  function authenticate(force) {
    if (!force && accessToken() && storedUserId()) {
      cachedAccessToken = accessToken();
      cachedUserId = storedUserId();
      return Promise.resolve({ token: cachedAccessToken, userId: cachedUserId });
    }
    if (authInflight) return authInflight;

    var base = apiBase();
    var user = loginName();
    var pw = loginPassword();
    if (!base || !user || !pw) {
      return Promise.reject(new Error(Lampa.Lang.translate('mirkino_auth_required')));
    }

    authInflight = new Promise(function (resolve, reject) {
      $.ajax({
        url: base + '/Users/AuthenticateByName',
        type: 'POST',
        timeout: HTTP_TIMEOUT_MS,
        dataType: 'json',
        contentType: 'application/json',
        headers: { 'X-Emby-Authorization': embyAuthHeader() },
        data: JSON.stringify({ Username: user, Pw: pw }),
      })
        .done(function (data) {
          var token = data && data.AccessToken;
          var uid = data && data.User && data.User.Id;
          var label = (data && data.User && data.User.Name) || user;
          if (!token || !uid) {
            reject(new Error('Authentication failed'));
            return;
          }
          cachedAccessToken = token;
          cachedUserId = String(uid);
          Lampa.Storage.set(STORAGE_PREFIX + 'Token', token);
          Lampa.Storage.set(STORAGE_PREFIX + 'UserId', String(uid));
          Lampa.Storage.set(STORAGE_PREFIX + 'UserLabel', label);
          resolve({ token: token, userId: String(uid) });
        })
        .fail(function (err) {
          var msg =
            (err && err.responseJSON && (err.responseJSON.title || err.responseJSON.Message)) ||
            (err && err.statusText) ||
            'Authentication failed';
          reject(new Error(msg));
        })
        .always(function () {
          authInflight = null;
        });
    });
    return authInflight;
  }

  var netInstance = null;
  function network() {
    if (!netInstance && Lampa.Reguest) netInstance = new Lampa.Reguest();
    return netInstance;
  }

  function jfHttp(path, opts) {
    opts = opts || {};
    return authenticate(false).then(function () {
      var base = apiBase();
      var key = accessToken();
      if (!base || !key) {
        return Promise.reject(new Error(Lampa.Lang.translate('mirkino_auth_required')));
      }

      var p = String(path || '');
      var url = base + (p.charAt(0) === '/' ? p : '/' + p);
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      if (url.indexOf('api_key=') < 0) url += sep + 'api_key=' + encodeURIComponent(key);

      var timeout = typeof opts.timeout === 'number' ? opts.timeout : HTTP_TIMEOUT_MS;
      var dataType = opts.dataType || 'json';
      var method = (opts.method || 'GET').toUpperCase();
      var postData = method === 'POST' && opts.jsonBody === undefined ? opts.data : undefined;
      var net = network();
      var useJsonAjax = opts.jsonBody !== undefined || method === 'DELETE';
      var useCache = method === 'GET' && !useJsonAjax && opts.cache !== false;
      var cached = useCache ? readApiCache(url) : null;
      if (cached !== null) return Promise.resolve(cached);
      if (useCache && apiInflight[apiCacheKey(url)]) return apiInflight[apiCacheKey(url)];

      var request = new Promise(function (resolve, reject) {
        function ok(raw) {
          if (dataType === 'json' && typeof raw === 'string' && raw.length) {
            try {
              raw = JSON.parse(raw);
            } catch (ignore) {}
          }
          if (useCache) writeApiCache(url, raw);
          resolve(raw);
        }
        function fail(err) {
          var msg =
            (err && (err.decode_error || err.responseText || err.statusText || err.message)) ||
            (err && err.responseJSON && err.responseJSON.title) ||
            'Request failed';
          reject(new Error(msg));
        }

        if (useJsonAjax) {
          $.ajax({
            url: url,
            type: method,
            timeout: timeout,
            dataType: dataType === 'text' ? 'text' : 'json',
            contentType: opts.jsonBody !== undefined ? 'application/json' : undefined,
            data: opts.jsonBody !== undefined ? JSON.stringify(opts.jsonBody) : undefined,
          })
            .done(ok)
            .fail(fail);
          return;
        }

        if (!net) {
          Lampa.Network.silent(url, ok, fail, postData, { timeout: timeout, dataType: dataType });
          return;
        }

        net.timeout(timeout);
        net.silent(url, ok, fail, postData, { timeout: timeout, dataType: dataType });
      });

      if (useCache) {
        var inflightKey = apiCacheKey(url);
        apiInflight[inflightKey] = request.finally(function () {
          delete apiInflight[inflightKey];
        });
        return apiInflight[inflightKey];
      }

      return request;
    });
  }

  function tmdbJson(url) {
    if (tmdbPosterInflight[url]) return tmdbPosterInflight[url];
    var net = network();
    var inner = new Promise(function (resolve, reject) {
      if (!net) {
        Lampa.Network.silent(url, resolve, reject, null, {
          timeout: TMDB_TIMEOUT_MS,
          dataType: 'json',
        });
        return;
      }
      net.timeout(TMDB_TIMEOUT_MS);
      net.silent(url, resolve, reject, null, { timeout: TMDB_TIMEOUT_MS, dataType: 'json' });
    });
    tmdbPosterInflight[url] = inner.finally(function () {
      delete tmdbPosterInflight[url];
    });
    return tmdbPosterInflight[url];
  }

  function storedUserId() {
    return storageStr('UserId', '');
  }

  function storedUserLabel() {
    return storageStr('UserLabel', '');
  }

  function resolveUserId() {
    var picked = storedUserId();
    if (picked) {
      cachedUserId = picked;
      return Promise.resolve(picked);
    }
    if (cachedUserId) return Promise.resolve(cachedUserId);
    return authenticate(false).then(function (auth) {
      return auth.userId;
    });
  }

  function currentUserLabel() {
    var label = storedUserLabel();
    if (label) return label;
    if (loginName()) return loginName();
    return 'вЂ”';
  }

  function syncUserInfoField() {
    var $descr = $('[data-name="' + STORAGE_PREFIX + 'UserInfo"] .settings-param__descr');
    if ($descr.length) $descr.text(currentUserLabel());
  }

  function onCredentialsChanged() {
    invalidateAuth();
    Lampa.Settings.update();
    syncUserInfoField();
  }

  function emptyFetchResult() {
    return { rows: [], total: 0, next: 0, hasMore: false };
  }

  function categoryKeyForView(view) {
    return 'view:' + String((view && view.id) || '');
  }

  function parseCategory(category) {
    var cat = String(category || '');
    if (cat === 'Resume') return { kind: 'resume' };
    if (cat === 'Latest') return { kind: 'latest' };
    if (cat.indexOf('view:') === 0) return { kind: 'view', id: cat.slice(5) };
    if (cat.indexOf('folder:') === 0) return { kind: 'folder', id: cat.slice(7) };
    if (cat === 'Movie' || cat === 'Series') return { kind: 'legacy', category: cat };
    return { kind: 'unknown' };
  }

  function findViewById(id) {
    var needle = String(id || '');
    var i;
    for (i = 0; i < viewsCache.list.length; i++) {
      if (viewsCache.list[i].id === needle) return viewsCache.list[i];
    }
    return null;
  }

  function viewById(id) {
    var cached = findViewById(id);
    if (cached) return Promise.resolve(cached);
    return fetchLibraryViews(true).then(function (list) {
      return findViewById(id) || null;
    });
  }

  function viewIncludeTypes(view) {
    var ct = view && view.collectionType;
    if (ct === 'tvshows') return 'Movie,Series';
    if (ct === 'playlists') return 'Movie,Series,Playlist';
    if (ct === 'boxsets') return 'Movie,Series,BoxSet';
    return 'Movie,Series,BoxSet';
  }

  function isSeriesCollection(category, viewMeta) {
    if (category === 'Series') return true;
    return !!(viewMeta && viewMeta.collectionType === 'tvshows');
  }

  function viewPosterUrl(item) {
    if (!item || !item.ImageTags || !item.ImageTags.Primary || !item.Id) return '';
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(item.Id) +
      '/Images/Primary?maxHeight=500&tag=' +
      encodeURIComponent(item.ImageTags.Primary) +
      '&api_key=' +
      encodeURIComponent(accessToken())
    );
  }

  function fetchLibraryViews(force) {
    if (!force && viewsCache.loadedAt && Date.now() - viewsCache.loadedAt < VIEWS_CACHE_TTL_MS) {
      return Promise.resolve(viewsCache.list);
    }
    return resolveUserId()
      .then(function (userId) {
        return jfHttp('/Users/' + encodeURIComponent(userId) + '/Views');
      })
      .then(function (data) {
        var seen = {};
        var list = [];
        ((data && data.Items) || []).forEach(function (item) {
          var id = String(item.Id || '');
          if (!id || seen[id]) return;
          seen[id] = true;
          list.push({
            id: id,
            title: item.Name || id,
            collectionType: item.CollectionType || '',
            itemType: item.Type || '',
            childCount: Number(item.ChildCount) || 0,
            poster: viewPosterUrl(item),
            raw: item,
          });
        });
        list.sort(function (a, b) {
          return String(a.title).localeCompare(String(b.title), 'ru', { sensitivity: 'base' });
        });
        viewsCache.list = list;
        viewsCache.loadedAt = Date.now();
        return list;
      });
  }

  function categoryTitle(category) {
    if (category === 'Resume') return Lampa.Lang.translate('mirkino_resume');
    if (category === 'Latest') return Lampa.Lang.translate('mirkino_latest');
    if (category === 'Movie') return Lampa.Lang.translate('mirkino_movies');
    if (category === 'Series') return Lampa.Lang.translate('mirkino_series');
    var parsed = parseCategory(category);
    if (parsed.kind === 'view') {
      var view = findViewById(parsed.id);
      if (view) return view.title;
    }
    return Lampa.Lang.translate('mirkino_title');
  }

  function posterUrl(item) {
    if (!item) return IMG_PLACEHOLDER;
    var tag =
      (item.ImageTags && item.ImageTags.Primary) || item.SeriesPrimaryImageTag || '';
    if (!tag) return IMG_PLACEHOLDER;
    var id = item.Id;
    if (!id && item.SeriesId) id = item.SeriesId;
    if (!id) return IMG_PLACEHOLDER;
    return (
      apiBase() +
      '/Items/' +
      encodeURIComponent(id) +
      '/Images/Primary?maxHeight=500&tag=' +
      encodeURIComponent(tag) +
      '&api_key=' +
      encodeURIComponent(accessToken())
    );
  }

  function buildTmdbImageUrl(path) {
    var posterSize = Lampa.Storage.field('poster_size') || 'w342';
    return Lampa.Api.img(path, posterSize);
  }

  function getDeviceId() {
    var key = STORAGE_PREFIX + 'DeviceId';
    var id = String(Lampa.Storage.get(key, '') || '').trim();
    if (id) return id;
    id = 'lampa-' + (Lampa.Utils && Lampa.Utils.uid ? Lampa.Utils.uid() : String(Date.now()));
    Lampa.Storage.set(key, id);
    return id;
  }

  function screenTv() {
    return (
      Lampa.Platform &&
      typeof Lampa.Platform.screen === 'function' &&
      Lampa.Platform.screen('tv')
    );
  }

  function bindScrollLayerVisible(scroll) {
    scroll.onScroll = function () {
      if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
    };
  }

  function scheduleReflowFocus(scroll, owner, lastEl, opts) {
    opts = opts || {};
    setTimeout(function () {
      try {
        if (opts.layerOnly) {
          if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
          return;
        }
        var act = typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        if (owner && (!act || act.activity !== owner)) return;
        var ctr = Lampa.Controller.enabled();
        var allowed = opts.controller ? [opts.controller] : ['content', 'items_line'];
        if (!ctr || allowed.indexOf(ctr.name) < 0) return;
        Lampa.Controller.collectionSet(scroll.render(true));
        Lampa.Controller.collectionFocus(lastEl || false, scroll.render(true));
        if (lastEl) scroll.update($(lastEl), !!opts.animate);
      } catch (e) {}
    }, 0);
  }

  function mediaSourceId(itemId) {
    return String(itemId || '').replace(/-/g, '');
  }

  function rowStartTicks(row) {
    if (!row || !(row.resumeSec > 0)) return 0;
    return Math.floor(row.resumeSec * 10000000);
  }

  function streamUrl(itemId, opts) {
    opts = opts || {};
    var id = String(itemId || '');
    if (!id) return '';

    var msId = opts.mediaSourceId ? String(opts.mediaSourceId) : id;
    var parts = [
      'DeviceId=' + encodeURIComponent(getDeviceId()),
      'MediaSourceId=' + encodeURIComponent(mediaSourceId(msId)),
      'api_key=' + encodeURIComponent(accessToken()),
      'Static=true',
    ];
    if (opts.userId) parts.push('UserId=' + encodeURIComponent(opts.userId));
    if (opts.startTicks > 0) parts.push('StartTimeTicks=' + encodeURIComponent(String(opts.startTicks)));

    return apiBase() + '/Videos/' + encodeURIComponent(id) + '/stream?' + parts.join('&');
  }

  function playItemFromRow(row, userId, includeMovie, opts) {
    opts = opts || {};
    var variant;
    if (opts.qualityTarget) {
      variant = findVariantForQuality(row, opts.qualityTarget) || resolvePlayVariant(row);
    } else {
      variant = resolvePlayVariant(row);
    }
    var playRow = rowWithVariant(row, variant);
    var streamOpts = {
      userId: userId,
      startTicks: rowStartTicks(playRow),
      mediaSourceId: playRow.mediaSourceId || variant.mediaSourceId,
    };
    var item = {
      title: row.title,
      url: streamUrl(playRow.id, streamOpts),
    };
    if (playRow.resumeSec > 0) {
      item.timeline = includeMovie
        ? { time: playRow.resumeSec, duration: 0, percent: 0 }
        : { time: playRow.resumeSec };
    }
    if (!opts.singleStream) {
      var qualityMap = buildQualityStreamMap(row, userId);
      if (qualityMap) item.quality = qualityMap;
    }
    if (includeMovie) item.movie = playRow.raw;
    return item;
  }

  function playlistFromRows(rows, userId, opts) {
    return rows.map(function (row) {
      return playItemFromRow(row, userId, false, opts);
    });
  }

  function ticksToSeconds(ticks) {
    var n = Number(ticks);
    if (!isFinite(n) || n <= 0) return 0;
    return Math.floor(n / 10000000);
  }

  function tmdbFromItem(item) {
    if (!item || !item.ProviderIds) return null;
    var id = item.ProviderIds.Tmdb || item.ProviderIds.tmdb;
    if (!id) return null;
    var method = item.Type === 'Series' || item.SeriesName ? 'tv' : 'movie';
    if (item.Type === 'Episode' && item.SeriesId) method = 'tv';
    return { method: method, id: String(id) };
  }

  function detectQuality(name) {
    var n = String(name || '');
    if (/2160p|\b4K\b/i.test(n)) return '4K';
    if (/1080p/i.test(n)) return '1080p';
    if (/720p/i.test(n)) return '720p';
    if (/HDR/i.test(n)) return 'HDR';
    return '';
  }

  function videoStreamHeight(source) {
    var streams = (source && source.MediaStreams) || [];
    var h = 0;
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type !== 'Video') continue;
      h = Math.max(h, Number(streams[i].Height) || 0);
    }
    return h;
  }

  function qualityFromHeight(height) {
    var h = Number(height) || 0;
    if (h >= 2160) return '4K';
    if (h >= 1080) return '1080p';
    if (h >= 720) return '720p';
    if (h >= 480) return '480p';
    return '';
  }

  function mediaSourceQuality(source) {
    if (!source) return '';
    var q = detectQuality(source.Name);
    if (q) return q;
    var streams = source.MediaStreams || [];
    var i;
    for (i = 0; i < streams.length; i++) {
      if (streams[i].Type !== 'Video') continue;
      var h = Number(streams[i].Height) || 0;
      q = qualityFromHeight(h);
      if (q) return q;
      var title = String(streams[i].DisplayTitle || '');
      if (/\b4K\b/i.test(title)) return '4K';
    }
    q = qualityFromHeight(videoStreamHeight(source));
    if (q) return q;
    return detectQuality(String(source.Container || ''));
  }

  function qualityLabelFromItem(item) {
    if (!item) return '';
    var sources = item.MediaSources || [];
    if (sources.length > 1) {
      var labels = [];
      sources.forEach(function (source) {
        var q = mediaSourceQuality(source);
        if (q && labels.indexOf(q) < 0) labels.push(q);
      });
      labels.sort(function (a, b) {
        return qualityRank(b) - qualityRank(a);
      });
      if (labels.length) return labels.join(' / ');
    }
    if (sources.length === 1) return mediaSourceQuality(sources[0]) || detectQuality(item.Name);
    return detectQuality(item.Name);
  }

  function fetchItemMediaSources(itemId) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Items/' +
          encodeURIComponent(itemId) +
          '?UserId=' +
          encodeURIComponent(userId) +
          '&Fields=' +
          encodeURIComponent('MediaSources')
      );
    });
  }

  function variantsFromItemDetails(item, row) {
    var sources = (item && item.MediaSources) || [];
    if (!sources.length) return [variantFromRow(row)];
    return sources.map(function (ms) {
      return {
        itemId: item.Id,
        mediaSourceId: ms.Id,
        id: item.Id,
        quality: mediaSourceQuality(ms) || variantQualityKey(row),
        raw: item,
        resumeSec: row.resumeSec,
        playedPct: row.playedPct,
        watched: row.watched,
      };
    });
  }

  function hydrateRowVariantsFromItem(row) {
    var item = row.raw || {};
    var sources = item.MediaSources || [];
    if (sources.length > 1) {
      var variants = variantsFromItemDetails(item, row);
      if (variants.length > 1) {
        row.variants = variants;
        row.variantsResolved = true;
        updateRowQualityLabel(row);
      }
    }
    return row;
  }

  function variantsNeedResolve(row) {
    if (!row || row.variantsResolved) return false;
    var raw = row.raw || {};
    if (Number(raw.MediaSourceCount) > 1) return true;
    if (hasMultipleVariants(row)) {
      return !row.variants.every(function (v) {
        return !!v.mediaSourceId;
      });
    }
    return false;
  }

  function ensurePlaybackVariants(row) {
    if (!row) return Promise.resolve(row);
    normalizeVariants(row);
    if (!variantsNeedResolve(row)) return Promise.resolve(row);

    var itemIds = [];
    if (hasMultipleVariants(row)) {
      row.variants.forEach(function (v) {
        var itemId = v.itemId || v.id;
        if (itemId && itemIds.indexOf(itemId) < 0) itemIds.push(itemId);
      });
    } else {
      itemIds.push(row.id);
    }

    return Promise.all(
      itemIds.map(function (itemId) {
        var base = row;
        if (hasMultipleVariants(row)) {
          row.variants.forEach(function (v) {
            if ((v.itemId || v.id) === itemId) base = rowWithVariant(row, v);
          });
        }
        return fetchItemMediaSources(itemId).then(function (item) {
          return variantsFromItemDetails(item, base);
        });
      })
    )
      .then(function (parts) {
        var merged = [];
        parts.forEach(function (list) {
          list.forEach(function (v) {
            var exists = merged.some(function (m) {
              return m.mediaSourceId === v.mediaSourceId;
            });
            if (!exists) merged.push(v);
          });
        });
        merged.sort(function (a, b) {
          return qualityRank(b.quality) - qualityRank(a.quality);
        });
        if (merged.length) {
          row.variants = merged;
          row.variantsResolved = true;
          updateRowQualityLabel(row);
        }
        return row;
      })
      .catch(function () {
        return row;
      });
  }

  function qualityRank(key) {
    if (key === '4K' || key === '2160p') return 4;
    if (key === '1080p') return 3;
    if (key === '720p') return 2;
    if (key === 'HDR') return 1;
    return 0;
  }

  /** Lampa Player expects keys like 2160p/1080p (see Player.getUrlQuality, Panel.quality). */
  function lampaQualityKey(label) {
    var s = String(label || '').trim();
    if (!s) return '';
    if (s === '4K' || /2160/i.test(s)) return '2160p';
    if (/^\d+p$/i.test(s)) return s.toLowerCase();
    if (s === 'HDR' || /hdr/i.test(s)) return '2160p';
    if (/1080/i.test(s)) return '1080p';
    if (/720/i.test(s)) return '720p';
    if (/480/i.test(s)) return '480p';
    return s;
  }

  function assignStreamQuality(map, label, url) {
    var key = lampaQualityKey(label);
    if (!key) {
      key = String(label || '').trim();
      if (!key) return;
    }
    if (!map[key] || map[key] === url) {
      map[key] = url;
      return;
    }
    var extra = key + '_' + String(label).toLowerCase().replace(/[^a-z0-9]+/g, '');
    map[extra] = url;
  }

  function resolvePlayVariant(row) {
    if (!hasMultipleVariants(row)) return variantFromRow(row);
    if (row.mediaSourceId) {
      var matched = null;
      row.variants.forEach(function (v) {
        if (v.mediaSourceId === row.mediaSourceId) matched = v;
      });
      if (matched) return matched;
    }
    return pickDefaultVariant(row);
  }

  function variantQualityKey(row) {
    return row.quality || detectQuality((row.raw && row.raw.Name) || '') || '';
  }

  function variantFromRow(row) {
    var raw = row.raw || {};
    var sources = raw.MediaSources || [];
    if (sources.length === 1) {
      var ms = sources[0];
      return {
        itemId: row.id,
        mediaSourceId: ms.Id,
        id: row.id,
        quality: mediaSourceQuality(ms) || variantQualityKey(row),
        raw: raw,
        resumeSec: row.resumeSec,
        playedPct: row.playedPct,
        watched: row.watched,
      };
    }
    return {
      itemId: row.id,
      mediaSourceId: row.mediaSourceId || row.id,
      id: row.id,
      quality: variantQualityKey(row),
      raw: raw,
      resumeSec: row.resumeSec,
      playedPct: row.playedPct,
      watched: row.watched,
    };
  }

  function normalizeVariants(row) {
    if (!row.variants) row.variants = [variantFromRow(row)];
    return row;
  }

  function updateRowQualityLabel(row) {
    if (!row.variants || row.variants.length < 2) return row;
    var labels = [];
    row.variants.forEach(function (v) {
      if (v.quality && labels.indexOf(v.quality) < 0) labels.push(v.quality);
    });
    labels.sort(function (a, b) {
      return qualityRank(b) - qualityRank(a);
    });
    if (labels.length) row.quality = labels.join(' / ');
    return row;
  }

  function addVariantToRow(primary, row) {
    normalizeVariants(primary);
    var incoming = variantFromRow(row);
    var exists = primary.variants.some(function (v) {
      return (
        (incoming.mediaSourceId && v.mediaSourceId === incoming.mediaSourceId) ||
        ((v.itemId || v.id) === (incoming.itemId || incoming.id) && v.quality === incoming.quality)
      );
    });
    if (!exists) primary.variants.push(incoming);
    primary.variants.sort(function (a, b) {
      return qualityRank(b.quality) - qualityRank(a.quality);
    });
    return updateRowQualityLabel(primary);
  }

  function mergeTmdbRows(current, incoming) {
    if (!current) return updateRowQualityLabel(normalizeVariants(incoming));
    normalizeVariants(current);
    normalizeVariants(incoming);
    if (itemScore(incoming.raw) > itemScore(current.raw)) {
      var kept = current.variants.slice();
      incoming = normalizeVariants(incoming);
      kept.forEach(function (v) {
        if (v.id !== incoming.id) {
          addVariantToRow(incoming, {
            id: v.id,
            raw: v.raw,
            quality: v.quality,
            resumeSec: v.resumeSec,
            playedPct: v.playedPct,
            watched: v.watched,
          });
        }
      });
      addVariantToRow(incoming, current);
      return incoming;
    }
    addVariantToRow(current, incoming);
    return current;
  }

  function hasMultipleVariants(row) {
    return !!(row && row.variants && row.variants.length > 1);
  }

  function rowWithVariant(row, variant) {
    if (!variant) return row;
    return Object.assign({}, row, {
      id: variant.itemId || variant.id,
      mediaSourceId: variant.mediaSourceId || variant.id,
      raw: variant.raw,
      quality: variant.quality,
      resumeSec: variant.resumeSec,
      playedPct: variant.playedPct,
      watched: variant.watched,
      variants: row.variants,
      variantsResolved: row.variantsResolved,
    });
  }

  function defaultStreamQualityKey() {
    try {
      var def = parseInt(
        Lampa.Storage.field('video_quality_default') ||
          Lampa.Storage.get('video_quality_default', '1080'),
        10
      );
      if (def >= 2160) return '2160p';
      if (def >= 1080) return '1080p';
      if (def >= 720) return '720p';
      return '480p';
    } catch (e) {
      return '1080p';
    }
  }

  function findVariantForQuality(row, target) {
    if (!row || !target) return null;
    normalizeVariants(row);
    var want = lampaQualityKey(target) || String(target);
    var found = null;
    row.variants.forEach(function (v) {
      if (lampaQualityKey(v.quality) === want) found = v;
    });
    return found;
  }

  function activePlayerId() {
    try {
      return String(Lampa.Storage.field('player') || Lampa.Storage.get('player', 'inner') || 'inner')
        .trim()
        .toLowerCase();
    } catch (e) {
      return 'inner';
    }
  }

  function usesLampaNativePlayer() {
    var player = activePlayerId();
    if (player === 'inner' || player === 'lampa') return true;

    var Platform = Lampa.Platform;
    if (!Platform || typeof Platform.is !== 'function') return player === 'ios';

    if (Platform.is('apple') && player === 'ios') return true;
    if (Platform.is('webos') && player === 'webos') return false;
    if (Platform.is('android') && player === 'android') return false;
    if (typeof Platform.desktop === 'function' && Platform.desktop() && player === 'other') {
      return false;
    }

    var external = {
      vlc: 1,
      nplayer: 1,
      infuse: 1,
      senplayer: 1,
      vidhub: 1,
      svplayer: 1,
      tracyplayer: 1,
      tvospro: 1,
      tvos: 1,
      tvosl: 1,
      tvosselect: 1,
      mpv: 1,
      iina: 1,
    };
    return !external[player];
  }

  function externalPlayerSubtitle() {
    var id = activePlayerId();
    if (!id || id === 'inner' || id === 'lampa') return '';
    return id.charAt(0).toUpperCase() + id.slice(1);
  }

  function qualityMenuLabel(target) {
    if (target === '2160p') return Lampa.Lang.translate('mirkino_play_4k');
    if (target === '1080p') return Lampa.Lang.translate('mirkino_play_1080');
    if (target === '720p') return '720p';
    return String(target || '');
  }

  function collectExternalQualityKeys(row) {
    var seen = {};
    function addKey(label) {
      var key = lampaQualityKey(label);
      if (key === '2160p' || key === '1080p') seen[key] = true;
    }
    normalizeVariants(row);
    (row.variants || []).forEach(function (v) {
      addKey(v.quality);
    });
    var sources = (row.raw && row.raw.MediaSources) || [];
    sources.forEach(function (ms) {
      addKey(mediaSourceQuality(ms));
    });
    var label = String(row.quality || '');
    if (/4K|2160/i.test(label)) seen['2160p'] = true;
    if (/1080/i.test(label)) seen['1080p'] = true;
    return seen;
  }

  function externalQualityTargetsFromSeen(seen) {
    var out = [];
    if (seen['2160p']) out.push('2160p');
    if (seen['1080p']) out.push('1080p');
    return out;
  }

  function guessExternalQualityTargets(row) {
    if (!row || row.type === 'Series') return [];
    return externalQualityTargetsFromSeen(collectExternalQualityKeys(row));
  }

  function needsExternalQualityPrefetch(row) {
    if (!row || row.type === 'Series' || usesLampaNativePlayer()) return false;
    if (guessExternalQualityTargets(row).length >= 2) return false;
    var raw = row.raw || {};
    if (Number(raw.MediaSourceCount) > 1) return true;
    return variantsNeedResolve(row);
  }

  function prepareRowForExternalQuality(row) {
    if (!needsExternalQualityPrefetch(row)) return Promise.resolve(row);
    return ensurePlaybackVariants(row);
  }

  function buildPlayMenuItems(row, isFolder) {
    if (isFolder) {
      return [{ title: Lampa.Lang.translate('mirkino_open_folder'), action: 'play' }];
    }
    if (row.type === 'Series' || usesLampaNativePlayer()) {
      return [{ title: Lampa.Lang.translate('mirkino_play'), action: 'play' }];
    }
    var targets = guessExternalQualityTargets(row);
    var sub = externalPlayerSubtitle();
    if (targets.length >= 2) {
      return targets.map(function (target) {
        return {
          title: qualityMenuLabel(target),
          subtitle: sub,
          action: 'play_quality',
          qualityTarget: target,
        };
      });
    }
    return [{ title: Lampa.Lang.translate('mirkino_play'), action: 'play' }];
  }

  function showExternalQualityPicker(row, allRows) {
    var ctl = enabledControllerName();
    var targets = guessExternalQualityTargets(row);
    if (targets.length < 2) {
      playEpisodeRow(row, allRows);
      return;
    }
    Lampa.Select.show({
      title: Lampa.Lang.translate('mirkino_pick_quality'),
      items: targets.map(function (target) {
        return {
          title: qualityMenuLabel(target),
          subtitle: externalPlayerSubtitle(),
          qualityTarget: target,
        };
      }),
      onBack: function () {
        restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel || !sel.qualityTarget) return;
        launchPlayerFromSelect(ctl, function () {
          var variant = findVariantForQuality(row, sel.qualityTarget);
          if (!variant) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
            return;
          }
          playRow(rowWithVariant(row, variant), allRows, {
            singleStream: true,
            qualityTarget: sel.qualityTarget,
          });
        });
      },
    });
  }

  function playEpisodeRow(row, allRows) {
    ensurePlaybackVariants(row)
      .then(function (ready) {
        if (!usesLampaNativePlayer()) {
          var targets = guessExternalQualityTargets(ready);
          if (targets.length >= 2) {
            showExternalQualityPicker(ready, allRows);
            return;
          }
          var streamOpts = { singleStream: true };
          var variant = null;
          if (targets.length === 1) {
            streamOpts.qualityTarget = targets[0];
            variant = findVariantForQuality(ready, targets[0]);
          }
          if (!variant) variant = resolvePlayVariant(ready);
          playRow(rowWithVariant(ready, variant), allRows, streamOpts);
          return;
        }
        playRow(ready, allRows);
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
      });
  }

  function playMediaRowQuality(row, qualityTarget) {
    ensurePlaybackVariants(row)
      .then(function (ready) {
        if (ready.type === 'Series') {
          playMediaRowDirect(ready);
          return;
        }
        var variant = findVariantForQuality(ready, qualityTarget);
        if (!variant) {
          Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
          return;
        }
        playRow(rowWithVariant(ready, variant), null, {
          singleStream: true,
          qualityTarget: qualityTarget,
        });
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
      });
  }

  function pickDefaultVariant(row) {
    if (!hasMultipleVariants(row)) return variantFromRow(row);
    var pref = defaultStreamQualityKey();
    var picked = null;
    row.variants.forEach(function (v) {
      if (lampaQualityKey(v.quality) === pref) picked = v;
    });
    return picked || row.variants[0];
  }

  function buildQualityStreamMap(row, userId) {
    if (!hasMultipleVariants(row)) return null;
    var map = {};
    row.variants.forEach(function (v) {
      if (!v.quality) return;
      assignStreamQuality(
        map,
        v.quality,
        streamUrl(v.itemId || v.id, {
          userId: userId,
          mediaSourceId: v.mediaSourceId || v.id,
          startTicks: rowStartTicks(v),
        })
      );
    });
    return Object.keys(map).length > 1 ? map : null;
  }

  function pad2(n) {
    n = Number(n) || 0;
    return n < 10 ? '0' + n : String(n);
  }

  function cleanMirkinoName(name) {
    return String(name || '')
      .replace(RELEASE_FOLDER_RE, '')
      .replace(/\(\s*\)|\s{2,}/g, ' ')
      .trim();
  }

  function episodeNumbers(item) {
    item = item || {};
    return {
      season: Number(item.ParentIndexNumber) || 0,
      episode: Number(item.IndexNumber) || 0,
    };
  }

  function episodeCode(item) {
    var n = episodeNumbers(item);
    return 'S' + pad2(n.season) + 'E' + pad2(n.episode);
  }

  function episodeCodeShort(item) {
    var n = episodeNumbers(item);
    return 'S' + n.season + ':E' + n.episode;
  }

  function cleanEpisodeName(name) {
    var n = String(name || '').trim();
    if (!n || /^s\d+\s*e\d+/i.test(n) || RELEASE_FOLDER_RE.test(n)) return '';
    return n;
  }

  function sortEpisodeRows(rows) {
    return rows.slice().sort(function (a, b) {
      var na = episodeNumbers(a.raw);
      var nb = episodeNumbers(b.raw);
      if (na.season !== nb.season) return na.season - nb.season;
      if (na.episode !== nb.episode) return na.episode - nb.episode;
      return String(a.title || '').localeCompare(String(b.title || ''), undefined, {
        sensitivity: 'base',
      });
    });
  }

  function episodeTitle(item, seriesTitle) {
    var series = seriesTitle || cleanMirkinoName(item.SeriesName) || '';
    var epName = String(item.Name || '').trim();
    if (epName && !/^s\d+\s*e\d+/i.test(epName) && !RELEASE_FOLDER_RE.test(epName)) {
      return series ? series + ' вЂ” ' + epName : epName;
    }
    return series ? series + ' вЂ” ' + episodeCode(item) : episodeCode(item);
  }

  function cardTitle(item) {
    if (!item) return '';
    if (item.Type === 'Episode') return episodeTitle(item);
    return cleanMirkinoName(item.Name) || item.Name || '';
  }

  function displayTitleFromMeta(item, meta) {
    if (!meta) return cardTitle(item);
    if (item.Type === 'Episode') return episodeTitle(item, meta.title);
    return meta.title || cardTitle(item);
  }

  function hubCardTitle(row) {
    var title = row.title || '';
    if (Lampa.Utils && typeof Lampa.Utils.shortText === 'function') {
      return Lampa.Utils.shortText(title, 54);
    }
    return title.length > 54 ? title.slice(0, 51) + '...' : title;
  }

  function cardYear(item, meta) {
    if (meta && meta.year) return String(meta.year);
    return item.ProductionYear ? String(item.ProductionYear) : '';
  }

  function itemScore(raw) {
    var s = 0;
    if (raw.ImageTags && raw.ImageTags.Primary) s += 100;
    if (tmdbFromItem(raw)) s += 50;
    var name = String(raw.Name || '');
    if (name.length < 42) s += 10;
    if (!RELEASE_FOLDER_RE.test(name)) s += 30;
    if (raw.UserData && Number(raw.UserData.PlayedPercentage) > 0) s += 5;
    return s;
  }

  function mapRow(item, meta) {
    meta = meta || null;
    var tmdb = tmdbFromItem(item);
    var jellyPoster = posterUrl(item);
    var displayTitle = meta ? displayTitleFromMeta(item, meta) : cardTitle(item);
    return hydrateRowVariantsFromItem({
      id: item.Id,
      raw: item,
      title: displayTitle,
      subtitle: meta && meta.subtitle ? meta.subtitle : '',
      year: cardYear(item, meta),
      poster: jellyPoster,
      displayPoster:
        meta && meta.poster
          ? meta.poster
          : jellyPoster !== IMG_PLACEHOLDER
          ? jellyPoster
          : IMG_PLACEHOLDER,
      type: item.Type || '',
      tmdb: tmdb,
      quality: qualityLabelFromItem(item),
      rating:
        item.CommunityRating && Number(item.CommunityRating) > 0
          ? parseFloat(item.CommunityRating).toFixed(1)
          : '',
      resumeSec: item.UserData ? ticksToSeconds(item.UserData.PlaybackPositionTicks) : 0,
      playedPct: item.UserData ? Number(item.UserData.PlayedPercentage) || 0 : 0,
      watched: !!(item.UserData && item.UserData.Played),
    });
  }

  function fetchTmdbMeta(tmdb) {
    var cached = readTmdbMetaCache(tmdb);
    if (cached) return Promise.resolve(cached);
    var lang = currentTmdbLang();
    var url = Lampa.TMDB.api(
      tmdb.method +
        '/' +
        tmdb.id +
        '?api_key=' +
        Lampa.TMDB.key() +
        '&language=' +
        lang
    );
    return tmdbJson(url)
      .then(function (data) {
        var meta = {
          title:
            data.title ||
            data.name ||
            data.original_title ||
            data.original_name ||
            '',
          year: String(
            (data.release_date || data.first_air_date || '').slice(0, 4) || ''
          ),
          poster: data.poster_path ? buildTmdbImageUrl(data.poster_path) : '',
          subtitle: data.tagline || '',
        };
        writeTmdbMetaCache(tmdb, meta);
        return meta;
      })
      .catch(function () {
        return null;
      });
  }

  function promiseAllChunks(items, size, fn) {
    if (!items.length) return Promise.resolve([]);
    size = Math.max(1, size || 8);
    var chunks = [];
    var i;
    for (i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
    var seq = Promise.resolve([]);
    chunks.forEach(function (chunk) {
      seq = seq.then(function (acc) {
        return Promise.all(chunk.map(fn)).then(function (part) {
          return acc.concat(part);
        });
      });
    });
    return seq;
  }

  function enrichRowsFromTmdb(rows) {
    if (!storageToggle('TmdbPosters', true)) return Promise.resolve(rows);
    return promiseAllChunks(rows, TMDB_ENRICH_CONCURRENCY, function (row) {
      if (!row.tmdb) return Promise.resolve(row);
      var raw = row.raw || {};
      var needsPoster = !row.poster || row.poster === IMG_PLACEHOLDER;
      var needsTitle =
        RELEASE_FOLDER_RE.test(raw.Name || '') ||
        RELEASE_FOLDER_RE.test(raw.SeriesName || '') ||
        raw.Type === 'Episode';
      if (!needsPoster && !needsTitle) return Promise.resolve(row);
      return fetchTmdbMeta(row.tmdb).then(function (meta) {
        if (!meta) return row;
        return Object.assign({}, row, mapRow(row.raw, meta));
      });
    });
  }

  function dedupeRows(rows) {
    var best = {};
    var loose = [];
    rows.forEach(function (row) {
      if (row.tmdb) {
        var key = row.tmdb.method + '/' + row.tmdb.id;
        best[key] = mergeTmdbRows(best[key], row);
      } else {
        loose.push(row);
      }
    });
    var out = Object.keys(best).map(function (k) {
      return best[k];
    });
    var seen = {};
    loose.forEach(function (row) {
      var nk = String(row.title || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
      if (!nk.length || seen[nk]) return;
      seen[nk] = true;
      out.push(row);
    });
    out.sort(function (a, b) {
      return String(a.title).localeCompare(String(b.title), undefined, { sensitivity: 'base' });
    });
    return out;
  }

  function filterRows(rows, category, viewMeta) {
    if (!storageToggle('HideFolders', true)) return rows;
    return rows.filter(function (row) {
      if (row.tmdb) return true;
      if (RELEASE_FOLDER_RE.test(row.raw.Name || row.title || '')) return false;
      if (
        isSeriesCollection(category, viewMeta) &&
        (!row.poster || row.poster === IMG_PLACEHOLDER) &&
        (!row.displayPoster || row.displayPoster === IMG_PLACEHOLDER)
      ) {
        return false;
      }
      return true;
    });
  }

  function dedupeEpisodeRows(rows) {
    var best = {};
    rows.forEach(function (row) {
      var raw = row.raw || {};
      var key =
        String(raw.SeriesId || '') +
        '/' +
        String(raw.ParentIndexNumber || 0) +
        '/' +
        String(raw.IndexNumber || 0);
      best[key] = mergeTmdbRows(best[key], row);
    });
    return sortEpisodeRows(
      Object.keys(best).map(function (k) {
        return best[k];
      })
    );
  }

  function processRows(items, category, viewMeta) {
    var rows = items.map(function (item) {
      return mapRow(item);
    });
    if (category === 'Episode') {
      rows = dedupeEpisodeRows(rows);
      return enrichRowsFromTmdb(rows).then(function (enriched) {
        return dedupeEpisodeRows(enriched);
      });
    }
    if (storageToggle('Dedupe', true)) rows = dedupeRows(rows);
    return enrichRowsFromTmdb(rows).then(function (enriched) {
      return filterRows(enriched, category, viewMeta);
    });
  }

  function listFieldsQuery(startIndex) {
    var fields =
      'ProviderIds,ImageTags,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,UserData,SeriesId,SeriesPrimaryImageTag,CommunityRating,OfficialRating,RunTimeTicks,MediaSourceCount,MediaSources';
    return (
      'StartIndex=' +
      (startIndex || 0) +
      '&Limit=' +
      PAGE_SIZE +
      '&Fields=' +
      encodeURIComponent(fields) +
      '&EnableImageTypes=Primary&SortBy=SortName&SortOrder=Ascending'
    );
  }

  function listPath(category, userId, startIndex, viewMeta) {
    var common = listFieldsQuery(startIndex);
    var parsed = parseCategory(category);

    if (parsed.kind === 'resume') {
      return (
        '/Users/' +
        encodeURIComponent(userId) +
        '/Items/Resume?MediaTypes=Video&' +
        common
      );
    }

    if (parsed.kind === 'folder') {
      return (
        '/Items?UserId=' +
        encodeURIComponent(userId) +
        '&ParentId=' +
        encodeURIComponent(parsed.id) +
        '&Recursive=true&IncludeItemTypes=' +
        encodeURIComponent('Movie,Series,BoxSet,Playlist') +
        '&' +
        common
      );
    }

    if (parsed.kind === 'view' && viewMeta) {
      return (
        '/Items?UserId=' +
        encodeURIComponent(userId) +
        '&ParentId=' +
        encodeURIComponent(viewMeta.id) +
        '&Recursive=true&IncludeItemTypes=' +
        encodeURIComponent(viewIncludeTypes(viewMeta)) +
        '&' +
        common
      );
    }

    var type = category === 'Series' ? 'Series' : 'Movie';
    return (
      '/Items?UserId=' +
      encodeURIComponent(userId) +
      '&Recursive=true&IncludeItemTypes=' +
      type +
      '&' +
      common
    );
  }

  function latestFieldsQuery() {
    return (
      'Limit=' +
      PAGE_SIZE +
      '&Fields=' +
      encodeURIComponent(
        'ProviderIds,ImageTags,ProductionYear,SeriesName,ParentIndexNumber,IndexNumber,UserData,SeriesId,SeriesPrimaryImageTag,CommunityRating,RunTimeTicks,MediaSourceCount,MediaSources'
      ) +
      '&EnableImageTypes=Primary'
    );
  }

  function fetchLatest(userId) {
    return jfHttp(
      '/Users/' +
        encodeURIComponent(userId) +
        '/Items/Latest?' +
        latestFieldsQuery()
    ).then(function (data) {
      var items = Array.isArray(data) ? data : (data && data.Items) || [];
      return processRows(items, 'Latest').then(function (rows) {
        return {
          rows: rows,
          total: rows.length,
          next: items.length,
          hasMore: false,
        };
      });
    });
  }

  function fetchItems(category, startIndex) {
    return resolveUserId().then(function (userId) {
      if (category === 'Latest') return fetchLatest(userId);

      var parsed = parseCategory(category);
      var viewPromise = Promise.resolve(null);
      if (parsed.kind === 'view') viewPromise = viewById(parsed.id);

      return viewPromise.then(function (viewMeta) {
        if (parsed.kind === 'view' && !viewMeta) return emptyFetchResult();

        return jfHttp(listPath(category, userId, startIndex, viewMeta)).then(function (data) {
          var items = (data && data.Items) || [];
          var total =
            data && typeof data.TotalRecordCount === 'number'
              ? data.TotalRecordCount
              : items.length;
          return processRows(items, category, viewMeta).then(function (rows) {
            return {
              rows: rows,
              total: total,
              next: (startIndex || 0) + items.length,
              hasMore: (startIndex || 0) + items.length < total,
            };
          });
        });
      });
    });
  }

  function hubSection(result, category) {
    var rows = (result && result.rows) || [];
    return {
      category: category,
      rows: rows.slice(0, HUB_PREVIEW_LIMIT),
      total: (result && result.total) || rows.length,
      previewPosters: rows
        .slice(0, 3)
        .map(function (row) {
          return row.displayPoster || row.poster;
        })
        .filter(function (url) {
          return url && url !== IMG_PLACEHOLDER;
        }),
    };
  }

  function fetchHubData() {
    if (hubDataInflight) return hubDataInflight;

    hubDataInflight = fetchLibraryViews(false)
      .then(function (views) {
        var jobs = [fetchItems('Resume', 0).catch(function () { return emptyFetchResult(); })];
        views.forEach(function (view) {
          jobs.push(
            fetchItems(categoryKeyForView(view), 0).catch(function () {
              return emptyFetchResult();
            })
          );
        });
        return Promise.all(jobs).then(function (parts) {
          var resume = hubSection(parts[0], 'Resume');
          var sections = views.map(function (view, idx) {
            return Object.assign(hubSection(parts[idx + 1], categoryKeyForView(view)), {
              view: view,
              key: categoryKeyForView(view),
            });
          });
          return {
            resume: resume,
            views: sections,
            viewList: views,
          };
        });
      })
      .finally(function () {
        hubDataInflight = null;
      });

    return hubDataInflight;
  }

  function bindMirkinoCard($card, row, ctx) {
    $card.on('hover:touch', function () {
      if (ctx.onTouch) ctx.onTouch(this, $card, row);
    });
    $card.on('hover:focus', function () {
      if (ctx.onFocus) ctx.onFocus(this, $card, row);
    });
    if (ctx.owner) {
      $card.on('visible', function () {
        try {
          if (Lampa.Controller.own(ctx.owner)) Lampa.Controller.collectionAppend($card);
        } catch (e) {}
      });
    }
    if (ctx.interactive !== false) {
      var tapToPlay = ctx.tapToPlay;
      $card.on('hover:enter', function () {
        if (tapToPlay) playMediaRow(row);
        else showItemMenu(row);
      });
      $card.on('hover:long', function () {
        showItemMenu(row);
      });
    }
    $card.on('jf:update', function (_e, updated) {
      injectCardChrome($card, updated, { hubLine: !!(ctx && ctx.compact) });
      updateCardPoster($card, updated);
      $card.find('.card__title').text(ctx && ctx.compact ? hubCardTitle(updated) : updated.title);
      if (updated.year) $card.find('.card__age').text(updated.year);
      if (ctx && ctx.compact) applyHubCardMeta($card, updated);
    });
  }

  function applyHubCardMeta($card, row) {
    var $view = $card.find('.card__view');
    $view.find('.card__vote').remove();

    if (row.rating && parseFloat(row.rating) > 0) {
      $view.append($('<div class="card__vote"></div>').text(row.rating));
    }

    var isEpisode = row.raw && row.raw.Type === 'Episode';
    var $quality = $view.find('.card__quality');
    if (row.quality && !isEpisode) {
      if (!$quality.length) {
        $quality = $('<div class="card__quality"><div></div></div>');
        $view.append($quality);
      }
      $quality.find('div').text(row.quality);
    } else {
      $quality.remove();
    }
  }

  function makeMirkinoCard(row, ctx) {
    var title = ctx && ctx.compact ? hubCardTitle(row) : row.title;
    var $card = Lampa.Template.get('card', {
      title: title,
      release_year: row.year,
    });
    $card.addClass('card--loaded mirkino-card');
    if (ctx && ctx.compact) $card.addClass('mirkino-card--hub-line');
    updateCardPoster($card, row);
    injectCardChrome($card, row, { hubLine: !!(ctx && ctx.compact) });
    if (ctx && ctx.compact) applyHubCardMeta($card, row);
    bindMirkinoCard($card, row, ctx);
    if (ctx.cardsById) ctx.cardsById[String(row.id)] = { $card: $card, row: row };
    return $card;
  }

  function makeFolderCard(folder, onFocus, opts) {
    opts = opts || {};
    var $card = Lampa.Template.get('mirkino_folder', {});
    $card.find('.bookmarks-folder__title').text(folder.title || '');
    $card.find('.bookmarks-folder__num').text(String(folder.count || 0));

    var posters = (folder.posters || []).slice(0, 3);
    if (!posters.length) posters = [IMG_PLACEHOLDER];

    var $body = $card.find('.bookmarks-folder__body');
    posters.forEach(function (src, idx) {
      var $img = $('<img class="card__img i-' + idx + '">');
      $img.attr('src', src || IMG_PLACEHOLDER);
      $body.append($img);
    });

    $card.addClass('card--loaded');
    $card.on('hover:touch', function () {
      if (opts.onTouch) opts.onTouch(this, $card);
    });
    $card.on('hover:focus', function () {
      if (onFocus) onFocus(this, $card);
      var bg = posters[0];
      if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
    });
    if (!opts.noEnter) {
      $card.on('hover:enter', function () {
        if (folder.category) openCategory(folder.category);
      });
    }
    return $card;
  }

  function hubCategoryFromKey(key) {
    if (key === 'resume') return 'Resume';
    if (String(key).indexOf('view:') === 0) return String(key);
    return '';
  }

  function hubLibraryFolders(data) {
    return (data.viewList || []).map(function (view, idx) {
      var section = (data.views || [])[idx] || {};
      var posters = section.previewPosters || [];
      if (!posters.length && view.poster) posters = [view.poster];
      return {
        title: view.title,
        count: section.total || view.childCount || 0,
        posters: posters,
        category: categoryKeyForView(view),
      };
    });
  }

  function buildHubLines(data) {
    var lines = [];
    var stats = [
      {
        key: 'resume',
        label: Lampa.Lang.translate('mirkino_stat_resume'),
        value: data.resume.total,
      },
    ];
    (data.views || []).forEach(function (section) {
      stats.push({
        key: section.key,
        label: section.view ? section.view.title : section.key,
        value: section.total,
      });
    });
    var folders = hubLibraryFolders(data);

    if (hubHasContent(data)) {
      lines.push({
        title: '',
        nomore: true,
        line_type: 'cards',
        _jf_stats: true,
        results: stats.map(function (stat) {
          return {
            title: stat.label,
            count: stat.value,
            _jf_stat: stat,
          };
        }),
      });
    }

    function pushSection(spec) {
      var results = [];
      (spec.folders || []).forEach(function (folder) {
        results.push({ mirkino_folder: folder });
      });
      spec.rows.forEach(function (row) {
        results.push({
          mirkino_row: row,
          title: hubCardTitle(row),
          release_year: row.year,
        });
      });
      if (!results.length) return;

      lines.push({
        title: spec.title,
        category: spec.category,
        _jf_key: spec.key,
        noimage: true,
        more: spec.total > spec.rows.length,
        nomore: spec.total <= spec.rows.length,
        results: results,
      });
    }

    if (data.resume.rows.length) {
      pushSection({
        key: 'resume',
        title: Lampa.Lang.translate('mirkino_resume'),
        category: 'Resume',
        rows: data.resume.rows,
        total: data.resume.total,
      });
    }

    if (folders.length) {
      pushSection({
        key: 'libraries',
        title: Lampa.Lang.translate('mirkino_libraries'),
        category: '',
        rows: [],
        total: folders.length,
        folders: folders,
      });
    }

    (data.views || []).forEach(function (section) {
      if (!section.rows.length) return;
      pushSection({
        key: section.key,
        title: section.view ? section.view.title : section.key,
        category: section.key,
        rows: section.rows,
        total: section.total,
      });
    });

    return lines;
  }

  function attachHubRowListener(hubCtx) {
    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = hubCtx.cardsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      slot.$card.trigger('jf:update', [e.row]);
    }
    hubCtx.onRowUpdated = onRowUpdated;
    Lampa.Listener.follow('mirkino:row-updated', onRowUpdated);
  }

  function detachHubRowListener(hubCtx) {
    if (hubCtx.onRowUpdated) Lampa.Listener.remove('mirkino:row-updated', hubCtx.onRowUpdated);
  }

  function hubHasContent(data) {
    if (data.resume && data.resume.rows.length) return true;
    if ((data.viewList || []).length) return true;
    return (data.views || []).some(function (section) {
      return section.rows.length;
    });
  }

  function HubFallbackComponent(object, hubCtx) {
    var self = this;
    var scroll = new Lampa.Scroll({ mask: true, over: true, scroll_by_item: true, end_ratio: 1.5 });
    var html = $('<div class="mirkino-hub"></div>');
    var lines = [];
    var active = 0;

    this.create = function () {
      self.activity.loader(true);
      html.append(scroll.render());

      bindScrollLayerVisible(scroll);

      scroll.onWheel = function (step) {
        if (!Lampa.Controller.own(self)) self.start();
        if (step > 0) self.down();
        else if (active > 0) self.up();
      };

      fetchHubData()
        .then(function (data) {
          if (!hubHasContent(data)) {
            scroll.append(
              $('<div class="mirkino-state mirkino-hub-empty"><div class="mirkino-state__title">' +
                Lampa.Lang.translate('mirkino_empty') +
                '</div></div>')
            );
            return;
          }
          buildHubLines(data).forEach(function (lineData) {
            if (!lineData.results || !lineData.results.length) return;
            var line = new HubLineFallback(lineData, hubCtx);
            line.create();
            line.onDown = self.down.bind(self);
            line.onUp = self.up.bind(self);
            line.onBack = self.back.bind(self);
            line.onToggle = function () {
              scroll.update(line.render());
            };
            scroll.append(line.render());
            lines.push(line);
          });
          scroll.minus();
          if (lines.length) scroll.update(lines[0].render());
          if (Lampa.Layer && Lampa.Layer.visible) Lampa.Layer.visible(scroll.render(true));
          if (lines.length && screenTv()) {
            try {
              var act = Lampa.Activity.active();
              if (act && act.activity === self.activity) lines[active].toggle();
            } catch (e) {}
          }
        })
        .catch(function () {
          scroll.append(
            $('<div class="mirkino-state"><div class="mirkino-state__title">' +
              Lampa.Lang.translate('mirkino_error') +
              '</div></div>')
          );
        })
        .then(function () {
          self.activity.loader(false);
          self.activity.toggle();
        });

      return html;
    };

    this.down = function () {
      if (!lines.length) return;
      active = Math.min(active + 1, lines.length - 1);
      scroll.update(lines[active].render());
      lines[active].toggle();
    };

    this.up = function () {
      if (!lines.length) return;
      active--;
      if (active < 0) {
        active = 0;
        Lampa.Controller.toggle('head');
      } else {
        lines[active].toggle();
        scroll.update(lines[active].render());
      }
    };

    this.start = function () {
      self.background();
      if (Lampa.Activity.active().activity !== self.activity) return;
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          if (!lines.length) return;
          scroll.restorePosition();
          if (screenTv()) lines[active].toggle();
          else if (lines[active]) scroll.update(lines[active].render());
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else if (active > 0) self.up();
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (Navigator.canmove('down')) Navigator.move('down');
          else self.down();
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      Lampa.Background.immediately('');
    };
    this.pause = function () {};
    this.stop = function () {};
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      detachHubRowListener(hubCtx);
      hubCtx.cardsById = {};
      lines.forEach(function (line) {
        line.destroy();
      });
      lines = [];
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function HubComponent(object) {
    var hubCtx = {
      tapToPlay: storageToggle('TapPlay', false),
      cardsById: {},
    };

    attachHubRowListener(hubCtx);
    return new HubFallbackComponent(object, hubCtx);
  }

  function HubLineFallback(data, hubCtx) {
    var self = this;
    var content = Lampa.Template.get('items_line', { title: data.title || '' });
    var body = content.find('.items-line__body');
    var scroll = new Lampa.Scroll({ horizontal: true, step: 300 });
    var last = null;

    content.addClass('items-line--type-' + (data._jf_stats ? 'default' : 'cards'));
    if (data._jf_stats) content.addClass('items-line--jf-stats');
    if (!data.title) content.addClass('items-line--jf-no-title');

    function bindLineFocus($el, focusBg) {
      $el.on('hover:touch', function (e) {
        last = e.target;
      });
      $el.on('hover:focus', function (e) {
        last = e.target;
        scroll.update($el, true);
        if (focusBg && focusBg !== IMG_PLACEHOLDER) Lampa.Background.change(focusBg);
      });
      $el.on('visible', function () {
        try {
          if (Lampa.Controller.own(self)) Lampa.Controller.collectionAppend($el);
        } catch (e) {}
      });
    }

    this.create = function () {
      scroll.body().addClass('items-cards mapping--line');
      if (data.title) content.find('.items-line__title').text(data.title);

      bindScrollLayerVisible(scroll);

      scroll.onWheel = function (step) {
        if (!Lampa.Controller.own(self)) self.toggle();
        var ctl = Lampa.Controller.enabled().controller;
        if (ctl) ctl[step > 0 ? 'right' : 'left']();
      };

      (data.results || []).forEach(function (element) {
        var $render = null;

        if (element._jf_stat) {
          var stat = element._jf_stat;
          $render = Lampa.Template.get('register');
          $render.addClass('selector register--line');
          $render.find('.register__name').text(stat.label || '');
          $render.find('.register__counter').text(String(stat.value == null ? 0 : stat.value));
          $render.on('hover:enter', function () {
            var category = hubCategoryFromKey(stat.key);
            if (category) openCategory(category);
          });
          bindLineFocus($render, null);
        } else if (element.mirkino_folder) {
          var folder = element.mirkino_folder;
          $render = makeFolderCard(
            folder,
            function (el, $card) {
              last = el;
              scroll.update($card, true);
            },
            {
              onTouch: function (el) {
                last = el;
              },
            }
          );
        } else if (element.mirkino_row) {
          var row = element.mirkino_row;
          var rowBg = row.displayPoster || row.poster;
          $render = makeMirkinoCard(row, {
            owner: self,
            tapToPlay: hubCtx.tapToPlay,
            cardsById: hubCtx.cardsById,
            compact: true,
            onTouch: function (el) {
              last = el;
            },
            onFocus: function (el, $card) {
              last = el;
              scroll.update($card, true);
              if (rowBg && rowBg !== IMG_PLACEHOLDER) Lampa.Background.change(rowBg);
            },
          });
        }

        if (!$render) return;

        scroll.append($render);
      });

      if (data.category && data.more && !data.nomore) {
        var $more = $('<div class="items-line__more selector"></div>').text(
          Lampa.Lang.translate('mirkino_more')
        );
        $more.on('hover:enter', function () {
          openCategory(data.category);
        });
        $more.on('hover:touch hover:focus', function (e) {
          last = e.target;
        });
        content.find('.items-line__head').append($more);
      }

      body.append(scroll.render());
      setTimeout(function () {
        content.trigger('visible');
        scheduleReflowFocus(scroll, null, last, { layerOnly: true });
      }, 0);
    };

    this.toggle = function () {
      Lampa.Controller.add('items_line', {
        link: self,
        toggle: function () {
          Lampa.Controller.collectionSet(scroll.render(true));
          if (screenTv()) {
            Lampa.Controller.collectionFocus(last || false, scroll.render(true));
          }
          if (self.onToggle) self.onToggle();
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else if (self.onLeft) self.onLeft();
          else Lampa.Controller.toggle('menu');
        },
        down: this.onDown,
        up: this.onUp,
        gone: function () {},
        back: this.onBack,
      });
      Lampa.Controller.toggle('items_line');
    };

    this.render = function () {
      return content;
    };

    this.destroy = function () {
      scroll.destroy();
      content.remove();
    };
  }

  function fetchEpisodes(seriesId) {
    return resolveUserId().then(function (userId) {
      return jfHttp(
        '/Items?UserId=' +
          encodeURIComponent(userId) +
          '&ParentId=' +
          encodeURIComponent(seriesId) +
          '&IncludeItemTypes=Episode&Recursive=true&Fields=' +
          encodeURIComponent(
            'ProviderIds,ImageTags,IndexNumber,ParentIndexNumber,UserData,SeriesName,SeriesPrimaryImageTag,Name,MediaSourceCount,MediaSources'
          ) +
          '&SortBy=ParentIndexNumber&SortBy=IndexNumber&SortOrder=Ascending'
      ).then(function (data) {
        return processRows((data && data.Items) || [], 'Episode');
      });
    });
  }

  function refreshLibraryIndex(force) {
    if (!force && libraryIndex.loadedAt && Date.now() - libraryIndex.loadedAt < LIBRARY_INDEX_TTL_MS) {
      return Promise.resolve(libraryIndex.byTmdb);
    }
    if (libraryIndexInflight) return libraryIndexInflight;

    libraryIndexInflight = fetchLibraryViews(force)
      .then(function (views) {
        var byTmdb = {};
        var seq = Promise.resolve();
        views.forEach(function (view) {
          seq = seq.then(function () {
            return fetchItems(categoryKeyForView(view), 0)
              .then(function (result) {
                (result.rows || []).forEach(function (row) {
                  if (!row.tmdb) return;
                  var key = row.tmdb.method + '/' + row.tmdb.id;
                  byTmdb[key] = mergeTmdbRows(byTmdb[key], row);
                });
              })
              .catch(function () {});
          });
        });
        return seq.then(function () {
          libraryIndex.byTmdb = byTmdb;
          libraryIndex.loadedAt = Date.now();
          return byTmdb;
        });
      })
      .catch(function () {
        return libraryIndex.byTmdb;
      })
      .finally(function () {
        libraryIndexInflight = null;
      });

    return libraryIndexInflight;
  }

  function findLibraryRow(method, id) {
    var key = String(method || '') + '/' + String(id || '');
    return libraryIndex.byTmdb[key] || null;
  }

  function enabledControllerName(fallback) {
    fallback = fallback || 'content';
    try {
      var cur = Lampa.Controller.enabled();
      return (cur && cur.name) || fallback;
    } catch (e) {
      return fallback;
    }
  }

  function restoreControllerNow(name) {
    try {
      if (name) Lampa.Controller.toggle(name);
    } catch (e) {}
  }

  function restoreController(name) {
    setTimeout(function () {
      restoreControllerNow(name);
    }, 10);
  }

  function launchPlayerFromSelect(ctl, launch) {
    restoreControllerNow(ctl);
    launch();
  }

  function pushCard(tmdb) {
    Lampa.Activity.push({
      url: '',
      component: 'full',
      id: tmdb.id,
      method: tmdb.method,
      source: Lampa.Storage.get('source') || 'tmdb',
    });
  }

  function playRow(row, allRows, opts) {
    opts = opts || {};
    var rows = allRows && allRows.length ? allRows : [row];
    var streamOpts = {
      singleStream: !!opts.singleStream || !usesLampaNativePlayer(),
      qualityTarget: opts.qualityTarget || '',
    };
    var readyPromise =
      row && row.variantsResolved ? Promise.resolve(row) : ensurePlaybackVariants(row);

    readyPromise
      .then(function (ready) {
        return resolveUserId().then(function (userId) {
          var playItem = playItemFromRow(ready, userId, true, streamOpts);
          playItem.playlist = playlistFromRows(rows, userId, streamOpts);
          Lampa.Player.play(playItem);
        });
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
      });
  }

  function episodePickerItem(row) {
    var raw = row.raw || {};
    var code = episodeCodeShort(raw);
    var name = cleanEpisodeName(raw.Name);
    var subtitle = name || '';
    if (row.playedPct >= 100) {
      subtitle = subtitle
        ? subtitle + ' В· ' + Lampa.Lang.translate('mirkino_watched')
        : Lampa.Lang.translate('mirkino_watched');
    } else if (row.playedPct > 0) {
      subtitle = subtitle
        ? subtitle + ' В· ' + Math.round(row.playedPct) + '%'
        : Math.round(row.playedPct) + '%';
    }
    return { title: code, subtitle: subtitle, row: row };
  }

  function applyWatchedState(row, watched) {
    row.watched = watched;
    row.playedPct = watched ? 100 : 0;
    row.resumeSec = 0;
    if (!row.raw.UserData) row.raw.UserData = {};
    row.raw.UserData.Played = watched;
    row.raw.UserData.PlayedPercentage = watched ? 100 : 0;
    row.raw.UserData.PlaybackPositionTicks = 0;
    return row;
  }

  function setItemWatched(row, watched) {
    return resolveUserId().then(function (userId) {
      var path =
        '/Users/' +
        encodeURIComponent(userId) +
        '/PlayedItems/' +
        encodeURIComponent(row.id);
      var req = watched
        ? jfHttp(path, { method: 'POST', jsonBody: {} })
        : jfHttp(path, { method: 'DELETE', dataType: 'text' });
      return req.then(function (result) {
        invalidateUserDataCaches();
        return result;
      });
    });
  }

  function notifyRowWatchedChange(row, watched) {
    applyWatchedState(row, watched);
    Lampa.Bell.push({
      text: Lampa.Lang.translate(
        watched ? 'mirkino_mark_watched_ok' : 'mirkino_mark_unwatched_ok'
      ),
    });
    try {
      Lampa.Listener.send('mirkino:row-updated', { row: row });
    } catch (e) {}
  }

  function showEpisodePicker(rows, onBack) {
    var ctl = enabledControllerName();
    Lampa.Select.show({
      title: Lampa.Lang.translate('mirkino_pick_episode'),
      items: rows.map(episodePickerItem),
      onBack: function () {
        if (typeof onBack === 'function') onBack();
        else restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel || !sel.row) return;
        launchPlayerFromSelect(ctl, function () {
          playEpisodeRow(sel.row, rows);
        });
      },
    });
  }

  function playMediaRowDirect(row) {
    if (row.type === 'Playlist' || row.type === 'BoxSet') {
      openFolderRow(row);
      return;
    }
    if (row.type === 'Series') {
      fetchEpisodes(row.id)
        .then(function (eps) {
          if (!eps.length) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_empty') });
            return;
          }
          var resume = eps.find(function (ep) {
            return ep.playedPct > 0 && ep.playedPct < 100;
          });
          if (resume) {
            playRow(resume, eps);
            return;
          }
          if (eps.length === 1) {
            playRow(eps[0], eps);
            return;
          }
          showEpisodePicker(eps);
        })
        .catch(function () {
          Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
        });
      return;
    }
    playRow(row);
  }

  function playMediaRow(row) {
    ensurePlaybackVariants(row)
      .then(playMediaRowDirect)
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
      });
  }

  function openMediaCard(row) {
    var tmdb = row.tmdb;
    if (tmdb) {
      pushCard(tmdb);
      return;
    }
    if (row.type === 'Episode' && row.raw.SeriesId) {
      jfHttp('/Items/' + encodeURIComponent(row.raw.SeriesId))
        .then(function (series) {
          var fromSeries = tmdbFromItem(series);
          if (!fromSeries) {
            Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_no_tmdb') });
            return;
          }
          pushCard(fromSeries);
        })
        .catch(function () {
          Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
        });
      return;
    }
    Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_no_tmdb') });
  }

  function showItemMenu(row) {
    prepareRowForExternalQuality(row)
      .then(function (ready) {
        showItemMenuResolved(ready);
      })
      .catch(function () {
        Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
      });
  }

  function showItemMenuResolved(row) {
    var ctl = enabledControllerName();
    var isFolder = row.type === 'Playlist' || row.type === 'BoxSet';
    var items = buildPlayMenuItems(row, isFolder);

    if (row.tmdb || row.type === 'Episode' || row.type === 'Series') {
      items.push({ title: Lampa.Lang.translate('mirkino_open_card'), action: 'card' });
    }
    if (row.type === 'Series') {
      items.push({ title: Lampa.Lang.translate('mirkino_episodes'), action: 'episodes' });
    }
    if (!isFolder) {
      items.push({
        title: Lampa.Lang.translate(row.watched ? 'mirkino_mark_unwatched' : 'mirkino_mark_watched'),
        action: row.watched ? 'unwatched' : 'watched',
      });
    }

    Lampa.Select.show({
      title: row.title,
      items: items,
      onBack: function () {
        restoreController(ctl);
      },
      onSelect: function (sel) {
        if (!sel) return;
        if (sel.action === 'play') {
          launchPlayerFromSelect(ctl, function () {
            playMediaRow(row);
          });
          return;
        }
        if (sel.action === 'play_quality') {
          launchPlayerFromSelect(ctl, function () {
            playMediaRowQuality(row, sel.qualityTarget);
          });
          return;
        }
        if (sel.action === 'episodes') {
          fetchEpisodes(row.id).then(function (eps) {
            if (!eps.length) {
              Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_empty') });
              restoreController(ctl);
              return;
            }
            showEpisodePicker(eps);
          });
          return;
        }
        restoreController(ctl);
        if (sel.action === 'card') openMediaCard(row);
        else if (sel.action === 'watched' || sel.action === 'unwatched') {
          var markWatched = sel.action === 'watched';
          setItemWatched(row, markWatched)
            .then(function () {
              notifyRowWatchedChange(row, markWatched);
            })
            .catch(function () {
              Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
            });
        }
      },
    });
  }

  function injectCardChrome($card, row, opts) {
    opts = opts || {};
    var $view = $card.find('.card__view');
    if (!$view.length) return;

    $view.find('.mirkino-card-chrome,.mirkino-card-shade').remove();
    $view.append('<div class="mirkino-card-shade" aria-hidden="true"></div>');

    var $chrome = $('<div class="mirkino-card-chrome" aria-hidden="true"></div>');
    if (row.raw && row.raw.Type === 'Episode') {
      $chrome.append(
        '<div class="mirkino-badge mirkino-badge-episode">' +
          episodeCodeShort(row.raw) +
          '</div>'
      );
    }
    if (row.quality && !opts.hubLine) {
      var qualityClass =
        row.raw && row.raw.Type === 'Episode'
          ? 'mirkino-badge-quality mirkino-badge-quality--episode'
          : 'mirkino-badge-quality';
      $chrome.append('<div class="mirkino-badge ' + qualityClass + '">' + row.quality + '</div>');
    } else if (row.quality && opts.hubLine && row.raw && row.raw.Type === 'Episode') {
      $chrome.append(
        '<div class="mirkino-badge mirkino-badge-quality mirkino-badge-quality--episode">' +
          row.quality +
          '</div>'
      );
    }
    if (row.watched || row.playedPct >= 100) {
      $chrome.append('<div class="mirkino-badge mirkino-badge-watched">вњ“</div>');
    }
    if (row.playedPct > 0 && row.playedPct < 100) {
      $chrome.append(
        '<div class="mirkino-card-progress"><span style="width:' +
          Math.min(100, Math.round(row.playedPct)) +
          '%"></span></div>'
      );
    }
    $view.append($chrome);
  }

  function updateCardPoster($card, row) {
    var src = row.displayPoster || row.poster;
    if (src && src !== IMG_PLACEHOLDER) $card.find('.card__img').attr('src', src);
  }

  function PanelComponent(object) {
    var self = this;
    var category = (object && object.category) || 'Movie';
    var panelTitle = (object && object.title) || '';
    var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250, end_ratio: 2 });
    var body = $('<div class="category-full mapping--grid cols--6 mirkino-grid"></div>');
    var html = $('<div class="mirkino-module"></div>');
    var last = null;
    var rows = [];
    var loading = false;
    var hasMore = true;
    var startIndex = 0;
    var tapToPlay = storageToggle('TapPlay', false);
    var cardsById = {};

    function onRowUpdated(e) {
      if (!e || !e.row) return;
      var slot = cardsById[String(e.row.id)];
      if (!slot) return;
      slot.row = e.row;
      slot.$card.trigger('jf:update', [e.row]);
    }

    Lampa.Listener.follow('mirkino:row-updated', onRowUpdated);

    scroll.append(body);
    html.append(scroll.render());

    bindScrollLayerVisible(scroll);

    scroll.onWheel = function (step) {
      if (!Lampa.Controller.own(self)) self.start();
      if (Navigator && Navigator.move) Navigator.move(step > 0 ? 'down' : 'up');
    };

    scroll.onEnd = function () {
      if (loading || !hasMore) return;
      loadMore();
    };

    function headTitle() {
      if (panelTitle) return panelTitle;
      return categoryTitle(category);
    }

    function cardCtx() {
      return {
        owner: self,
        tapToPlay: tapToPlay,
        cardsById: cardsById,
        onTouch: function (el) {
          last = el;
        },
        onFocus: function (el, $card, row) {
          last = el;
          scroll.update($card, false);
          var bg = row.displayPoster || row.poster;
          if (bg && bg !== IMG_PLACEHOLDER) Lampa.Background.change(bg);
        },
      };
    }

    function buildGrid(list, append) {
      if (!append) {
        body.empty();
        cardsById = {};
      }
      body.removeClass('mirkino-catalog--state');

      if (!list.length && !append) {
        renderEmpty();
        return;
      }

      list.forEach(function (row) {
        body.append(makeMirkinoCard(row, cardCtx()));
      });

      scheduleReflowFocus(scroll, self, last, { layerOnly: !!append });
    }

    function renderEmpty(opts) {
      body.empty().addClass('mirkino-catalog--state');
      opts = opts || {};
      var $box = $('<div class="mirkino-state"></div>');
      $box.append(
        '<div class="mirkino-state__title">' +
          $('<div>').text(opts.title || Lampa.Lang.translate('mirkino_empty')).html() +
          '</div>'
      );
      $box.append(
        '<div class="mirkino-state__descr">' +
          $('<div>').text(opts.descr || Lampa.Lang.translate('mirkino_empty_descr')).html() +
          '</div>'
      );
      var $retry = $(
        '<div class="simple-button selector">' + Lampa.Lang.translate('mirkino_retry') + '</div>'
      );
      $retry.on('hover:enter', reload);
      $retry.on('hover:focus', function () {
        last = this;
        scroll.update($retry, true);
      });
      $box.append($retry);
      body.append($box);
      last = $retry[0];
      scheduleReflowFocus(scroll, self, last, { animate: true });
    }

    function reload() {
      Lampa.Activity.replace({
        url: '',
        title: headTitle(),
        component: PANEL_COMPONENT,
        category: category,
        page: 1,
      });
    }

    function loadInitial() {
      loading = true;
      self.activity.loader(true);
      fetchItems(category, 0)
        .then(function (result) {
          rows = result.rows;
          startIndex = result.next;
          hasMore = result.hasMore;
          buildGrid(rows, false);
        })
        .catch(function () {
          renderEmpty({
            title: Lampa.Lang.translate('mirkino_error'),
            descr: Lampa.Lang.translate('mirkino_settings_hint'),
          });
        })
        .then(function () {
          loading = false;
          self.activity.loader(false);
          self.activity.toggle();
        });
    }

    function loadMore() {
      loading = true;
      fetchItems(category, startIndex)
        .then(function (result) {
          rows = rows.concat(result.rows);
          startIndex = result.next;
          hasMore = result.hasMore;
          buildGrid(result.rows, true);
        })
        .catch(function () {})
        .then(function () {
          loading = false;
        });
    }

    this.create = function () {
      scroll.minus();
      loadInitial();
      return html;
    };

    this.start = function () {
      self.background();
      Lampa.Controller.add('content', {
        link: self,
        toggle: function () {
          scroll.restorePosition();
          Lampa.Controller.collectionSet(scroll.render(true));
          if (screenTv()) {
            Lampa.Controller.collectionFocus(last || false, scroll.render(true));
            if (last) scroll.update($(last), false);
          }
        },
        left: function () {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (Navigator.canmove('right')) Navigator.move('right');
        },
        up: function () {
          if (Navigator.canmove('up')) Navigator.move('up');
          else Lampa.Controller.toggle('head');
        },
        down: function () {
          if (Navigator.canmove('down')) Navigator.move('down');
        },
        back: self.back,
      });
      Lampa.Controller.toggle('content');
    };

    this.background = function () {
      Lampa.Background.immediately('');
    };
    this.pause = function () {};
    this.stop = function () {};
    this.render = function () {
      return html;
    };
    this.destroy = function () {
      Lampa.Listener.remove('mirkino:row-updated', onRowUpdated);
      cardsById = {};
      scroll.destroy();
      html.remove();
    };
    this.back = function () {
      Lampa.Activity.backward();
    };
  }

  function openCategory(category) {
    Lampa.Activity.push({
      url: '',
      title: categoryTitle(category),
      component: PANEL_COMPONENT,
      category: category,
      page: 1,
    });
  }

  function openFolderRow(row) {
    if (!row || !row.id) return;
    Lampa.Activity.push({
      url: '',
      title: row.title || '',
      component: PANEL_COMPONENT,
      category: 'folder:' + row.id,
      page: 1,
    });
  }

  function openHub() {
    Lampa.Activity.push({
      url: '',
      title: Lampa.Lang.translate('mirkino_title'),
      component: HUB_COMPONENT,
      page: 1,
    });
  }

  function listenFullCard() {
    Lampa.Listener.follow('full', function (e) {
      if (!storageToggle('FullButton', true)) return;
      if (e.type !== 'complite' || !e.object) return;

      var method = String(e.object.method || '');
      var id = String(e.object.id || '');
      if (!method || !id) return;

      function mountFullCardButton(label, onEnter) {
        var $btn = $(
          '<div class="full-start__button selector button--mirkino" data-subtitle="Mir Kino">' +
            FULLSTART_BTN_ICON +
            '<span></span></div>'
        );
        $btn.find('span').text(label);
        $btn.on('hover:enter', onEnter);
        return $btn;
      }

      function mountButton(row) {
        if (!row || !e.object.activity || typeof e.object.activity.render !== 'function') return;
        var $root = e.object.activity.render();
        if ($root.find('.button--mirkino').length) return;

        var $anchor = $root.find('.view--torrent').first();
        var $buttons = $anchor.length
          ? $anchor
          : $root.find('.full-start-new__buttons');

        function appendBtn($btn) {
          if ($anchor.length) $anchor.after($btn);
          else $buttons.append($btn);
        }

        function renderButtons(ready) {
          if ($root.find('.button--mirkino').length) return;

          if (!usesLampaNativePlayer() && ready.type !== 'Series') {
            var targets = guessExternalQualityTargets(ready);
            if (targets.length >= 2) {
              targets.forEach(function (target) {
                appendBtn(
                  mountFullCardButton(qualityMenuLabel(target), function () {
                    playMediaRowQuality(ready, target);
                  })
                );
              });
              return;
            }
          }

          var label = Lampa.Lang.translate('mirkino_play_from_library');
          if (ready.playedPct > 0 && ready.playedPct < 100) {
            label += ' (' + Math.round(ready.playedPct) + '%)';
          }
          appendBtn(
            mountFullCardButton(label, function () {
              ensurePlaybackVariants(ready)
                .then(playMediaRowDirect)
                .catch(function () {
                  Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_error') });
                });
            })
          );
        }

        prepareRowForExternalQuality(row).then(renderButtons).catch(function () {});
      }

      var cached = findLibraryRow(method, id);
      if (cached) {
        mountButton(cached);
        return;
      }

      refreshLibraryIndex(false).then(function () {
        mountButton(findLibraryRow(method, id));
      });
    });
  }

  function injectHeadIcon() {
    var $icon = Lampa.Head.addIcon(HEAD_ICON_SVG);
    $icon.addClass('mirkino-head-icon selector');
    $icon.on('hover:enter', openHub);
  }

  function registerMenuButtons() {
    Lampa.Menu.addButton(MANIFEST.icon, Lampa.Lang.translate('mirkino_title'), openHub);
  }

  function registerStyles() {
    Lampa.Template.add(
      'mirkino_folder',
      '<div class="bookmarks-folder card selector layer--visible layer--render mirkino-folder">' +
        '<div class="bookmarks-folder__inner card__view">' +
        '<div class="bookmarks-folder__layer">' +
        '<div class="bookmarks-folder__head">' +
        '<div class="bookmarks-folder__title"></div>' +
        '<div class="bookmarks-folder__num"></div>' +
        '</div>' +
        '<div class="bookmarks-folder__body"></div>' +
        '</div></div></div>'
    );

    Lampa.Template.add(
      'mirkino_style',
      '<style>' +
        '.mirkino-hub .items-line--jf-stats{min-height:0!important;padding-bottom:1em}' +
        '.mirkino-hub .items-line--jf-stats .items-line__body{margin-top:0}' +
        '.mirkino-hub .items-line--jf-stats .register__name{max-width:none}' +
        '.mirkino-hub .items-line--jf-no-title .items-line__head{display:none}' +
        '.mirkino-hub-empty{margin-top:2em}' +
        '.mirkino-hub .register--line{flex:0 0 auto;position:relative}' +
        '.mirkino-hub .mirkino-card--hub-line .card__view{margin-bottom:0}' +
        '.mirkino-hub .mirkino-card--hub-line .card__title{' +
        'position:absolute;left:.55em;right:.55em;bottom:1.65em;z-index:3;margin:0;color:#fff;' +
        'font-size:1.05em;max-height:2.4em;-webkit-line-clamp:2;line-clamp:2;' +
        'text-shadow:0 1px 3px rgba(0,0,0,.85)}' +
        '.mirkino-hub .mirkino-card--hub-line .card__age{' +
        'position:absolute;left:.55em;bottom:.45em;z-index:3;margin:0;opacity:.9;font-size:.85em}' +
        '.mirkino-hub .bookmarks-folder{width:11.5em;flex:0 0 auto}' +
        '.mirkino-hub .bookmarks-folder__layer{background-color:#3e3e3e;border-radius:1em}' +
        '.mirkino-hub .bookmarks-folder__body{position:relative;overflow:hidden;border-radius:0 0 1em 1em}' +
        '.mirkino-hub .bookmarks-folder__body .card__img{position:absolute;left:0;width:100%;object-fit:cover;border-radius:.5em}' +
        '.mirkino-hub .bookmarks-folder__body .i-0{height:100%;top:0;z-index:1}' +
        '.mirkino-hub .bookmarks-folder__body .i-1{height:80%;top:20%;z-index:2}' +
        '.mirkino-hub .bookmarks-folder__body .i-2{height:60%;top:40%;z-index:3}' +
        '.mirkino-hub .bookmarks-folder__head{padding:.85em 1em;line-height:1.25}' +
        '.mirkino-hub .bookmarks-folder__title{font-weight:300;font-size:1.1em}' +
        '.mirkino-hub .bookmarks-folder__num{font-weight:700;font-size:1.15em;margin-top:.15em}' +
        '.mirkino-hub .card.mirkino-card .card__title{line-height:1.25;max-height:2.5em;overflow:hidden}' +
        '.mirkino-card.card,.mirkino-module .mirkino-card.card{position:relative}' +
        '.mirkino-card .card__view{overflow:hidden;position:relative;border-radius:.5em}' +
        '.mirkino-card .card__img{border-radius:inherit}' +
        '.mirkino-hub .bookmarks-folder.card{position:relative}' +
        '.mirkino-hub .bookmarks-folder .card__view{overflow:hidden;position:relative;border-radius:1em}' +
        '.mirkino-hub .card.mirkino-card.focus::after,' +
        '.mirkino-module .card.mirkino-card.focus::after,' +
        '.mirkino-hub .items-cards .card.mirkino-card.selector.focus::after,' +
        '.mirkino-module .items-cards .card.mirkino-card.selector.focus::after,' +
        '.mirkino-hub .card.mirkino-card.focus .card__view::after,' +
        '.mirkino-module .card.mirkino-card.focus .card__view::after,' +
        '.mirkino-hub .bookmarks-folder.focus::after,' +
        '.mirkino-hub .bookmarks-folder.focus .card__view::after{' +
        'display:none!important;content:none!important}' +
        '.mirkino-hub .card.mirkino-card.focus .card__view,' +
        '.mirkino-module .card.mirkino-card.focus .card__view{' +
        'box-shadow:0 0 0 .22em #fff;border-radius:.5em}' +
        '.mirkino-hub .register.selector.focus::after{' +
        'content:"";position:absolute;display:block;pointer-events:none;z-index:-1;' +
        'top:-.5em;left:-.5em;right:-.5em;bottom:-.5em;border:.3em solid #fff;border-radius:1.4em;box-shadow:none}' +
        '.mirkino-hub .bookmarks-folder.focus .card__view{' +
        'box-shadow:0 0 0 .22em #fff;border-radius:1em}' +
        '.mirkino-card-shade{pointer-events:none;position:absolute;left:0;right:0;bottom:0;height:42%;z-index:2;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,.55) 100%)}' +
        '.mirkino-card-chrome{pointer-events:none;position:absolute;left:0;top:0;right:0;bottom:0;z-index:4}' +
        '.mirkino-badge{position:absolute;padding:.28em .55em;font-size:.62em;border-radius:.7em;font-weight:800;line-height:1.1;backdrop-filter:blur(8px);box-shadow:0 3px 8px rgba(0,0,0,.25)}' +
        '.mirkino-badge-episode{left:.4em;top:.4em;background:rgba(0,0,0,.72);color:#fff}' +
        '.mirkino-badge-quality{left:.4em;top:.4em;background:rgba(0,122,255,.92);color:#fff}' +
        '.mirkino-badge-quality--episode{top:2.1em}' +
        '.mirkino-badge-watched{right:.4em;top:.4em;background:rgba(52,199,89,.92);color:#fff}' +
        '.mirkino-card-progress{position:absolute;left:0;right:0;bottom:0;height:.28em;background:rgba(255,255,255,.18);z-index:5}' +
        '.mirkino-card-progress>span{display:block;height:100%;background:rgba(0,122,255,.95)}' +
        '.mirkino-state{padding:2em 1.2em;text-align:center;max-width:36em;margin:0 auto}' +
        '.mirkino-state__title{font-size:1.1em;font-weight:700;margin-bottom:.6em}' +
        '.mirkino-state__descr{opacity:.75;margin-bottom:1.2em;line-height:1.45}' +
        '.button--mirkino{display:inline-flex;align-items:center;gap:.35em}' +
        '.button--mirkino .mirkino-fullstart__icon{width:1.75em;height:1.75em;flex-shrink:0}' +
        '.torrent-dso-qbittorrent-icon.mirkino-head-icon,.mirkino-head-icon{display:flex;align-items:center;justify-content:center}' +
        '</style>'
    );
  }

  function addSettings() {
    Lampa.SettingsApi.addComponent({
      component: SETTINGS_COMPONENT,
      name: Lampa.Lang.translate('mirkino_settings_name'),
      icon: MANIFEST.icon,
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { name: STORAGE_PREFIX + 'Hint', type: 'static' },
      field: { name: Lampa.Lang.translate('mirkino_settings_hint') },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: {
        name: STORAGE_PREFIX + 'Server',
        type: 'select',
        values: buildServerValues(),
        default: DEFAULT_SERVER,
      },
      field: { name: Lampa.Lang.translate('mirkino_server') },
      onChange: onCredentialsChanged,
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: {
        name: STORAGE_PREFIX + 'Login',
        type: 'input',
        default: DEFAULT_LOGIN,
        values: '',
      },
      field: { name: Lampa.Lang.translate('mirkino_login') },
      onChange: onCredentialsChanged,
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: {
        name: STORAGE_PREFIX + 'Password',
        type: 'input',
        default: DEFAULT_PASSWORD,
        values: '',
      },
      field: { name: Lampa.Lang.translate('mirkino_password') },
      onChange: onCredentialsChanged,
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { name: STORAGE_PREFIX + 'UserInfo', type: 'static' },
      field: {
        name: Lampa.Lang.translate('mirkino_user'),
        description: currentUserLabel(),
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'button', name: STORAGE_PREFIX + 'Test' },
      field: { name: Lampa.Lang.translate('mirkino_test') },
      onChange: function () {
        authenticate(true)
          .then(function () {
            syncUserInfoField();
            return refreshLibraryIndex(true);
          })
          .then(function () {
            Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_auth_ok') });
          })
          .catch(function () {
            Lampa.Bell.push({ text: Lampa.Lang.translate('mirkino_auth_fail') });
          });
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'Dedupe' },
      field: { name: Lampa.Lang.translate('mirkino_set_dedupe') },
      onChange: function () {
        Lampa.Settings.update();
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'HideFolders' },
      field: { name: Lampa.Lang.translate('mirkino_set_hide_folders') },
      onChange: function () {
        Lampa.Settings.update();
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'TmdbPosters' },
      field: { name: Lampa.Lang.translate('mirkino_set_tmdb_posters') },
      onChange: function () {
        clearTmdbMetaCache();
        Lampa.Settings.update();
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'trigger', default: true, name: STORAGE_PREFIX + 'FullButton' },
      field: { name: Lampa.Lang.translate('mirkino_set_full_button') },
      onChange: function () {
        Lampa.Settings.update();
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { type: 'trigger', default: false, name: STORAGE_PREFIX + 'TapPlay' },
      field: { name: Lampa.Lang.translate('mirkino_set_tap_play') },
      onChange: function () {
        Lampa.Settings.update();
      },
    });

    Lampa.SettingsApi.addParam({
      component: SETTINGS_COMPONENT,
      param: { name: STORAGE_PREFIX + 'StreamHint', type: 'static' },
      field: { name: Lampa.Lang.translate('mirkino_set_stream_hint') },
    });
  }

  function init() {
    if (window.lampa_settings && window.lampa_settings.read_only) return;

    addLang();
    registerStyles();
    $('body').append(Lampa.Template.get('mirkino_style', {}, true));

    Lampa.Component.add(PANEL_COMPONENT, PanelComponent);
    Lampa.Component.add(HUB_COMPONENT, HubComponent);
    Lampa.Manifest.plugins = MANIFEST;
    addSettings();
    registerMenuButtons();
    injectHeadIcon();
    listenFullCard();

    if (loginName() && loginPassword()) {
      authenticate(false)
        .then(function () {
          syncUserInfoField();
          return fetchLibraryViews(false);
        })
        .then(function () {
          return refreshLibraryIndex(false);
        })
        .catch(function () {});
    }
  }

  if (window.appready) init();
  else
    Lampa.Listener.follow('app', function (e) {
      if (e.type === 'ready') init();
    });
})();
