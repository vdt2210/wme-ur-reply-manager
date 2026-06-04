// ==UserScript==
// @name            WME UR Reply Manager
// @name:vi         Trình quản lý phản hồi WME UR
// @version         1.1.1-beta
// @description     Manage and quickly insert UR reply templates in WME
// @description:vi  Quản lý và chèn nhanh các mẫu trả lời UR trong WME
// @author          vdt2210
// @namespace       https://greasyfork.org/en/users/1603731-vdt2210
// @license         MIT
// @include         /^https:\/\/(www|beta)\.waze\.com\/(?!user\/)(.{2,6}\/)?editor\/?.*$/
// @grant           none
// @downloadURL     https://update.greasyfork.org/scripts/579002/WME%20UR%20Reply%20Manager.user.js
// @updateURL       https://update.greasyfork.org/scripts/579002/WME%20UR%20Reply%20Manager.meta.js
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
      existsName: 'This name already exists!',
      exportBtn: 'Export',
      importBtn: 'Import',
      importError: 'Invalid file format!',
      importSuccess: 'Templates imported successfully!',
      insert: 'Insert',
      labelContent: 'Content',
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
      tagCoords: 'GPS coordinates (latitude, longitude)',
      tagReporter: 'Name of the person who reported this UR',
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
      insert: 'Chèn',
      labelContent: 'Nội dung',
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
      tagCoords: 'Tọa độ GPS (vĩ độ, kinh độ)',
      tagReporter: 'Tên người báo cáo UR',
      tagsHeading: 'Các thẻ sẵn có',
      tagsHint:
        "Thẻ: Ưu tiên điền Dữ liệu thực tế ➜ Cấu hình cá nhân ➜ Mặc định. Mẹo ép giá trị riêng: dùng {tag | 'mặc định'} (Ví dụ: {reporter | 'Người báo cáo'}).",
      tagStreet: 'Tên đường được báo cáo',
      triggerBtn: 'Chọn mẫu',
      updateSuccess: 'Mẫu đã được cập nhật thành công!',
    },
  };

  // --- Constants ---
  const TagKey = Object.freeze({
    CITY: 'city',
    COORDS: 'coords',
    REPORTER: 'reporter',
    STREET: 'street',
  });

  const TAG_KEYS = Object.values(TagKey);

  const TAG_LABEL_KEYS = {
    [TagKey.CITY]: 'tagCity',
    [TagKey.COORDS]: 'tagCoords',
    [TagKey.REPORTER]: 'tagReporter',
    [TagKey.STREET]: 'tagStreet',
  };

  function debugLog(...args) {
    if (DEBUG) {
      console.debug(...args);
    }
  }

  const defaultValueKeys = {
    city: '',
    coords: '',
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
  const t = (key) => translations[lang][key] || key;

  /**
   * @typedef {Object} UserConfigs
   * @property {Object.<TagKey, string>} [userDefaultValues]
   */

  /**
   * @typedef {Object} TemplateItem
   * @property {string} id
   * @property {string} name
   * @property {string} content
   * @property {boolean} [isFavorite]
   * @property {number} createdDate
   * @property {number} updatedDate
   */

  /**
   * @typedef {Object} AppStorageData
   * @property {UserConfigs} [configs]
   * @property {TemplateItem[]} [templates]
   */

  // --- Storage ---
  const OLD_STORAGE_KEY = 'wme_ur_reply_templates';
  const STORAGE_KEY = 'wme_ur_reply_manager';
  const DEFAULT_STORAGE = {
    configs: {
      userDefaultValues: {},
    },
    templates: [],
  };

  // ----- LEGACY BACKUP (remove in next release) -----
  // Migrates localStorage `wme_ur_reply_templates` (bare TemplateItem[]).
  function migrateOldData() {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldData) return;

    try {
      /** @type {TemplateItem[]} */
      const parsed = JSON.parse(oldData);
      if (!Array.isArray(parsed)) return;

      /** @type {AppStorageData} */
      const newData = {
        ...getStorageData(),
        templates: parsed,
      };

      setStorageData(newData);
      localStorage.removeItem(OLD_STORAGE_KEY);
    } catch (err) {
      console.warn(`${LOG_PREFIX} Failed to parse old data:`, err);
    }
  }
  // ----- END LEGACY BACKUP (remove in next release) -----

  function initializeStorage() {
    if (!localStorage.getItem(STORAGE_KEY)) {
      setStorageData(DEFAULT_STORAGE);
    }
  }

  /**
   * @returns {AppStorageData}
   */
  const getStorageData = () => {
    try {
      const rawData = localStorage.getItem(STORAGE_KEY);

      if (!rawData) return DEFAULT_STORAGE;

      const data = JSON.parse(rawData);

      return {
        configs: {
          ...data?.configs,
        },
        templates: data?.templates || [],
      };
    } catch (err) {
      console.warn(
        `${LOG_PREFIX} Storage data is corrupted or invalid, falling back to default structure:`,
        err,
      );
      return DEFAULT_STORAGE;
    }
  };

  const setStorageData = (data) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  };

  // --- App state ---
  let editingTemplateId = null;

  // --- Tag default values (storage overrides vs script i18n defaults) ---
  /** @returns {Record<TagKey, string>} */
  const getScriptDefaultValues = () =>
    Object.fromEntries(
      TAG_KEYS.map((key) => [key, defaultValueKeys[key] ? t(defaultValueKeys[key]) : '']),
    );

  /** @returns {Partial<Record<TagKey, string>>} */
  const getStoredUserDefaultValues = () => {
    const stored = getStorageData()?.configs?.userDefaultValues;
    return stored && typeof stored === 'object' ? stored : {};
  };

  /**
   * Effective display values: stored override per key, else script default.
   * @returns {Record<TagKey, string>}
   */
  const getUserDefaultValues = () => {
    const scriptDefaults = getScriptDefaultValues();
    const stored = getStoredUserDefaultValues();

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
   * Trims inputs in place; returns only keys with non-empty values that differ from script defaults.
   * @param {NodeListOf<Element> | Element[]} inputs
   * @returns {Partial<Record<TagKey, string>>}
   */
  const buildStoredValuesFromInputs = (inputs) => {
    const scriptDefaults = getScriptDefaultValues();
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

  const saveUserDefaultValues = (values) => {
    /** @type {AppStorageData} */
    const existingData = getStorageData();
    existingData.configs.userDefaultValues = values;
    setStorageData(existingData);
  };

  const hasStoredUserDefaultValues = () => Object.keys(getStoredUserDefaultValues()).length > 0;

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

  async function getSegmentDetailByLatLon(lat, lon) {
    if (typeof W === 'undefined' || !W.model || !W.model.segments) {
      return null;
    }

    function getDistance(x, y, x1, y1, x2, y2) {
      const A = x - x1,
        B = y - y1,
        C = x2 - x1,
        D = y2 - y1;
      const dot = A * C + B * D,
        lenSq = C * C + D * D;
      let param = lenSq !== 0 ? dot / lenSq : -1;
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
      return Math.sqrt((x - xx) ** 2 + (y - yy) ** 2);
    }

    for (let attempt = 0; attempt < SEGMENT_SEARCH.NUMBER_OF_RETRIES; attempt++) {
      try {
        const segments = W.model.segments.getObjectArray();

        if (!segments || segments.length === 0) {
          debugLog(
            `${LOG_PREFIX} Cache empty, attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}. Waiting ${SEGMENT_SEARCH.RETRY_DELAY_MS}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, SEGMENT_SEARCH.RETRY_DELAY_MS));
          continue;
        }

        const lonlat = new OpenLayers.LonLat(lon, lat).transform(
          new OpenLayers.Projection('EPSG:4326'),
          W.map.getProjectionObject(),
        );
        const pX = lonlat.lon;
        const pY = lonlat.lat;
        const candidates = [];

        segments.forEach((seg) => {
          const segAttrs = seg?.attributes || {};
          const components = segAttrs.geometry?.components;
          if (!components || components.length < 2) return;

          let segmentMinDist = Infinity;
          for (let i = 0; i < components.length - 1; i++) {
            const dist = getDistance(
              pX,
              pY,
              components[i].x,
              components[i].y,
              components[i + 1].x,
              components[i + 1].y,
            );
            if (dist < segmentMinDist) {
              segmentMinDist = dist;
            }
          }

          if (segmentMinDist <= SEGMENT_SEARCH.MAX_DIST_METERS) {
            candidates.push({
              segment: seg,
              distance: segmentMinDist,
            });
          }
        });

        if (candidates.length > 0) {
          candidates.sort((a, b) => a.distance - b.distance);

          const matchedSegment = candidates[0].segment;
          const streetId = matchedSegment.attributes?.primaryStreetID;

          if (streetId) {
            const streetModel = W.model.streets?.get?.(streetId);
            const streetAttrs = streetModel?.attributes || {};

            const cityId = streetAttrs.cityID;
            const cityModel = cityId ? W.model.cities?.get?.(cityId) : null;
            const cityAttrs = cityModel?.attributes || {};

            const segmentDetails = {
              streetName: streetAttrs.name || '',
              cityName: cityAttrs.name || '',
            };

            debugLog(
              `${LOG_PREFIX} Segment founded at attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}`,
              segmentDetails,
            );

            return segmentDetails;
          }
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} Error on attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}:`,
          err.message,
        );
      }

      debugLog(
        `${LOG_PREFIX} No matching segment found near coordinates, attempt ${attempt + 1}/${SEGMENT_SEARCH.NUMBER_OF_RETRIES}. Waiting ${SEGMENT_SEARCH.RETRY_DELAY_MS}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, SEGMENT_SEARCH.RETRY_DELAY_MS));
    }

    debugLog(
      `${LOG_PREFIX} Timeout reached. No segment found within ${SEGMENT_SEARCH.MAX_DIST_METERS}m.`,
    );
    return null;
  }

  async function fetchCurrentURData() {
    let cityName = '';
    let coords = '';
    let reporter = '';
    let streetName = '';

    try {
      const panelEl = document.querySelector('.problem-edit');
      if (panelEl) {
        const reactKey = Object.keys(panelEl).find(
          (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'),
        );
        const fiber = panelEl[reactKey];

        const targetChild = fiber?.memoizedProps?.children?.[0];
        const adapter = targetChild?.props?.model?.attributes?.adapter;
        const attrs = adapter?.problem?.attributes || adapter?.attributes?.attributes;

        if (attrs) {
          if (attrs.createdBy) {
            const userId = attrs.createdBy;

            if (typeof W !== 'undefined' && W.model && W.model.users) {
              const userModelAttrs = W.model.users.get(Number(userId))?.attributes;
              if (userModelAttrs && userModelAttrs.userName) {
                reporter = userModelAttrs.userName.trim();
              }
            }
          }

          if (attrs.cityName) {
            cityName = String(attrs.cityName).trim();
          }

          if (attrs.geoJSONGeometry && Array.isArray(attrs.geoJSONGeometry.coordinates)) {
            const lon = parseFloat(attrs.geoJSONGeometry.coordinates[0]);
            const lat = parseFloat(attrs.geoJSONGeometry.coordinates[1]);

            if (!isNaN(lat) && !isNaN(lon)) {
              coords = `${lat}, ${lon}`;

              const segmentDetail = await getSegmentDetailByLatLon(lat, lon);
              if (segmentDetail) {
                streetName = segmentDetail.streetName.trim();

                if (!cityName && segmentDetail.cityName) {
                  cityName = segmentDetail.cityName.trim();
                }
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn(`${LOG_PREFIX} Error extracting data:`, err.message);
    }

    cachedURData = {
      [TagKey.CITY]: cityName,
      [TagKey.COORDS]: coords,
      [TagKey.REPORTER]: reporter,
      [TagKey.STREET]: streetName,
    };
  }

  function processTemplateContent(content) {
    const dataMap = Object.fromEntries(TAG_KEYS.map((tag) => [tag, cachedURData[tag]]));
    const effectiveDefaults = getUserDefaultValues();

    const tagRegex = /\{([\w]+)(?:\s*\|\s*['"]([^'"]*)['"])?\}/g;

    let processed = content.replace(tagRegex, (match, tagName, inlineDefault) => {
      const liveValue = dataMap[tagName];
      if (liveValue) return liveValue;

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
    el.setAttribute('disabled', disabled);
  }

  function scrollSidebarTabToTop(tabPane) {
    for (let el = tabPane; el; el = el.parentElement) {
      const { overflowY } = getComputedStyle(el);
      if ((overflowY === 'auto' || overflowY === 'scroll') && el.scrollHeight > el.clientHeight) {
        if (typeof el.scrollTo === 'function') {
          el.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          el.scrollTop = 0;
        }
        return;
      }
    }
    tabPane.scrollTop = 0;
  }

  function fillTextToWaze(targetEl, value) {
    if (targetEl) {
      targetEl.value = value;
      targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  }

  // --- UI: Shared styles ---
  const style = document.createElement('style');
  style.innerHTML = `
        #tmpl-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: var(--background_modal, rgba(32, 33, 36, 0.6)); z-index: 99999; display: flex; align-items: center; justify-content: center; }
        #tmpl-modal-box { background: var(--background_default, #ffffff); width: 500px; border-radius: 8px; }
        .tmpl-section { padding-bottom: 14px; margin-bottom: 14px; border-bottom: 1px dashed var(--content_divider, #d9d9d9); }
        .section-heading { margin: 0; }
    `;
  document.head.appendChild(style);

  // --- UI: Insert template modal ---
  function openModal(targetTextarea) {
    const templates = getTemplates();
    if (templates.length === 0) {
      alert(t('noTemplates'));
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'tmpl-modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'tmpl-modal-title');
    overlay.tabIndex = -1;

    overlay.innerHTML = `
        <div id="tmpl-modal-box">
          <div class="modal-header" style="padding: 15px 20px;">
            <h5 id="tmpl-modal-title" class="modal-title">${t('modalTitle')}</h5>
          </div>

          <div class="modal-body">
            <wz-select id="tmpl-select" label="${t('labelName')}" style="width:100%; margin-bottom: 10px; display: block;">
                ${templates.map((tmpl) => `<wz-option value="${tmpl.id}">${tmpl.name}</wz-option>`).join('')}
            </wz-select>

            <wz-label>${t('labelContent')}</wz-label>
            <div id="wz-preview-wrapper"></div>
          </div>

          <div class="modal-footer" style="padding: 15px 20px;">
            <div style="display: flex; justify-content: flex-end; gap: 10px;">
                <wz-button id="btn-close" size="md" color="secondary">${t('close')}</wz-button>
                <wz-button id="btn-insert" color="primary" size="md">${t('insert')}</wz-button>
            </div>
          </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const previousActiveElement = document.activeElement;

    function closeModal() {
      try {
        overlay.removeEventListener('keydown', keydownHandler);
      } catch (e) {}
      overlay.remove();
      try {
        if (previousActiveElement && typeof previousActiveElement.focus === 'function')
          previousActiveElement.focus();
      } catch (e) {}
    }

    function keydownHandler(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeModal();
        return;
      }
    }

    overlay.addEventListener('keydown', keydownHandler);

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

    wzPreview.value = processTemplateContent(templates[0].content);

    // Wait for shadow DOM ready
    setTimeout(() => {
      if (wzPreview.shadowRoot) {
        const innerTextarea = wzPreview.shadowRoot.querySelector('.wz-textarea textarea');

        if (innerTextarea) {
          innerTextarea.style.cursor = 'default';
          innerTextarea.style.color = 'var(--content_default)';
        }
      }
    }, 0);

    overlay.querySelector('#wz-preview-wrapper').appendChild(wzPreview);

    wzSelect.addEventListener('change', () => {
      const selectedId = wzSelect.value;
      const selectedTemplate = templates.find((tmpl) => tmpl.id === selectedId);
      wzPreview.value = processTemplateContent(selectedTemplate.content);
    });

    overlay.querySelector('#btn-close').onclick = () => closeModal();

    overlay.querySelector('#btn-insert').onclick = () => {
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
        btn.setAttribute('busy', '');
        btn.setAttribute('disabled', '');
        await fetchCurrentURData();
        openModal(wzTA);
        btn.removeAttribute('busy');
        btn.removeAttribute('disabled');
      };
      form.insertBefore(btn, wzTA);
    });
  }

  // --- UI: Template list (sidebar) ---
  function renderSidebarList(tabPane) {
    const list = tabPane.querySelector('#tmpl-list');
    list.innerHTML = '';
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

      const favBtn = document.createElement('wz-button');
      favBtn.className = 'fav-btn';
      favBtn.dataset.id = tmpl.id;
      favBtn.setAttribute('color', 'clear-icon');
      favBtn.setAttribute('size', 'sm');
      favBtn.innerHTML = `<i class="w-icon ${tmpl.isFavorite ? 'w-icon-star-fill' : 'w-icon-star'}" style="color: ${tmpl.isFavorite ? 'var(--cautious)' : ''}"></i>`;

      const editBtn = document.createElement('wz-button');
      editBtn.className = 'edit-btn';
      editBtn.dataset.id = tmpl.id;
      editBtn.setAttribute('color', 'clear-icon');
      editBtn.setAttribute('size', 'sm');
      editBtn.innerHTML = '<i class="w-icon w-icon-pencil"></i>';

      const delBtn = document.createElement('wz-button');
      delBtn.className = 'del-btn';
      delBtn.dataset.id = tmpl.id;
      delBtn.setAttribute('color', 'clear-icon');
      delBtn.setAttribute('size', 'sm');
      delBtn.innerHTML = '<i class="w-icon w-icon-trash"></i>';

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
          const contentTextarea = tabPane.querySelector('#content-textarea');
          const submitBtn = tabPane.querySelector('#submit-btn');
          const cancelBtn = tabPane.querySelector('#cancel-btn');

          editingTemplateId = targetId;

          if (nameInput && contentTextarea && submitBtn && cancelBtn) {
            nameInput.value = target.name;
            contentTextarea.value = target.content;
            submitBtn.innerText = t('saveBtn');
            cancelBtn.style.display = '';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
          }

          scrollSidebarTabToTop(tabPane);
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
  function renderTagsSection(tabPane, onValueChange) {
    const container = tabPane.querySelector('#tmpl-tags-list');
    if (!container) return;

    container.innerHTML = '';
    const scriptDefaults = getScriptDefaultValues();

    TAG_KEYS.forEach((tagKey) => {
      const tagValue = `{${tagKey}}`;
      const displayValue = userDefaultValues[tagKey] || '';

      const itemDiv = document.createElement('div');

      const tagDisplayDiv = document.createElement('div');
      tagDisplayDiv.style.cssText = 'font-size: 12px; margin-bottom: 6px;';

      const code = document.createElement('code');
      code.style.cssText = 'background-color: var(--background_variant, #f2f4f7);';
      code.textContent = tagValue;

      const span = document.createElement('span');
      span.textContent = t(TAG_LABEL_KEYS[tagKey]);

      tagDisplayDiv.appendChild(code);
      tagDisplayDiv.appendChild(document.createTextNode(' - '));
      tagDisplayDiv.appendChild(span);

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

      const resetBtn = document.createElement('wz-button');
      resetBtn.setAttribute('color', 'clear-icon');
      resetBtn.setAttribute('size', 'sm');
      resetBtn.className = 'default-value-reset-btn';
      resetBtn.setAttribute('title', t('resetBtn'));
      resetBtn.dataset.tag = tagKey;
      resetBtn.style.display = 'none';
      resetBtn.innerHTML = '<i class="w-icon w-icon-x"></i>';

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

      itemDiv.appendChild(tagDisplayDiv);
      itemDiv.appendChild(label);
      itemDiv.appendChild(inputDiv);
      container.appendChild(itemDiv);
    });
  }

  // --- UI: Sidebar — template add/edit form ---
  function setupTemplateForm(tabPane, wzInput) {
    const nameInput = tabPane.querySelector('#name-input');
    const submitBtn = tabPane.querySelector('#submit-btn');
    const cancelBtn = tabPane.querySelector('#cancel-btn');

    const resetEditState = () => {
      editingTemplateId = null;
      submitBtn.innerText = t('addBtn');
      nameInput.value = '';
      wzInput.value = '';
      setBtnDisabled(submitBtn, true);
      cancelBtn.style.display = 'none';
    };

    const validate = () => {
      const valid = nameInput.value.trim().length > 0 && wzInput.value.trim().length > 0;
      setBtnDisabled(submitBtn, !valid);
    };

    nameInput.addEventListener('input', validate);
    wzInput.addEventListener('input', validate);

    cancelBtn.onclick = () => {
      if (editingTemplateId && !confirm(t('cancelEdit'))) return;
      resetEditState();
    };

    submitBtn.onclick = () => {
      const name = nameInput.value.trim();
      const content = wzInput.value.trim();
      if (!name || !content) return;

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
  }

  // --- UI: Sidebar — tag default values ---
  function setupTagDefaultsSection(tabPane) {
    const saveAllBtn = tabPane.querySelector('#default-values-save-all-btn');
    const cancelAllBtn = tabPane.querySelector('#default-values-cancel-all-btn');
    const resetAllBtn = tabPane.querySelector('#default-values-reset-all-btn');

    const tagInputsHaveUnsavedChanges = (inputs) => {
      for (const input of inputs) {
        const baseline = userDefaultValues[input.dataset.tag] || '';
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
      setBtnDisabled(resetAllBtn, !hasStoredUserDefaultValues());
    };

    const refresh = () => {
      renderTagsSection(tabPane, checkForChanges);
      checkForChanges();
      syncResetAllBtn();
    };

    saveAllBtn.onclick = () => {
      const inputs = tabPane.querySelectorAll('.default-value-input');
      saveUserDefaultValues(buildStoredValuesFromInputs(inputs));
      userDefaultValues = getUserDefaultValues();
      refresh();
      alert(t('defaultsSaved'));
    };

    resetAllBtn.onclick = () => {
      if (!confirm(t('confirmResetAllDefaults'))) return;
      saveUserDefaultValues({});
      userDefaultValues = getUserDefaultValues();
      refresh();
      alert(t('defaultsResetSuccess'));
    };

    cancelAllBtn.onclick = () => {
      const inputs = tabPane.querySelectorAll('.default-value-input');
      if (tagInputsHaveUnsavedChanges(inputs) && !confirm(t('cancelEdit'))) return;
      inputs.forEach((input) => {
        input.value = userDefaultValues[input.dataset.tag] || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    };

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

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          let newStorageData = { templates: [], configs: {} };

          if (importedData && typeof importedData === 'object' && !Array.isArray(importedData)) {
            if (Array.isArray(importedData.templates)) {
              newStorageData.templates = importedData.templates;
            }
            if (importedData.configs && typeof importedData.configs === 'object') {
              newStorageData.configs = importedData.configs;
            }
          } else {
            // ----- LEGACY BACKUP import (remove in next release) -----
            // Accepts export files that were a bare TemplateItem[] JSON array.
            if (!Array.isArray(importedData)) {
              alert(t('importError'));
              return;
            }
            newStorageData.templates = importedData;
            // ----- END LEGACY BACKUP import (remove in next release) -----
          }

          if (!newStorageData.templates.length) {
            alert(t('importError'));
            return;
          }

          const currentData = getStorageData();
          const mergedTemplates = [
            ...new Map(
              [...(currentData.templates || []), ...newStorageData.templates].map((item) => [
                item.id,
                item,
              ]),
            ).values(),
          ];

          setStorageData({
            templates: mergedTemplates,
            configs: { ...currentData.configs, ...newStorageData.configs },
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

  // --- UI: Sidebar init ---
  function initSidebar() {
    if (typeof W === 'undefined' || !W.userscripts) return;
    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('UR-Tmpl');
    tabLabel.innerText = 'URRM';
    tabPane.innerHTML = `
            <div style="padding: 10px 20px;">
              <div style="text-align: center; margin-bottom: 8px;">
                <h6 style="margin-top:0">WME UR Reply Manager</h6>
              </div>

              <div style="display: flex; gap: 8px; margin-bottom: 12px; width: 100%;">
                <wz-button id="export-tmpl" color="secondary" size="md" style="flex: 1;">${t('exportBtn')}</wz-button>
                <wz-button id="import-tmpl" color="secondary" size="md" style="flex: 1;">${t('importBtn')}</wz-button>
                <input type="file" id="import-file" style="display: none;" accept=".txt" />
              </div>

              <div class="tmpl-section">
                <wz-label html-for="name-input">${t('labelName')}</wz-label>
                <wz-text-input id="name-input" name="wz-text-input-template-name" placeholder="${t('placeholderName')}" autocomplete="off" type="text" size="md" maxlength="100"></wz-text-input>

                <div id="wz-input-wrapper" style="margin-top:10px;"></div>

                <div style="margin-top:10px; display: flex; justify-content: flex-end; gap: 8px;">
                  <wz-button id="cancel-btn" color="secondary" size="md" style="display: none;">${t('cancelBtn')}</wz-button>
                  <wz-button id="submit-btn" color="primary" size="md" disabled>${t('addBtn')}</wz-button>
                </div>
              </div>

              <div id="tags-section" class="tmpl-section">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-bottom: 12px;">
                  <h6 class="section-heading">${t('tagsHeading')}</h6>
                </div>

                <div id="tmpl-tags-list" style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; max-height: 400px; overflow-y: auto;"></div>

                <small style="display: block; margin-bottom: 12px;">${t('tagsHint')}</small>

                <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <wz-button id="default-values-cancel-all-btn" color="secondary" size="md" style="display: none;">${t('cancelBtn')}</wz-button>
                  <wz-button id="default-values-reset-all-btn" color="secondary" size="md" disabled>${t('resetAllBtn')}</wz-button>
                  <wz-button id="default-values-save-all-btn" color="primary" size="md" style="display: none;">${t('saveBtn')}</wz-button>
                </div>
              </div>

              <h6 class="section-heading" style="margin-bottom: 12px;">${t('listHeading')}</h6>

              <ul id="tmpl-list" style="list-style: none; padding: 0; margin-bottom: 0; display: flex; flex-direction: column; gap: 8px;"></ul>
            </div>
        `;
    const wzInput = document.createElement('wz-textarea');
    setWzTextareaAttributes(
      wzInput,
      'content-textarea',
      'wz-textarea-content',
      t('placeholderContent'),
      true,
    );

    const contentLabel = document.createElement('wz-label');
    contentLabel.innerText = t('labelContent');
    contentLabel.style.display = 'block';
    contentLabel.style.marginBottom = '5px';

    const wrapper = tabPane.querySelector('#wz-input-wrapper');
    wrapper.parentNode.insertBefore(contentLabel, wrapper);
    wrapper.appendChild(wzInput);

    setupTemplateForm(tabPane, wzInput);

    const tagDefaults = setupTagDefaultsSection(tabPane);

    setupImportExport(tabPane, () => {
      userDefaultValues = getUserDefaultValues();
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
    migrateOldData(); // LEGACY BACKUP — remove in next release
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
