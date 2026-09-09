// ==UserScript==
// @name            WME UR Reply Manager
// @name:vi         Trình quản lý phản hồi WME UR
// @version         1.4.1
// @description     Manage and quickly insert UR reply templates in WME
// @description:vi  Quản lý và chèn nhanh các mẫu trả lời UR trong WME
// @author          vdt2210
// @namespace       https://greasyfork.org/en/users/1603731-vdt2210
// @license         MIT
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @grant           none
// ==/UserScript==

(function () {
  'use strict';

  const LOG_PREFIX = '[UR-ReplyManager]';

  // --- Config / Flags ---
  const DEBUG = false;

  const SEGMENT_SEARCH = {
    MAX_DIST_METERS: 10,
    NUMBER_OF_RETRIES: 3,
    RETRY_DELAY_MS: 500,
  };

  // --- I18N Logic ---
  const translations = {
    en: {
      addBtn: 'Add',
      addSuccess: 'Template added successfully!',
      cancelBtn: 'Cancel',
      cancelEdit: 'Discard changes?',
      close: 'Close',
      confirmDelete: 'Are you sure you want to delete this template?',
      confirmResetAllDefaults:
        'Reset all custom tag default values? Built-in script defaults will be used.',
      defaultReporterText: 'reporter',
      defaultsResetSuccess: 'Tag default values have been reset.',
      defaultsSaved: 'Tag default values saved.',
      defaultStreetText: 'street',
      defaultValueLabel: 'Default value',
      templateValidationUnknownTag: 'Unknown tag',
      tagCopiedHint: 'Click to copy',
      copied: 'Copied',
      copyFailed: 'Copy failed',
      existsName: 'This name already exists!',
      exportBtn: 'Export',
      importBtn: 'Import',
      importError: 'Invalid file format!',
      importSuccess: 'Templates imported successfully!',
      importConflictTitle: 'Resolve conflicts',
      insert: 'Insert',
      labelContent: 'Content',
      labelLanguage: 'Language',
      labelName: 'Name',
      listHeading: 'List',
      modalTitle: 'Select reply template',
      noTemplates: 'No templates yet!',
      placeholderContent: 'Enter content...',
      placeholderDefaultValue: 'Enter your default value...',
      placeholderName: 'Enter template name...',
      resetAllBtn: 'Reset All',
      resetBtn: 'Reset',
      saveBtn: 'Save',
      tagCity: 'City name',
      tagLat: 'Latitude',
      tagLon: 'Longitude',
      tagCoords: 'GPS coordinates (latitude, longitude)',
      tagReporter: 'Name of the person who reported this UR',
      tagDescription: 'Report description',
      tagsHeading: 'Available Tags',
      tagsHint:
        "Tags: Prioritizes Actual data ➜ Personal settings ➜ Default. Tip to force custom value: use {tag | 'default'} (e.g., {reporter | 'Reporter'}).",
      tagStreet: 'Street name where the UR was reported',
      triggerBtn: 'Select template',
      updateSuccess: 'Template updated successfully!',
    },
    vi: {
      addBtn: 'Thêm',
      addSuccess: 'Mẫu đã được thêm thành công!',
      cancelBtn: 'Hủy',
      cancelEdit: 'Hủy thay đổi?',
      close: 'Đóng',
      confirmDelete: 'Bạn có chắc muốn xóa mẫu này?',
      confirmResetAllDefaults:
        'Đặt lại tất cả giá trị mặc định thẻ tùy chỉnh? Các giá trị mặc định của script sẽ được dùng.',
      defaultReporterText: 'người báo cáo',
      defaultsResetSuccess: 'Đã đặt lại giá trị mặc định thẻ.',
      defaultsSaved: 'Đã lưu giá trị mặc định thẻ.',
      defaultStreetText: 'đường',
      defaultValueLabel: 'Giá trị mặc định',
      existsName: 'Tên mẫu này đã tồn tại!',
      exportBtn: 'Xuất',
      importBtn: 'Nhập',
      importError: 'Định dạng file không hợp lệ!',
      importSuccess: 'Đã nhập danh sách mẫu thành công!',
      importConflictTitle: 'Giải quyết xung đột',
      insert: 'Chèn',
      labelContent: 'Nội dung',
      labelLanguage: 'Ngôn ngữ',
      labelName: 'Tên mẫu',
      listHeading: 'Danh sách',
      modalTitle: 'Chọn mẫu trả lời',
      noTemplates: 'Chưa có mẫu nào!',
      placeholderContent: 'Nhập nội dung...',
      placeholderDefaultValue: 'Nhập giá trị mặc định của bạn...',
      placeholderName: 'Nhập tên mẫu...',
      resetAllBtn: 'Đặt lại tất cả',
      resetBtn: 'Đặt lại',
      saveBtn: 'Lưu',
      tagCity: 'Tên thành phố',
      tagLat: 'Vĩ độ',
      tagLon: 'Kinh độ',
      tagCoords: 'Tọa độ GPS (vĩ độ, kinh độ)',
      tagReporter: 'Tên người báo cáo UR',
      tagDescription: 'Nội dung báo cáo',
      tagsHeading: 'Các thẻ sẵn có',
      tagsHint:
        "Thẻ: Ưu tiên điền Dữ liệu thực tế ➜ Cấu hình cá nhân ➜ Mặc định. Mẹo ép giá trị riêng: dùng {tag | 'mặc định'} (Ví dụ: {reporter | 'Người báo cáo'}).",
      tagStreet: 'Tên đường được báo cáo',
      triggerBtn: 'Chọn mẫu',
      updateSuccess: 'Mẫu đã được cập nhật thành công!',
      templateValidationUnknownTag: 'Biến không xác định',
      tagCopiedHint: 'Nhấn để copy',
      copied: 'Đã copy',
      copyFailed: 'Copy không thành công',
    },
  };

  // --- Constants ---
  const TagKey = Object.freeze({
    CITY: 'city',
    LAT: 'lat',
    LON: 'lon',
    COORDS: 'coords',
    REPORTER: 'reporter',
    STREET: 'street',
    DESCRIPTION: 'description',
  });

  const TAG_KEYS = Object.values(TagKey);
  const TEMPLATE_TAG_SET = new Set(TAG_KEYS);

  const TAG_LABEL_KEYS = {
    [TagKey.CITY]: 'tagCity',
    [TagKey.LAT]: 'tagLat',
    [TagKey.LON]: 'tagLon',
    [TagKey.COORDS]: 'tagCoords',
    [TagKey.REPORTER]: 'tagReporter',
    [TagKey.STREET]: 'tagStreet',
    [TagKey.DESCRIPTION]: 'tagDescription',
  };

  const NO_DEFAULT_VALUE_TAG_KEYS = [TagKey.COORDS, TagKey.LAT, TagKey.LON, TagKey.DESCRIPTION];

  function debugLog(...args) {
    if (DEBUG) {
      console.debug(...args);
    }
  }

  const defaultValueKeys = {
    city: '',
    reporter: 'defaultReporterText',
    street: 'defaultStreetText',
  };

  const getLocale = () => {
    let locale = 'en';

    try {
      if (typeof I18n !== 'undefined' && I18n.currentLocale()) {
        locale = I18n.currentLocale().split('-')[0];
      }
    } catch (e) {
      console.warn(`${LOG_PREFIX} Locale detection failed, using en`);
    }

    return translations.hasOwnProperty(locale) ? locale : 'en';
  };

  const lang = getLocale();
  const t = (key) => translations[lang]?.[key] || translations.en?.[key] || key;

  /**
   * @typedef {Object} UserConfigs
   * @property {Object.<string, Object.<TagKey, string>>} [userDefaultValuesByLanguage]
   */

  /**
   * @typedef {Object} TemplateItem
   * @property {string} id
   * @property {string} name
   * @property {string} content
   * @property {string} language
   * @property {boolean} [isFavorite]
   * @property {number} createdDate
   * @property {number} updatedDate
   */

  /**
   * @typedef {Object} AppStorageData
   * @property {number} schemaVersion
   * @property {UserConfigs} [configs]
   * @property {TemplateItem[]} [templates]
   */

  // --- Storage ---
  const STORAGE_SCHEMA_VERSION = 2;
  const OLD_STORAGE_KEY = 'wme_ur_reply_templates';
  const STORAGE_KEY = 'wme_ur_reply_manager';

  const createDefaultStorage = () => ({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    configs: {
      userDefaultValuesByLanguage: {},
    },
    templates: [],
  });

  const isPlainObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);

  const normalizeLanguage = (value, fallback = lang) =>
    typeof value === 'string' && translations.hasOwnProperty(value) ? value : fallback;
  const normalizeTemplateName = (value) =>
    typeof value === 'string' ? value.trim().toLocaleLowerCase() : '';

  const normalizeDefaultValues = (value) => {
    if (!isPlainObject(value)) return {};

    return Object.fromEntries(
      TAG_KEYS.filter((key) => typeof value[key] === 'string').map((key) => [
        key,
        value[key].trim(),
      ]),
    );
  };

  const normalizeTemplate = (template, fallbackLanguage = lang) => {
    if (!isPlainObject(template)) return null;

    const id = typeof template.id === 'string' ? template.id.trim() : String(template.id ?? '');
    const name = typeof template.name === 'string' ? template.name.trim() : '';
    const content = typeof template.content === 'string' ? template.content.trim() : '';

    if (!id || !name || !content) return null;

    const createdDate = Number.isFinite(template.createdDate)
      ? template.createdDate
      : Number(id) || 0;
    const updatedDate = Number.isFinite(template.updatedDate) ? template.updatedDate : createdDate;

    return {
      id,
      name,
      content,
      language: normalizeLanguage(template.language, fallbackLanguage),
      isFavorite: template.isFavorite === true,
      createdDate,
      updatedDate,
    };
  };

  /**
   * Converts supported legacy/current data shapes into the latest storage schema.
   * Bare arrays come from the original `wme_ur_reply_templates` storage/export format.
   * Objects without a schema version are the pre-v2 `wme_ur_reply_manager` format.
   *
   * @param {unknown} source
   * @param {string} [fallbackLanguage]
   * @returns {AppStorageData}
   */
  function migrateStorageData(source, fallbackLanguage = lang) {
    const data = Array.isArray(source) ? { templates: source } : source;
    if (!isPlainObject(data)) throw new Error('Storage root must be an object or template array.');
    if (Number.isInteger(data.schemaVersion) && data.schemaVersion > STORAGE_SCHEMA_VERSION) {
      throw new Error(`Unsupported storage schema version: ${data.schemaVersion}.`);
    }

    const normalizedLanguage = normalizeLanguage(fallbackLanguage);
    const configs = isPlainObject(data.configs) ? data.configs : {};
    const { userDefaultValues: legacyDefaults, ...currentConfigs } = configs;
    const defaultsByLanguage = {};

    if (isPlainObject(configs.userDefaultValuesByLanguage)) {
      Object.entries(configs.userDefaultValuesByLanguage).forEach(([language, values]) => {
        if (!translations.hasOwnProperty(language)) return;
        defaultsByLanguage[language] = normalizeDefaultValues(values);
      });
    }

    // Pre-v2 defaults were a flat map and implicitly belonged to the active WME locale.
    if (isPlainObject(legacyDefaults)) {
      defaultsByLanguage[normalizedLanguage] = {
        ...(defaultsByLanguage[normalizedLanguage] || {}),
        ...normalizeDefaultValues(legacyDefaults),
      };
    }

    const templates = Array.isArray(data.templates)
      ? data.templates
          .map((template) => normalizeTemplate(template, normalizedLanguage))
          .filter(Boolean)
      : [];

    return {
      schemaVersion: STORAGE_SCHEMA_VERSION,
      configs: {
        ...currentConfigs,
        userDefaultValuesByLanguage: defaultsByLanguage,
      },
      templates,
    };
  }

  function initializeStorage() {
    const currentRawData = localStorage.getItem(STORAGE_KEY);
    const legacyRawData = localStorage.getItem(OLD_STORAGE_KEY);

    if (!currentRawData && !legacyRawData) {
      setStorageData(createDefaultStorage());
      return;
    }

    let sourceData = null;

    try {
      if (currentRawData) {
        try {
          sourceData = JSON.parse(currentRawData);
        } catch (err) {
          console.warn(
            `${LOG_PREFIX} Current storage payload is invalid; falling back to legacy storage:`,
            err,
          );
        }
      }

      if (!sourceData && legacyRawData) {
        sourceData = JSON.parse(legacyRawData);
      }

      if (!sourceData) {
        setStorageData(createDefaultStorage());
        return;
      }

      const migratedData = migrateStorageData(sourceData);

      setStorageData(migratedData);
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} Storage migration failed; original data was left untouched:`,
        err,
      );
    }
  }

  /**
   * @returns {AppStorageData}
   */
  const getStorageData = () => {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);

      if (!rawData) return createDefaultStorage();

      const data = JSON.parse(rawData);
      return migrateStorageData(data);
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} Storage data is corrupted or invalid, falling back to default structure:`,
        err,
      );
      return createDefaultStorage();
    }
  };

  const setStorageData = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrateStorageData(data)));
  };

  // --- App state ---
  let editingTemplateId = null;
  let templateFormController = null;
  let activeDefaultLanguage = lang;

  // --- Tag default values (storage overrides vs script i18n defaults) ---
  /** @returns {Record<TagKey, string>} */
  const getScriptDefaultValues = (language = lang) =>
    Object.fromEntries(
      TAG_KEYS.map((key) => [
        key,
        defaultValueKeys[key]
          ? translations[normalizeLanguage(language)][defaultValueKeys[key]] || ''
          : '',
      ]),
    );

  /** @returns {Partial<Record<TagKey, string>>} */
  const getStoredUserDefaultValues = (language = lang) => {
    const stored =
      getStorageData()?.configs?.userDefaultValuesByLanguage?.[normalizeLanguage(language)];
    return stored && typeof stored === 'object' ? stored : {};
  };

  /**
   * @returns {Record<TagKey, string>}
   */
  const getUserDefaultValues = (language = lang) => {
    const scriptDefaults = getScriptDefaultValues(language);
    const stored = getStoredUserDefaultValues(language);

    return Object.fromEntries(
      TAG_KEYS.map((key) => [
        key,
        Object.prototype.hasOwnProperty.call(stored, key)
          ? (stored[key] ?? '').trim()
          : scriptDefaults[key],
      ]),
    );
  };

  /**
   * @param {NodeListOf<Element> | Element[]} inputs
   * @returns {Partial<Record<TagKey, string>>}
   */
  const buildStoredValuesFromInputs = (inputs, language = lang) => {
    const scriptDefaults = getScriptDefaultValues(language);
    const valuesToStore = {};

    inputs.forEach((input) => {
      const tagKey = input.dataset.tag;
      const trimmed = input.value.trim();
      input.value = trimmed;
      if (trimmed && trimmed !== scriptDefaults[tagKey]) {
        valuesToStore[tagKey] = trimmed;
      }
    });

    return valuesToStore;
  };

  const saveUserDefaultValues = (values, language = lang) => {
    /** @type {AppStorageData} */
    const existingData = getStorageData();
    existingData.configs.userDefaultValuesByLanguage[normalizeLanguage(language)] = values;
    setStorageData(existingData);
  };

  const hasStoredUserDefaultValues = (language = lang) =>
    Object.keys(getStoredUserDefaultValues(language)).length > 0;

  /** Effective tag defaults shown in sidebar (synced after save / import / reset). */
  let userDefaultValues = getUserDefaultValues();

  // --- Templates ---
  /**
   * @returns {TemplateItem[]}
   */
  const getTemplates = () => {
    const data = getStorageData();
    const templates = data?.templates;

    if (!templates?.length) return [];

    return [...templates].sort((a, b) => {
      if (a.isFavorite === b.isFavorite) {
        return b.createdDate - a.createdDate;
      }
      return a.isFavorite ? -1 : 1;
    });
  };

  const saveTemplates = (arr) => {
    /** @type {AppStorageData} */
    const existingData = getStorageData();
    existingData.templates = arr;
    setStorageData(existingData);
  };

  // --- UR live data & template processing ---
  let cachedURData = Object.fromEntries(TAG_KEYS.map((key) => [key, '']));
  let wmeSDK = null;

  function getCurrentURAttributes() {
    const panelEl = document.querySelector('.problem-edit');
    if (!panelEl) return null;

    const reactKey = Object.keys(panelEl).find(
      (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'),
    );
    const rootFiber = reactKey ? panelEl[reactKey] : null;

    if (!rootFiber) return null;

    const normalizeAttributes = (adapter) =>
      adapter?.problem?.attributes ||
      adapter?.attributes?.attributes ||
      adapter?.attributes ||
      null;

    const extractAdapterFromNode = (node) => {
      if (!node || typeof node !== 'object') return null;
      return (
        node.adapter ||
        node?.props?.adapter ||
        node?.memoizedProps?.adapter ||
        node?.stateNode?.props?.adapter ||
        node?.props?.children?.[0]?.adapter ||
        null
      );
    };

    const queue = [rootFiber];
    const seen = new Set();
    let i = 0;

    while (i < queue.length && i < 80) {
      const current = queue[i++];
      if (!current || typeof current !== 'object' || seen.has(current)) continue;
      seen.add(current);

      const adapter = extractAdapterFromNode(current);
      if (adapter) {
        const attributes = normalizeAttributes(adapter);
        if (attributes) return attributes;
      }

      const children = current.children || current?.memoizedProps?.children;
      if (Array.isArray(children)) {
        children.forEach((child) => {
          if (child) queue.push(child);
        });
      } else if (children) {
        queue.push(children);
      }

      const nextNodes = [
        current.memoizedProps,
        current.stateNode,
        current.return,
        current.sibling,
        current.child,
        current.props,
      ];
      nextNodes.forEach((next) => {
        if (next) queue.push(next);
      });
    }

    return null;
  }

  /**
   * @param {number} lat
   * @param {number} lon
   * @returns {{ pX: number, pY: number } | null}
   */
  function getProjectedPoint(lat, lon) {
    try {
      const lonlat = new OpenLayers.LonLat(lon, lat).transform(
        new OpenLayers.Projection('EPSG:4326'),
        W.map.getProjectionObject(),
      );
      return { pX: lonlat.lon, pY: lonlat.lat };
    } catch (e) {
      return null;
    }
  }

  /**
   * @param {number} pX
   * @param {number} pY
   * @param {{ x: number, y: number }[]} components
   * @returns {number}
   */
  function getDistanceToGeometry(pX, pY, components) {
    let minDist = Infinity;
    for (let i = 0; i < components.length - 1; i++) {
      const x1 = components[i].x,
        y1 = components[i].y;
      const x2 = components[i + 1].x,
        y2 = components[i + 1].y;
      const A = pX - x1,
        B = pY - y1,
        C = x2 - x1,
        D = y2 - y1;
      const lenSq = C * C + D * D;
      const param = lenSq !== 0 ? (A * C + B * D) / lenSq : -1;
      let xx, yy;
      if (param < 0) {
        xx = x1;
        yy = y1;
      } else if (param > 1) {
        xx = x2;
        yy = y2;
      } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
      }
      const dist = Math.sqrt((pX - xx) ** 2 + (pY - yy) ** 2);
      if (dist < minDist) minDist = dist;
    }
    return minDist;
  }

  function normalizeLineCoordinates(coordinates) {
    if (!Array.isArray(coordinates)) return [];

    const points = [];

    const walk = (items) => {
      if (!Array.isArray(items)) return;
      if (items.length === 2 && typeof items[0] === 'number' && typeof items[1] === 'number') {
        points.push(items);
        return;
      }

      items.forEach((item) => walk(item));
    };

    walk(coordinates);
    return points;
  }

  function getDistanceToGeoJSONLine(lat, lon, coordinates) {
    const normalizedCoordinates = normalizeLineCoordinates(coordinates);
    if (normalizedCoordinates.length < 2) return Infinity;

    const metersPerLonDegree = 111320 * Math.cos((lat * Math.PI) / 180);
    const metersPerLatDegree = 110540;
    const components = normalizedCoordinates.map(([coordinateLon, coordinateLat]) => ({
      x: Number(coordinateLon) * metersPerLonDegree,
      y: Number(coordinateLat) * metersPerLatDegree,
    }));
    if (components.some((item) => !Number.isFinite(item.x) || !Number.isFinite(item.y))) {
      return Infinity;
    }

    return getDistanceToGeometry(lon * metersPerLonDegree, lat * metersPerLatDegree, components);
  }

  async function getSegmentDetailByLatLon(lat, lon) {
    if (!wmeSDK?.DataModel?.Segments) return null;

    for (let attempt = 0; attempt < SEGMENT_SEARCH.NUMBER_OF_RETRIES; attempt++) {
      try {
        const segments = wmeSDK.DataModel.Segments.getAll();
        debugLog(`${LOG_PREFIX} SDK loaded ${segments.length} segments`);

        if (segments.length === 0) {
          debugLog(
            `${LOG_PREFIX} SDK segment model empty, attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}. Waiting ${SEGMENT_SEARCH.RETRY_DELAY_MS}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, SEGMENT_SEARCH.RETRY_DELAY_MS));
          continue;
        }

        const candidates = segments
          .map((segment) => ({
            segment,
            distanceMeters: getDistanceToGeoJSONLine(lat, lon, segment.geometry?.coordinates),
          }))
          .filter(({ distanceMeters }) => distanceMeters <= SEGMENT_SEARCH.MAX_DIST_METERS)
          .sort((a, b) => a.distanceMeters - b.distanceMeters);

        debugLog(
          `${LOG_PREFIX} Found ${candidates.length} candidate segments within ${SEGMENT_SEARCH.MAX_DIST_METERS}m:`,
          candidates,
        );

        const matched = candidates[0];
        if (matched) {
          const address = wmeSDK.DataModel.Segments.getAddress({
            segmentId: matched.segment.id,
          });
          const segmentDetails = {
            streetName: address?.street?.name || '',
            cityName: address?.city?.name || '',
          };

          debugLog(
            `${LOG_PREFIX} SDK matched segment ${matched.segment.id} at ${matched.distanceMeters.toFixed(2)} meters`,
            segmentDetails,
          );
          return segmentDetails;
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} SDK segment lookup error on attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}:`,
          err.message,
        );
      }

      debugLog(
        `${LOG_PREFIX} No matching segment found near coordinates, attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}. Waiting ${SEGMENT_SEARCH.RETRY_DELAY_MS}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, SEGMENT_SEARCH.RETRY_DELAY_MS));
    }

    debugLog(
      `${LOG_PREFIX} SDK lookup finished without a segment within ${SEGMENT_SEARCH.MAX_DIST_METERS}m.`,
    );
    return null;
  }

  function waitForMapDataLoaded(timeoutMs = 5000) {
    if (!wmeSDK?.Events?.once) {
      return new Promise((resolve) => setTimeout(resolve, SEGMENT_SEARCH.RETRY_DELAY_MS));
    }

    return Promise.race([
      wmeSDK.Events.once({ eventName: 'wme-map-data-loaded' }),
      new Promise((resolve) => setTimeout(resolve, timeoutMs)),
    ]);
  }

  async function getSegmentDetailByLoadingURArea(lat, lon) {
    if (!wmeSDK?.Map) return null;

    const originalCenter = wmeSDK.Map.getMapCenter();
    const originalZoom = wmeSDK.Map.getZoomLevel();
    const detailZoom = Math.max(originalZoom, 18);
    const [left, bottom, right, top] = wmeSDK.Map.getMapExtent();
    const urIsVisible = lon >= left && lon <= right && lat >= bottom && lat <= top;
    const mapNeedsToMove = originalZoom < 18 || !urIsVisible;

    if (!mapNeedsToMove) {
      debugLog(`${LOG_PREFIX} UR is already visible at detail zoom; skipping map reload wait.`);
      return getSegmentDetailByLatLon(lat, lon);
    }

    debugLog(`${LOG_PREFIX} Loading map data around UR at zoom ${detailZoom}...`);
    const dataLoaded = waitForMapDataLoaded();
    wmeSDK.Map.setMapCenter({ lonLat: { lat, lon }, zoomLevel: detailZoom });

    try {
      await dataLoaded;
      return await getSegmentDetailByLatLon(lat, lon);
    } finally {
      debugLog(`${LOG_PREFIX} Restoring previous map center and zoom...`);
      wmeSDK.Map.setMapCenter({ lonLat: originalCenter, zoomLevel: originalZoom });
    }
  }

  /**
   * @param {number} lat
   * @param {number} lon
   * @returns {string}
   */
  function getCityNameByLatLon(lat, lon) {
    if (typeof W === 'undefined' || !W.model?.cities) return '';

    const projected = getProjectedPoint(lat, lon);
    if (!projected) return '';
    const { pX, pY } = projected;

    let closestCityName = '';
    let minDist = Infinity;

    try {
      const cities = W.model.cities.getObjectArray();
      debugLog(`${LOG_PREFIX} City fallback: scanning ${cities.length} cities...`);

      cities.forEach((city) => {
        const cityName = (city.attributes?.name || '').trim();
        if (!cityName) return; // bỏ qua No City

        const geom = city.geometry || city.attributes?.geometry;
        if (!geom) return;

        let cx, cy;
        if (typeof geom.x === 'number' && typeof geom.y === 'number') {
          cx = geom.x;
          cy = geom.y;
        } else if (typeof geom.getBounds === 'function') {
          const bounds = geom.getBounds();
          if (bounds) {
            cx = (bounds.left + bounds.right) / 2;
            cy = (bounds.bottom + bounds.top) / 2;
          }
        }

        if (cx == null || cy == null) return;

        const dist = Math.sqrt((pX - cx) ** 2 + (pY - cy) ** 2);
        debugLog(`${LOG_PREFIX} City "${cityName}" dist: ${dist.toFixed(2)} map units`);

        if (dist < minDist) {
          minDist = dist;
          closestCityName = cityName;
        }
      });

      if (closestCityName) {
        const distMeters = minDist * (W.map?.getResolution?.() ?? 1);

        debugLog(
          `${LOG_PREFIX} City fallback found: "${closestCityName}" at ${distMeters.toFixed(0)}m`,
        );
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} getCityNameByLatLon error:`, err.message);
    }

    return closestCityName;
  }

  async function fetchCurrentURData(attrs = getCurrentURAttributes()) {
    let cityName = '';
    let lat = null;
    let lon = null;
    let coords = '';
    let reporter = '';
    let streetName = '';
    let description = '';

    try {
      if (attrs) {
        debugLog(`${LOG_PREFIX} Attributes found:`, attrs);
        if (attrs.createdBy) {
          const userId = attrs.createdBy;
          debugLog(`${LOG_PREFIX} Reporter user ID:`, userId);

          if (typeof W !== 'undefined' && W.model && W.model.users) {
            debugLog(`${LOG_PREFIX} W.model.users:`, W.model.users);
            const userModelAttrs = W.model.users?.objects?.[Number(userId)]?.attributes;
            debugLog(`${LOG_PREFIX} Reporter user attributes:`, userModelAttrs);
            if (userModelAttrs && userModelAttrs.userName) {
              reporter = userModelAttrs.userName.trim();
              debugLog(`${LOG_PREFIX} Reporter name:`, reporter);
            }
          }
        }

        if (attrs.cityName) {
          cityName = String(attrs.cityName).trim();
          debugLog(`${LOG_PREFIX} City name from attributes:`, cityName);
        }

        if (attrs.geoJSONGeometry && Array.isArray(attrs.geoJSONGeometry.coordinates)) {
          const parseLon = parseFloat(attrs.geoJSONGeometry.coordinates[0]);
          const parseLat = parseFloat(attrs.geoJSONGeometry.coordinates[1]);

          if (!isNaN(parseLat) && !isNaN(parseLon)) {
            lon = parseLon;
            lat = parseLat;
            coords = `${lat}, ${lon}`;
            debugLog(`${LOG_PREFIX} Coordinates from attributes:`, { lat, lon });

            const segmentDetail = await getSegmentDetailByLoadingURArea(lat, lon);
            if (segmentDetail) {
              streetName = segmentDetail.streetName.trim();
              debugLog(`${LOG_PREFIX} Street name from segment detail:`, streetName);

              if (!cityName && segmentDetail.cityName) {
                cityName = segmentDetail.cityName.trim();
                debugLog(`${LOG_PREFIX} City name from segment detail:`, cityName);
              }
            }

            if (!cityName) {
              debugLog(`${LOG_PREFIX} No city from segments, trying city centroid fallback...`);
              cityName = getCityNameByLatLon(lat, lon);
              if (cityName) {
                debugLog(`${LOG_PREFIX} City name from city centroid fallback:`, cityName);
              }
            }
          }
        }

        if (attrs.description) {
          description = String(attrs.description).trim();
          debugLog(`${LOG_PREFIX} Description from attributes:`, description);

          if (!reporter) {
            const usernameInDescription = description.match(/(?:waze\s+)?username:?\s*(\w+)/i)?.[1];
            if (usernameInDescription) {
              reporter = usernameInDescription;
              debugLog(`${LOG_PREFIX} Reporter name from description:`, reporter);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Error extracting data:`, err.message);
    }

    return {
      [TagKey.CITY]: cityName,
      [TagKey.LAT]: lat,
      [TagKey.LON]: lon,
      [TagKey.COORDS]: coords,
      [TagKey.REPORTER]: reporter,
      [TagKey.STREET]: streetName,
      [TagKey.DESCRIPTION]: description,
    };
  }

  function setTriggerLoading(btn, isLoading) {
    if (!btn) return;
    if (isLoading) {
      btn.setAttribute('busy', '');
      btn.setAttribute('disabled', '');
    } else {
      btn.removeAttribute('busy');
      btn.removeAttribute('disabled');
    }
  }

  function validateTemplateVariables(content) {
    const hasUnclosedOrOrphanTags = (value) => {
      let depth = 0;

      for (let i = 0; i < value.length; i += 1) {
        const ch = value[i];
        if (ch === '{') {
          depth += 1;
        } else if (ch === '}') {
          if (depth === 0) return true;
          depth -= 1;
        }
      }

      return depth > 0;
    };

    const errors = [];
    const unknownTags = [];
    const unknownTagSet = new Set();
    const addUnknownTag = (value) => {
      if (!value || unknownTagSet.has(value)) return;
      unknownTagSet.add(value);
      unknownTags.push(value);
    };

    const chunkPattern = /\{[^{}]*\}/g;
    const chunkMatches = content.match(chunkPattern) || [];

    for (const rawChunk of chunkMatches) {
      const inner = rawChunk.slice(1, -1).trim();

      // Keep "{}" permissive while user is still typing.
      if (!inner) {
        continue;
      }

      const m = inner.match(/^([a-zA-Z_][\w]*)\s*(?:\|\s*(['"])([\s\S]*?)\2\s*)?$/);
      if (!m) {
        addUnknownTag(`{${inner}}`);
        continue;
      }

      const tagName = m[1];
      if (!TEMPLATE_TAG_SET.has(tagName)) {
        addUnknownTag(rawChunk);
      }
    }

    const hasOnlyEmptyTags =
      chunkMatches.length > 0 && chunkMatches.every((chunk) => chunk.trim() === '{}');
    const onlyTextOutsideTags = content.replace(chunkPattern, '');
    const hasOrphanTextForBraces = /[{}]/.test(onlyTextOutsideTags);

    const hasUnclosedOrOrphanTag = hasUnclosedOrOrphanTags(content);

    if (unknownTags.length > 0) {
      errors.push(`${t('templateValidationUnknownTag')}: ${unknownTags.join(', ')}`);
    }
    if (hasUnclosedOrOrphanTag && !hasOnlyEmptyTags && !hasOrphanTextForBraces) {
      errors.push(t('templateValidationUnknownTag'));
    }

    return errors.join('\n');
  }

  function processTemplateContent(content, language = lang) {
    const dataMap = Object.fromEntries(TAG_KEYS.map((tag) => [tag, cachedURData[tag]]));
    const effectiveDefaults = getUserDefaultValues(normalizeLanguage(language, lang));

    const tagRegex = /\{([\w]+)(?:\s*\|\s*['"]([^'"]*)['"])?\}/g;

    let processed = content.replace(tagRegex, (match, tagName, inlineDefault) => {
      const liveValue = dataMap[tagName];
      if (liveValue !== '' && liveValue != null) return liveValue;

      if (inlineDefault) return inlineDefault;

      const userDefault = effectiveDefaults[tagName];
      if (userDefault) return userDefault;

      return '';
    });

    processed = processed
      .replace(/\(\s*\)/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/ ([,.;\-\/])/g, '$1')
      .replace(/,(\s*,)+/g, ',')
      .replace(/^[ \t]*[,.;\-\/][ \t]*$/gm, '')
      .trim();

    return processed;
  }

  // --- DOM / Waze UI helpers ---
  function setBtnDisabled(btn, disabled) {
    if (!btn) return;
    if (disabled) btn.setAttribute('disabled', '');
    else btn.removeAttribute('disabled');
  }

  function setWzTextareaAttributes(
    el,
    id,
    name,
    placeholder = '',
    showLength = true,
    disabled = false,
  ) {
    el.setAttribute('id', id);
    el.setAttribute('name', name);
    el.setAttribute('maxlength', '2000');
    el.setAttribute('display-maxlength', showLength);
    el.setAttribute('placeholder', placeholder);
    el.style.height = '7rem';
    el.style.resize = 'vertical';
    if (disabled) {
      el.setAttribute('disabled', '');
    } else {
      el.removeAttribute('disabled');
    }
  }

  function createElement(tagName, options = {}, children = []) {
    const element = document.createElement(tagName);
    const { id, className, text, attributes = {}, dataset = {}, style } = options;

    if (id) element.id = id;
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    if (style) element.style.cssText = style;

    Object.entries(attributes).forEach(([name, value]) => {
      if (value === false || value === null || value === undefined) return;
      element.setAttribute(name, value === true ? '' : String(value));
    });
    Object.entries(dataset).forEach(([name, value]) => {
      element.dataset[name] = String(value);
    });
    element.append(...children.filter(Boolean));
    return element;
  }

  function createWzButton({ id, className, text, color, size = 'md', style, disabled = false }) {
    return createElement('wz-button', {
      id,
      className,
      text,
      style,
      attributes: { color, size, disabled },
    });
  }

  function createIconButton({ className, id, iconClass, title, iconColor }) {
    const icon = createElement('i', {
      className: `w-icon ${iconClass}`,
      style: iconColor ? `color: ${iconColor};` : '',
    });
    return createElement(
      'wz-button',
      {
        className,
        attributes: { color: 'clear-icon', size: 'sm', title },
        dataset: id ? { id } : {},
      },
      [icon],
    );
  }

  function createLanguageSelect(id, style) {
    const select = createElement('wz-select', { id, style });
    select.append(
      createElement('wz-option', { text: 'English', attributes: { value: 'en' } }),
      createElement('wz-option', { text: 'Tiếng Việt', attributes: { value: 'vi' } }),
    );
    return select;
  }

  function fillTextToWaze(targetEl, value) {
    if (targetEl) {
      targetEl.value = value;
      targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  }

  // --- UI: Shared styles ---
  const style = document.createElement('style');
  style.textContent = `
    #tmpl-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: var(--background_modal); z-index: 99999; display: flex; align-items: center; justify-content: center; }
        #tmpl-modal-box { background: var(--background_default); border-radius: 8px; }
        .tmpl-section { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px dashed var(--separator_default, var(--hairline)); }
        .section-heading { margin: 0; }
    `;
  document.head.appendChild(style);

  function renderModal({
    title,
    bodyBuilder,
    footerBuilder,
    onBeforeClose,
    scrollBody = true,
    maxWidth = '560px',
  }) {
    const overlay = document.createElement('div');
    overlay.id = 'tmpl-modal-overlay';
    overlay.className = 'modal-backdrop';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.tabIndex = -1;

    const modal = document.createElement('div');
    modal.id = 'tmpl-modal-box';
    modal.style.cssText = `display: flex; flex-direction: column; overflow: ${scrollBody ? 'hidden' : 'visible'}; width: min(92vw, ${maxWidth}); max-height: 88vh;`;

    const header = document.createElement('div');
    header.className = 'modal-header';
    const titleEl = document.createElement('h5');
    titleEl.className = 'modal-title';
    titleEl.textContent = title;
    header.appendChild(titleEl);

    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.overflow = scrollBody ? 'auto' : 'visible';
    const builtBody = bodyBuilder();
    if (builtBody) {
      body.appendChild(builtBody);
    }

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    const builtFooter = footerBuilder(closeModal);
    if (builtFooter) {
      footer.appendChild(builtFooter);
    }

    modal.appendChild(header);
    modal.appendChild(body);
    modal.appendChild(footer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const previousActiveElement = document.activeElement;

    const escapeHandler = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
      }
    };

    function closeModal() {
      if (onBeforeClose) {
        onBeforeClose();
      }
      overlay.removeEventListener('keydown', escapeHandler);
      overlay.remove();
      try {
        if (previousActiveElement && typeof previousActiveElement.focus === 'function') {
          previousActiveElement.focus();
        }
      } catch (e) {}
    }

    overlay.addEventListener('keydown', escapeHandler);
    return { overlay, modal, closeModal };
  }

  // --- UI: Insert template modal ---
  function openModal(targetTextarea) {
    const templates = getTemplates();
    if (templates.length === 0) {
      alert(t('noTemplates'));
      return;
    }

    const { overlay, closeModal } = renderModal({
      title: t('modalTitle'),
      scrollBody: false,
      bodyBuilder: () => {
        const body = createElement('div', {
          style: 'width: 100%; max-width: 100%; min-width: 0;',
        });
        const select = createElement('wz-select', {
          id: 'tmpl-select',
          style: 'width: 100%; margin-bottom: 10px; display: block;',
          attributes: { label: t('labelName') },
        });
        select.append(
          ...templates.map((template) =>
            createElement('wz-option', {
              text: template.name,
              attributes: { value: template.id },
            }),
          ),
        );
        body.append(
          select,
          createElement('wz-label', { text: t('labelContent') }),
          createElement('div', {
            id: 'wz-preview-wrapper',
          }),
        );
        return body;
      },
      footerBuilder: (close) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display: flex; justify-content: flex-end; gap: 10px;';
        const closeBtn = document.createElement('wz-button');
        const confirmBtn = document.createElement('wz-button');
        closeBtn.setAttribute('size', 'md');
        closeBtn.setAttribute('color', 'secondary');
        closeBtn.innerText = t('close');
        confirmBtn.setAttribute('size', 'md');
        confirmBtn.setAttribute('color', 'primary');
        confirmBtn.innerText = t('insert');
        wrapper.appendChild(closeBtn);
        wrapper.appendChild(confirmBtn);
        closeBtn.onclick = () => close();
        confirmBtn.dataset.modalSubmit = '1';
        return wrapper;
      },
    });

    const wzSelect = overlay.querySelector('#tmpl-select');
    wzSelect.value = templates[0].id;

    const wzPreview = document.createElement('wz-textarea');
    setWzTextareaAttributes(
      wzPreview,
      'content-preview',
      'wz-textarea-preview',
      undefined,
      false,
      true,
    );
    wzPreview.style.cssText = 'display: block; width: 100%; max-width: 100%; min-width: 0;';

    const firstTemplate = templates[0];
    wzPreview.value = processTemplateContent(firstTemplate.content, firstTemplate.language || lang);

    // Wait for shadow DOM ready
    setTimeout(() => {
      if (wzPreview.shadowRoot) {
        const innerTextarea = wzPreview.shadowRoot.querySelector('.wz-textarea textarea');

        if (innerTextarea) {
          innerTextarea.style.cursor = 'default';
          innerTextarea.style.color = 'var(--content_default)';
          innerTextarea.style.boxSizing = 'border-box';
          innerTextarea.style.width = '100%';
          innerTextarea.style.maxWidth = '100%';
        }
      }
    }, 0);

    overlay.querySelector('#wz-preview-wrapper').appendChild(wzPreview);

    wzSelect.addEventListener('change', () => {
      const selectedId = wzSelect.value;
      const selectedTemplate = templates.find((tmpl) => tmpl.id === selectedId);
      if (!selectedTemplate) return;
      wzPreview.value = processTemplateContent(
        selectedTemplate.content,
        selectedTemplate.language || lang,
      );
    });

    const insertBtn = overlay.querySelector('[data-modal-submit="1"]');
    insertBtn.onclick = () => {
      fillTextToWaze(targetTextarea, wzPreview.value);
      closeModal();
    };
  }

  // --- UI: Quick-reply trigger on UR panel ---
  function injectTrigger() {
    const panel = document.querySelector('wz-card.problem-edit');
    if (!panel) return;

    const forms = panel.querySelectorAll('form.new-comment-form');
    forms.forEach((form) => {
      if (form.querySelector('.btn-quick-reply')) return;

      const wzTA = form.querySelector('wz-textarea.new-comment-text');
      if (!wzTA) return;

      const btn = document.createElement('wz-button');
      btn.className = 'btn-quick-reply';
      btn.setAttribute('color', 'secondary');
      btn.setAttribute('size', 'md');
      btn.innerText = t('triggerBtn');
      btn.style.cssText = 'width: 100%; margin-bottom: 6px;';
      btn.onclick = async (e) => {
        e.preventDefault();
        setTriggerLoading(btn, true);
        cachedURData = Object.fromEntries(TAG_KEYS.map((key) => [key, '']));

        try {
          cachedURData = await fetchCurrentURData();
          debugLog(`${LOG_PREFIX} Current UR data loaded:`, cachedURData);
          openModal(wzTA);
        } catch (err) {
          console.warn(`${LOG_PREFIX} Failed to load current UR data:`, err);
        } finally {
          setTriggerLoading(btn, false);
        }
      };
      form.insertBefore(btn, wzTA);
    });
  }

  // --- UI: Template list (sidebar) ---
  function renderSidebarList(tabPane) {
    const list = tabPane.querySelector('#tmpl-list');
    list.replaceChildren();
    getTemplates().forEach((tmpl) => {
      const li = document.createElement('li');

      const card = document.createElement('wz-card');
      card.className = 'list-item-card';
      card.setAttribute('size', 'sm');
      card.setAttribute('elevation', '0');
      card.setAttribute('elevation-on-hover', '0');
      card.style.cursor = 'default';

      const layout = document.createElement('div');
      layout.className = 'list-item-card-layout';
      layout.style.gridTemplateColumns = 'inherit';

      const info = document.createElement('div');
      info.className = 'list-item-card-info';

      const titleEl = document.createElement('div');
      titleEl.className = 'list-item-card-title';
      titleEl.title = tmpl.name;
      titleEl.textContent = tmpl.name;

      const caption = document.createElement('wz-caption');
      caption.title = tmpl.content;
      caption.style.cssText =
        'overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;';
      caption.textContent = tmpl.content;

      info.appendChild(titleEl);
      info.appendChild(caption);

      const actions = document.createElement('div');
      actions.className = 'list-item-card-actions';

      const favBtn = createIconButton({
        className: 'fav-btn',
        id: tmpl.id,
        iconClass: tmpl.isFavorite ? 'w-icon-star-fill' : 'w-icon-star',
        iconColor: tmpl.isFavorite ? 'var(--cautious)' : '',
      });
      const editBtn = createIconButton({
        className: 'edit-btn',
        id: tmpl.id,
        iconClass: 'w-icon-pencil',
      });
      const delBtn = createIconButton({
        className: 'del-btn',
        id: tmpl.id,
        iconClass: 'w-icon-trash',
      });

      actions.appendChild(favBtn);
      actions.appendChild(editBtn);
      actions.appendChild(delBtn);

      layout.appendChild(info);
      layout.appendChild(actions);
      card.appendChild(layout);
      li.appendChild(card);
      list.appendChild(li);
    });

    // --- Actions ---
    list.onclick = (e) => {
      const favBtn = e.target.closest('.fav-btn');
      if (favBtn) {
        const targetId = favBtn.dataset.id;
        const arr = getTemplates();
        const target = arr.find((item) => item.id === targetId);

        if (target) {
          target.isFavorite = !target.isFavorite;
          saveTemplates(arr);
          renderSidebarList(tabPane);
        }

        return;
      }

      const editBtn = e.target.closest('.edit-btn');
      if (editBtn) {
        const targetId = editBtn.dataset.id;
        const arr = getTemplates();
        const target = arr.find((item) => item.id === targetId);

        if (target) {
          const nameInput = tabPane.querySelector('#name-input');
          const languageSelect = tabPane.querySelector('#template-language-select');
          const contentTextarea = tabPane.querySelector('#content-textarea');
          const submitBtn = tabPane.querySelector('#submit-btn');
          const cancelBtn = tabPane.querySelector('#cancel-btn');

          templateFormController?.clearValidationState?.();
          editingTemplateId = targetId;

          if (nameInput && contentTextarea && submitBtn && cancelBtn) {
            nameInput.value = target.name;
            contentTextarea.value = target.content;
            if (languageSelect) languageSelect.value = target.language || lang;
            submitBtn.innerText = t('saveBtn');
            cancelBtn.style.display = '';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
            requestAnimationFrame(() => {
              const container = document.getElementById('urrm-container');
              if (container) {
                container.parentElement.parentElement.parentElement.scrollTo({
                  top: 0,
                  behavior: 'smooth',
                });
              }
            });
          }
        }
      }

      const delBtn = e.target.closest('.del-btn');
      if (delBtn) {
        if (confirm(t('confirmDelete'))) {
          const arr = getTemplates();
          const targetId = delBtn.dataset.id;
          const updatedData = arr.filter((item) => item.id !== targetId);

          saveTemplates(updatedData);
          renderSidebarList(tabPane);
        }
      }
    };
  }

  // --- UI: Tag defaults section (render) ---
  function renderTagsSection(tabPane, onValueChange, language = lang) {
    const normalizedLanguage = normalizeLanguage(language, lang);
    userDefaultValues = getUserDefaultValues(normalizedLanguage);
    const container = tabPane.querySelector('#tmpl-tags-list');
    if (!container) return;

    container.replaceChildren();
    const scriptDefaults = getScriptDefaultValues(normalizedLanguage);

    TAG_KEYS.forEach((tagKey) => {
      const tagValue = `{${tagKey}}`;
      const displayValue = userDefaultValues[tagKey] || '';

      const itemDiv = document.createElement('div');

      const tagDisplayDiv = document.createElement('div');
      tagDisplayDiv.style.cssText = 'font-size: 12px; margin-bottom: 6px;';

      const code = document.createElement('code');
      code.style.cssText = 'background-color: var(--background_variant);';
      code.style.cursor = 'pointer';
      code.style.userSelect = 'none';
      code.setAttribute('title', t('tagCopiedHint'));
      code.setAttribute('role', 'button');
      code.tabIndex = 0;
      code.textContent = tagValue;

      let restoreTagTimer = null;

      const copyTag = async () => {
        const originalCodeText = tagValue;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(tagValue);
          } else {
            const tempInput = document.createElement('input');
            tempInput.value = tagValue;
            document.body.appendChild(tempInput);
            tempInput.select();
            try {
              document.execCommand('copy');
            } finally {
              if (tempInput.parentNode) {
                tempInput.parentNode.removeChild(tempInput);
              }
            }
          }
          code.textContent = t('copied');
        } catch (error) {
          code.textContent = originalCodeText;
          console.warn(`${LOG_PREFIX} Failed to copy variable:`, error);
        }

        if (restoreTagTimer) clearTimeout(restoreTagTimer);
        restoreTagTimer = setTimeout(() => {
          code.textContent = originalCodeText;
        }, 2000);
      };

      code.onclick = copyTag;
      code.onkeydown = (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        copyTag();
      };

      const span = document.createElement('span');
      span.textContent = t(TAG_LABEL_KEYS[tagKey]);

      tagDisplayDiv.appendChild(code);
      tagDisplayDiv.appendChild(document.createTextNode(' - '));
      tagDisplayDiv.appendChild(span);

      itemDiv.appendChild(tagDisplayDiv);

      if (!NO_DEFAULT_VALUE_TAG_KEYS.includes(tagKey)) {
        const inputDiv = document.createElement('div');
        inputDiv.style.cssText = 'display: flex; gap: 6px; align-items: center;';

        const label = document.createElement('wz-label');
        label.textContent = t('defaultValueLabel');

        const input = document.createElement('wz-text-input');
        input.setAttribute('type', 'text');
        input.setAttribute('size', 'sm');
        input.setAttribute('maxlength', '100');
        input.setAttribute('display-maxlength', 'false');
        input.setAttribute('placeholder', t('placeholderDefaultValue'));
        input.style.cssText = 'flex: 1;';
        input.value = displayValue;

        input.className = 'default-value-input';
        input.dataset.tag = tagKey;

        const resetBtn = createIconButton({
          className: 'default-value-reset-btn',
          iconClass: 'w-icon-x',
          title: t('resetBtn'),
        });
        resetBtn.dataset.tag = tagKey;
        resetBtn.style.display = 'none';

        const scriptDefault = scriptDefaults[tagKey] || '';

        const syncRowReset = () => {
          resetBtn.style.display = input.value !== scriptDefault ? '' : 'none';
          onValueChange?.();
        };

        input.addEventListener('input', syncRowReset);

        resetBtn.onclick = () => {
          input.value = scriptDefault;
          resetBtn.style.display = 'none';
          onValueChange?.();
        };

        syncRowReset();

        inputDiv.appendChild(input);
        inputDiv.appendChild(resetBtn);

        itemDiv.appendChild(label);
        itemDiv.appendChild(inputDiv);
      }

      container.appendChild(itemDiv);
    });
  }

  // --- UI: Sidebar — template add/edit form ---
  function setupTemplateForm(tabPane, wzInput) {
    const nameInput = tabPane.querySelector('#name-input');
    const languageSelect = tabPane.querySelector('#template-language-select');
    const submitBtn = tabPane.querySelector('#submit-btn');
    const cancelBtn = tabPane.querySelector('#cancel-btn');
    const contentError = tabPane.querySelector('#template-content-error');
    let templateValidationTimer = null;
    let lastValidationMessage = '';

    const clearValidationState = () => {
      if (templateValidationTimer) {
        clearTimeout(templateValidationTimer);
        templateValidationTimer = null;
      }

      lastValidationMessage = '';
      if (contentError) {
        contentError.textContent = '';
        contentError.style.display = 'none';
      }
    };

    const updateTemplateValidation = () => {
      lastValidationMessage = validateTemplateVariables(wzInput.value || '');

      if (contentError) {
        contentError.textContent = lastValidationMessage;
        contentError.style.display = lastValidationMessage ? 'block' : 'none';
      }

      const hasName = nameInput.value.trim().length > 0;
      const hasContent = wzInput.value.trim().length > 0;
      setBtnDisabled(submitBtn, !hasName || !hasContent || Boolean(lastValidationMessage));
    };

    const scheduleTemplateValidation = () => {
      if (templateValidationTimer) clearTimeout(templateValidationTimer);
      templateValidationTimer = setTimeout(updateTemplateValidation, 300);
    };

    const resetEditState = () => {
      editingTemplateId = null;
      submitBtn.innerText = t('addBtn');
      nameInput.value = '';
      wzInput.value = '';
      if (languageSelect) languageSelect.value = lang;
      clearValidationState();
      setBtnDisabled(submitBtn, true);
      cancelBtn.style.display = 'none';
    };

    nameInput.addEventListener('input', () => {
      const hasName = nameInput.value.trim().length > 0;
      const hasContent = wzInput.value.trim().length > 0;
      setBtnDisabled(submitBtn, !hasName || !hasContent || Boolean(lastValidationMessage));
    });
    wzInput.addEventListener('input', scheduleTemplateValidation);

    cancelBtn.onclick = () => {
      if (editingTemplateId && !confirm(t('cancelEdit'))) return;
      resetEditState();
    };

    submitBtn.onclick = () => {
      const name = nameInput.value.trim();
      const content = wzInput.value.trim();
      const selectedLanguage = normalizeLanguage(languageSelect?.value || lang);
      updateTemplateValidation();
      if (!name || !content) return;
      if (lastValidationMessage) return;

      const arr = getTemplates();
      const existsName = editingTemplateId
        ? arr.some((item) => item.name === name && item.id !== editingTemplateId)
        : arr.some((item) => item.name === name);

      if (existsName) {
        alert(t('existsName'));
        return;
      }

      const dateNow = Date.now();

      if (editingTemplateId) {
        const target = arr.find((item) => item.id === editingTemplateId);
        if (target) {
          target.name = name;
          target.content = content;
          target.language = selectedLanguage;
          target.updatedDate = dateNow;
          saveTemplates(arr);
          alert(t('updateSuccess'));
          resetEditState();
          renderSidebarList(tabPane);
        }
        return;
      }

      arr.push({
        id: dateNow.toString(),
        name,
        content,
        language: selectedLanguage,
        isFavorite: false,
        createdDate: dateNow,
        updatedDate: dateNow,
      });
      saveTemplates(arr);
      alert(t('addSuccess'));
      nameInput.value = '';
      wzInput.value = '';
      setBtnDisabled(submitBtn, true);
      renderSidebarList(tabPane);
    };

    return {
      clearValidationState,
    };
  }

  // --- UI: Sidebar — tag default values ---
  function setupTagDefaultsSection(tabPane) {
    const saveAllBtn = tabPane.querySelector('#default-values-save-all-btn');
    const cancelAllBtn = tabPane.querySelector('#default-values-cancel-all-btn');
    const resetAllBtn = tabPane.querySelector('#default-values-reset-all-btn');
    const defaultLanguageSelect = tabPane.querySelector('#default-values-language-select');

    const tagInputsHaveUnsavedChanges = (inputs) => {
      const normalizedLanguage = normalizeLanguage(activeDefaultLanguage, lang);
      const baselineDefaults = getUserDefaultValues(normalizedLanguage);
      for (const input of inputs) {
        const baseline = baselineDefaults[input.dataset.tag] || '';
        if (input.value !== baseline) return true;
      }
      return false;
    };

    const checkForChanges = () => {
      const inputs = tabPane.querySelectorAll('.default-value-input');
      const hasUnsavedChanges = tagInputsHaveUnsavedChanges(inputs);

      saveAllBtn.style.display = hasUnsavedChanges ? '' : 'none';
      cancelAllBtn.style.display = hasUnsavedChanges ? '' : 'none';
      resetAllBtn.style.display = hasUnsavedChanges ? 'none' : '';
    };

    const syncResetAllBtn = () => {
      const normalizedLanguage = normalizeLanguage(activeDefaultLanguage, lang);
      setBtnDisabled(resetAllBtn, !hasStoredUserDefaultValues(normalizedLanguage));
    };

    const refresh = () => {
      const normalizedLanguage = normalizeLanguage(activeDefaultLanguage, lang);
      renderTagsSection(tabPane, checkForChanges, normalizedLanguage);
      checkForChanges();
      syncResetAllBtn();
    };

    saveAllBtn.onclick = () => {
      const normalizedLanguage = normalizeLanguage(
        defaultLanguageSelect?.value || activeDefaultLanguage,
        lang,
      );
      const inputs = tabPane.querySelectorAll('.default-value-input');
      saveUserDefaultValues(
        buildStoredValuesFromInputs(inputs, normalizedLanguage),
        normalizedLanguage,
      );
      activeDefaultLanguage = normalizedLanguage;
      userDefaultValues = getUserDefaultValues(normalizedLanguage);
      refresh();
      alert(t('defaultsSaved'));
    };

    resetAllBtn.onclick = () => {
      if (!confirm(t('confirmResetAllDefaults'))) return;
      const normalizedLanguage = normalizeLanguage(
        defaultLanguageSelect?.value || activeDefaultLanguage,
        lang,
      );
      saveUserDefaultValues({}, normalizedLanguage);
      activeDefaultLanguage = normalizedLanguage;
      userDefaultValues = getUserDefaultValues(normalizedLanguage);
      refresh();
      alert(t('defaultsResetSuccess'));
    };

    cancelAllBtn.onclick = () => {
      const inputs = tabPane.querySelectorAll('.default-value-input');
      if (tagInputsHaveUnsavedChanges(inputs) && !confirm(t('cancelEdit'))) return;
      const normalizedLanguage = normalizeLanguage(activeDefaultLanguage, lang);
      const defaultsSnapshot = getUserDefaultValues(normalizedLanguage);
      inputs.forEach((input) => {
        input.value = defaultsSnapshot[input.dataset.tag] || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

    if (defaultLanguageSelect) {
      defaultLanguageSelect.value = activeDefaultLanguage;
      defaultLanguageSelect.addEventListener('change', () => {
        activeDefaultLanguage = normalizeLanguage(defaultLanguageSelect.value || lang, lang);
        refresh();
      });
    }

    return { refresh };
  }

  // --- UI: Sidebar — import / export ---
  function setupImportExport(tabPane, onDataImported) {
    const exportBtn = tabPane.querySelector('#export-tmpl');
    const importBtn = tabPane.querySelector('#import-tmpl');
    const fileInput = tabPane.querySelector('#import-file');

    exportBtn.onclick = () => {
      const data = getStorageData();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wme_ur_reply_manager.txt';
      a.click();
      URL.revokeObjectURL(url);
    };

    importBtn.onclick = () => fileInput.click();

    const openImportConflictResolver = (conflicts) =>
      new Promise((resolve) => {
        const conflictState = new Map();
        const { closeModal } = renderModal({
          title: t('importConflictTitle'),
          maxWidth: '880px',
          bodyBuilder: () => {
            const body = document.createElement('div');
            const list = document.createElement('div');
            list.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';
            const selectedColor = 'var(--primary)';
            const borderColor = 'var(--separator_default, var(--hairline))';

            conflicts.forEach((item, idx) => {
              const row = document.createElement('div');
              const existing = item.existing || null;
              const imported = item.imported;
              const currentContent = existing?.content || '';
              const incomingContent = imported?.content || '';

              row.style.cssText = 'padding: 0;';

              const heading = document.createElement('div');
              heading.style.cssText =
                'font-weight: 600; margin: 0 0 8px; color: var(--content_default);';
              heading.textContent = `${existing?.name || imported.name || ''}`;

              const contentWrap = document.createElement('div');
              contentWrap.style.cssText =
                'display: grid; grid-template-columns: 1fr 1fr; gap: 10px;';

              conflictState.set(idx, false);

              const cardStates = {
                current: { label: 'Current', caption: 'Keep current' },
                imported: { label: 'Imported', caption: 'Use imported' },
              };

              const cards = {};

              const syncSelection = () => {
                const useIncoming = !!conflictState.get(idx);
                const selectCurrent = !useIncoming;
                const currentCard = cards.current;
                const incomingCard = cards.imported;
                const currentRadio = currentCard?.querySelector('input[type="radio"]');
                const incomingRadio = incomingCard?.querySelector('input[type="radio"]');

                if (currentRadio) currentRadio.checked = selectCurrent;
                if (incomingRadio) incomingRadio.checked = useIncoming;

                if (currentCard) {
                  currentCard.style.borderColor = selectCurrent ? selectedColor : borderColor;
                  currentCard.style.boxShadow = 'none';
                  currentCard.setAttribute('aria-pressed', String(selectCurrent));
                }
                if (incomingCard) {
                  incomingCard.style.borderColor = useIncoming ? selectedColor : borderColor;
                  incomingCard.style.boxShadow = 'none';
                  incomingCard.setAttribute('aria-pressed', String(useIncoming));
                }
              };

              const makeChoiceCard = (type, valueText) => {
                const card = document.createElement('div');
                const cardTop = document.createElement('div');
                const radio = document.createElement('input');
                const labelText = document.createElement('div');
                const contentText = document.createElement('div');

                radio.type = 'radio';
                radio.name = `import-conflict-${idx}`;
                radio.tabIndex = -1;
                radio.style.cssText = 'margin: 0;';

                labelText.textContent = `${cardStates[type].label}`;

                contentText.textContent = valueText || '';
                contentText.style.cssText = 'white-space: pre-wrap; overflow-wrap: anywhere;';

                cardTop.style.cssText =
                  'display: flex; align-items: center; gap: 6px; margin-bottom: 8px;';
                card.style.cssText = `border: 1px solid ${borderColor}; border-radius: 8px; padding: 10px; cursor: pointer; background: var(--background_default);`;
                card.style.boxSizing = 'border-box';
                card.setAttribute('data-choice', type);
                card.setAttribute('role', 'button');
                card.setAttribute('tabindex', '0');
                card.setAttribute('aria-pressed', 'false');

                cardTop.appendChild(radio);
                cardTop.appendChild(labelText);
                card.appendChild(cardTop);
                if (type === 'current') {
                  cardTop.title = 'Keep current';
                } else {
                  cardTop.title = 'Use imported';
                }
                card.appendChild(contentText);

                const onSelect = () => {
                  conflictState.set(idx, type === 'imported');
                  syncSelection();
                };

                card.addEventListener('click', onSelect);
                card.addEventListener('keydown', (event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect();
                  }
                });

                return card;
              };

              const currentCard = makeChoiceCard('current', currentContent);
              const importedCard = makeChoiceCard('imported', incomingContent);
              cards.current = currentCard;
              cards.imported = importedCard;

              contentWrap.appendChild(currentCard);
              contentWrap.appendChild(importedCard);
              syncSelection();

              row.appendChild(heading);
              row.appendChild(contentWrap);
              list.appendChild(row);
            });

            body.appendChild(list);
            return body;
          },
          footerBuilder: (close) => {
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'display: flex; justify-content: flex-end; gap: 8px;';
            const btnCancel = document.createElement('wz-button');
            const btnApply = document.createElement('wz-button');
            btnCancel.setAttribute('color', 'secondary');
            btnCancel.setAttribute('size', 'md');
            btnCancel.textContent = t('cancelBtn');
            btnApply.setAttribute('color', 'primary');
            btnApply.setAttribute('size', 'md');
            btnApply.textContent = t('saveBtn');

            btnCancel.onclick = () => {
              close();
              resolve(null);
            };
            btnApply.onclick = () => {
              const resolved = conflicts.map((item, idx) => ({
                ...item,
                useIncoming: !!conflictState.get(idx),
              }));
              close();
              resolve(resolved);
            };

            wrapper.appendChild(btnCancel);
            wrapper.appendChild(btnApply);
            return wrapper;
          },
        });

        if (conflicts.length === 0) {
          closeModal();
          resolve([]);
        }
      });

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          const importedStorage = migrateStorageData(importedData, lang);

          if (!importedStorage?.templates?.length) {
            alert(t('importError'));
            return;
          }

          const currentData = getStorageData();
          const currentTemplates = Array.isArray(currentData?.templates)
            ? currentData.templates
            : [];
          const existingById = new Map(currentTemplates.map((item) => [item.id, item]));
          const existingByName = new Map(
            currentTemplates
              .map((item) => [normalizeTemplateName(item.name), item])
              .filter(([name]) => name),
          );

          const incomingTemplates = importedStorage.templates;
          const seenIncomingId = new Set();
          const seenIncomingName = new Set();
          const noConflictTemplates = [];
          const conflictTemplates = [];

          for (const template of incomingTemplates) {
            const normalizedName = normalizeTemplateName(template.name);
            const hasIncomingDuplicate =
              seenIncomingId.has(template.id) ||
              (normalizedName && seenIncomingName.has(normalizedName));
            if (hasIncomingDuplicate) continue;

            const existingByNameMatch = normalizedName ? existingByName.get(normalizedName) : null;
            const existingByIdMatch = existingById.get(template.id) || null;
            const hasConflict = !!existingByIdMatch || !!existingByNameMatch;

            seenIncomingId.add(template.id);
            if (normalizedName) seenIncomingName.add(normalizedName);

            if (hasConflict) {
              conflictTemplates.push({
                imported: template,
                existing: existingByIdMatch || existingByNameMatch,
                type: existingByIdMatch ? 'id' : 'name',
              });
            } else {
              noConflictTemplates.push(template);
            }
          }

          let resolvedConflicts = [];
          if (conflictTemplates.length) {
            const maybeResolved = await openImportConflictResolver(conflictTemplates);
            if (!maybeResolved) return;
            resolvedConflicts = maybeResolved;
          }

          const mergedTemplates = [...currentTemplates];
          resolvedConflicts.forEach((item) => {
            if (!item.useIncoming) return;
            const existingIndex = mergedTemplates.findIndex(
              (it) =>
                item.existing &&
                (it.id === item.existing.id ||
                  normalizeTemplateName(it.name) === normalizeTemplateName(item.imported.name)),
            );
            if (existingIndex >= 0) {
              mergedTemplates[existingIndex] = item.imported;
            }
          });
          mergedTemplates.push(...noConflictTemplates);

          // Ensure no duplicated incoming entries after resolve.
          const dedupById = new Set();
          const dedupByName = new Set();
          const finalTemplates = [];
          for (const item of mergedTemplates) {
            const normalizedName = normalizeTemplateName(item.name);
            if (dedupById.has(item.id) || (normalizedName && dedupByName.has(normalizedName))) {
              continue;
            }
            dedupById.add(item.id);
            if (normalizedName) dedupByName.add(normalizedName);
            finalTemplates.push(item);
          }

          setStorageData({
            templates: finalTemplates,
            configs: {
              ...currentData.configs,
              ...importedStorage.configs,
            },
          });

          onDataImported();
          fileInput.value = '';
          alert(t('importSuccess'));
        } catch (err) {
          console.warn(`${LOG_PREFIX} Import parsing failed:`, err);
          alert(t('importError'));
        }
      };
      reader.readAsText(file);
    };
  }

  function createSidebarContent() {
    const root = createElement('div', { id: 'urrm-container', style: 'padding: 10px 20px;' });

    const header = createElement('div', { style: 'text-align: center; margin-bottom: 8px;' }, [
      createElement('h6', { text: 'WME UR Reply Manager', style: 'margin-top: 0;' }),
    ]);

    const importExportActions = createElement(
      'div',
      { style: 'display: flex; gap: 8px; margin-bottom: 12px; width: 100%;' },
      [
        createWzButton({
          id: 'export-tmpl',
          text: t('exportBtn'),
          color: 'secondary',
          style: 'flex: 1;',
        }),
        createWzButton({
          id: 'import-tmpl',
          text: t('importBtn'),
          color: 'secondary',
          style: 'flex: 1;',
        }),
        createElement('input', {
          id: 'import-file',
          style: 'display: none;',
          attributes: { type: 'file', accept: '.txt' },
        }),
      ],
    );

    const wzInput = document.createElement('wz-textarea');
    setWzTextareaAttributes(
      wzInput,
      'content-textarea',
      'wz-textarea-content',
      t('placeholderContent'),
      true,
    );
    const contentError = createElement('div', {
      id: 'template-content-error',
      style:
        'margin-top: 4px; color: var(--alarming); font-size: 12px; display: none; white-space: pre-line;',
    });
    const contentWrapper = createElement(
      'div',
      { id: 'wz-input-wrapper', style: 'margin-top: 10px;' },
      [wzInput, contentError],
    );

    const templateLanguageSelect = createLanguageSelect(
      'template-language-select',
      'width: 100%; margin-bottom: 10px; display: block;',
    );
    const formActions = createElement(
      'div',
      { style: 'margin-top: 10px; display: flex; justify-content: flex-end; gap: 8px;' },
      [
        createWzButton({
          id: 'cancel-btn',
          text: t('cancelBtn'),
          color: 'secondary',
          style: 'display: none;',
        }),
        createWzButton({
          id: 'submit-btn',
          text: t('addBtn'),
          color: 'primary',
          disabled: true,
        }),
      ],
    );
    const templateForm = createElement('div', { className: 'tmpl-section' }, [
      createElement('wz-label', {
        text: t('labelName'),
        attributes: { 'html-for': 'name-input' },
      }),
      createElement('wz-text-input', {
        id: 'name-input',
        attributes: {
          name: 'wz-text-input-template-name',
          placeholder: t('placeholderName'),
          autocomplete: 'off',
          type: 'text',
          size: 'md',
          maxlength: '100',
        },
      }),
      createElement('wz-label', {
        text: t('labelLanguage'),
        style: 'margin-top: 10px;',
        attributes: { 'html-for': 'template-language-select' },
      }),
      templateLanguageSelect,
      createElement('wz-label', {
        text: t('labelContent'),
        style: 'display: block; margin-bottom: 5px;',
        attributes: { 'html-for': 'content-textarea' },
      }),
      contentWrapper,
      formActions,
    ]);

    const defaultLanguageSelect = createLanguageSelect(
      'default-values-language-select',
      'width: 170px; display: block;',
    );
    const defaultsLanguageRow = createElement(
      'div',
      { style: 'display: flex; align-items: center; gap: 8px; margin-bottom: 12px;' },
      [
        createElement('wz-label', {
          text: t('labelLanguage') || 'Language',
          style: 'white-space: nowrap;',
          attributes: { 'html-for': 'default-values-language-select' },
        }),
        defaultLanguageSelect,
      ],
    );
    const defaultsActions = createElement(
      'div',
      { style: 'display: flex; justify-content: flex-end; gap: 8px;' },
      [
        createWzButton({
          id: 'default-values-cancel-all-btn',
          text: t('cancelBtn'),
          color: 'secondary',
          style: 'display: none;',
        }),
        createWzButton({
          id: 'default-values-reset-all-btn',
          text: t('resetAllBtn'),
          color: 'secondary',
          disabled: true,
        }),
        createWzButton({
          id: 'default-values-save-all-btn',
          text: t('saveBtn'),
          color: 'primary',
          style: 'display: none;',
        }),
      ],
    );
    const tagsSection = createElement('div', { id: 'tags-section', className: 'tmpl-section' }, [
      createElement(
        'div',
        {
          style:
            'display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px;',
        },
        [createElement('h6', { className: 'section-heading', text: t('tagsHeading') })],
      ),
      createElement('div', {
        id: 'tmpl-tags-list',
        style:
          'display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; max-height: 400px; overflow-y: auto;',
      }),
      defaultsLanguageRow,
      createElement('small', {
        text: t('tagsHint'),
        style: 'display: block; margin-bottom: 12px;',
      }),
      defaultsActions,
    ]);

    root.append(
      header,
      importExportActions,
      templateForm,
      tagsSection,
      createElement('h6', {
        className: 'section-heading',
        text: t('listHeading'),
        style: 'margin-bottom: 12px;',
      }),
      createElement('ul', {
        id: 'tmpl-list',
        style:
          'list-style: none; padding: 0; margin-bottom: 0; display: flex; flex-direction: column; gap: 8px;',
      }),
    );

    return { root, wzInput };
  }

  // --- UI: Sidebar init ---
  function initSidebar() {
    if (typeof W === 'undefined' || !W.userscripts) return;
    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('UR-Tmpl');
    tabLabel.innerText = 'URRM';
    const { root, wzInput } = createSidebarContent();
    tabPane.replaceChildren(root);

    templateFormController = setupTemplateForm(tabPane, wzInput);
    const defaultLanguageSelect = tabPane.querySelector('#template-language-select');
    if (defaultLanguageSelect) defaultLanguageSelect.value = lang;

    const tagDefaults = setupTagDefaultsSection(tabPane);

    setupImportExport(tabPane, () => {
      userDefaultValues = getUserDefaultValues(activeDefaultLanguage);
      tagDefaults.refresh();
      renderSidebarList(tabPane);
    });

    renderSidebarList(tabPane);
    tagDefaults.refresh();
  }

  // --- Bootstrap ---
  function bootstrap() {
    if (typeof W === 'undefined' || !W.userscripts) {
      setTimeout(bootstrap, 500);
      return;
    }

    initializeStorage();
    if (!wmeSDK && typeof getWmeSdk === 'function') {
      try {
        wmeSDK = getWmeSdk({
          scriptId: 'wme-ur-reply-manager',
          scriptName: 'WME UR Reply Manager',
        });
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} WME SDK initialization failed; segment lookup unavailable:`,
          err,
        );
      }
    }
    initSidebar();
    injectTrigger();

    let injectScheduled = false;
    const scheduleInjectTrigger = () => {
      if (injectScheduled) return;
      injectScheduled = true;
      requestAnimationFrame(() => {
        injectScheduled = false;
        injectTrigger();
      });
    };

    const observer = new MutationObserver(scheduleInjectTrigger);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  bootstrap();
})();
