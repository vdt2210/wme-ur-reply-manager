// ==UserScript==
// @name            WME UR Reply Manager
// @name:vi         Trình quản lý phản hồi WME UR
// @version         1.0.1-beta
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

  // --- I18N Logic ---
  const translations = {
    en: {
      modalTitle: 'Select reply template',
      close: 'Close',
      insert: 'Insert',
      noTemplates: 'No templates yet!',
      triggerBtn: 'Select template',
      placeholderName: 'Enter template name...',
      addBtn: 'Add',
      saveBtn: 'Save',
      cancelBtn: 'Cancel',
      listHeading: 'List',
      placeholderContent: 'Enter content...',
      confirmDelete: 'Are you sure you want to delete this template?',
      labelName: 'Name',
      labelContent: 'Content',
      importBtn: 'Import',
      exportBtn: 'Export',
      importSuccess: 'Templates imported successfully!',
      importError: 'Invalid file format!',
      existsName: 'This name already exists!',
      addSuccess: 'Template added successfully!',
      updateSuccess: 'Template updated successfully!',
      cancelEdit: 'Discard changes?',
      defaultReporterText: 'reporter',
    },
    vi: {
      modalTitle: 'Chọn mẫu trả lời',
      close: 'Đóng',
      insert: 'Chèn',
      noTemplates: 'Chưa có mẫu nào!',
      triggerBtn: 'Chọn mẫu',
      placeholderName: 'Nhập tên mẫu...',
      addBtn: 'Thêm',
      saveBtn: 'Lưu',
      cancelBtn: 'Hủy',
      listHeading: 'Danh sách',
      placeholderContent: 'Nhập nội dung...',
      confirmDelete: 'Bạn có chắc muốn xóa mẫu này?',
      labelName: 'Tên mẫu',
      labelContent: 'Nội dung',
      importBtn: 'Nhập',
      exportBtn: 'Xuất',
      importSuccess: 'Đã nhập danh sách mẫu thành công!',
      importError: 'Định dạng file không hợp lệ!',
      existsName: 'Tên mẫu này đã tồn tại!',
      addSuccess: 'Mẫu đã được thêm thành công!',
      updateSuccess: 'Mẫu đã được cập nhật thành công!',
      cancelEdit: 'Hủy thay đổi?',
      defaultReporterText: 'người báo cáo',
    },
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

  // --- Logic ---
  const STORAGE_KEY = 'wme_ur_reply_templates';
  let editingTemplateId = null;

  let cachedURData = { reporter: '', coords: '', streetName: '', cityName: '' };

  const getTemplates = () => {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]').sort((a, b) => {
      if (a.isFavorite === b.isFavorite) {
        return b.createdDate - a.createdDate;
      }
      return a.isFavorite ? -1 : 1;
    });
    return data;
  };

  const saveTemplates = (arr) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
  };

  function setWzTextareaAttributes(el, id, name, placeholder = '', showLength = true) {
    el.setAttribute('id', id);
    el.setAttribute('name', name);
    el.setAttribute('maxlength', '2000');
    el.setAttribute('display-maxlength', showLength);
    el.setAttribute('placeholder', placeholder);
  }

  function fillTextToWaze(targetEl, value) {
    if (targetEl) {
      targetEl.value = value;
      targetEl.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    }
  }

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

    const MAX_DIST_METERS = 10;
    const NUMBER_OF_RETRIES = 6;
    const RETRY_DELAY_MS = 500;

    for (let attempt = 0; attempt < NUMBER_OF_RETRIES; attempt++) {
      try {
        const segments = W.model.segments.getObjectArray();

        if (!segments || segments.length === 0) {
          console.info(
            `${LOG_PREFIX} Cache empty, attempt ${attempt + 1}/${NUMBER_OF_RETRIES}. Waiting ${RETRY_DELAY_MS}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
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

          if (segmentMinDist <= MAX_DIST_METERS) {
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

            console.info(
              `${LOG_PREFIX} Segment founded at attempt ${attempt + 1}/${NUMBER_OF_RETRIES}`,
              segmentDetails,
            );

            return segmentDetails;
          }
        }
      } catch (err) {
        console.warn(
          `${LOG_PREFIX} Error on attempt ${attempt + 1}/${NUMBER_OF_RETRIES}:`,
          err.message,
        );
      }

      console.info(
        `${LOG_PREFIX} No matching segment found near coordinates, attempt ${attempt + 1}/${NUMBER_OF_RETRIES}. Waiting ${RETRY_DELAY_MS}ms...`,
      );
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }

    console.info(`${LOG_PREFIX} Timeout reached. No segment found within ${MAX_DIST_METERS}m.`);
    return null;
  }

  //TODO add option for user can change by their own default text
  async function fetchCurrentURData() {
    let reporter = '';
    let coords = '';
    let streetName = '';
    let cityName = '';

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

    if (!reporter) {
      reporter = t('defaultReporterText');
    }

    cachedURData = { reporter, coords, streetName, cityName };
  }

  function processTemplateContent(content) {
    let processed = content;
    processed = processed.replace(/{coords}/g, cachedURData.coords || '');
    processed = processed.replace(/{reporter}/g, cachedURData.reporter);
    processed = processed.replace(/{street}/g, cachedURData.streetName || '');
    processed = processed.replace(/{city}/g, cachedURData.cityName || '');

    processed = processed
      .replace(/\(\s*\)/g, '')
      .replace(/([,.;\-\/])\s*([,.;\-\/])/g, '$1')
      .replace(/[,.;\-\/]\s*$/, '')
      .replace(/^[,.;\-\/]\s*/, '')
      .replace(/\s+/g, ' ')
      .trim();

    return processed;
  }

  // --- CSS ---
  const style = document.createElement('style');
  style.innerHTML = `
        #tmpl-modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: var(--background_modal, rgba(32, 33, 36, 0.6)); z-index: 99999; display: flex; align-items: center; justify-content: center; }
        #tmpl-modal-box { background: var(--background_default, #ffffff); width: 500px; border-radius: 8px; }
        .preview-read-only { pointer-events: none; }
    `;
  document.head.appendChild(style);

  function openModal(targetTextarea) {
    const templates = getTemplates();
    if (templates.length === 0) {
      alert(t('noTemplates'));
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'tmpl-modal-overlay';

    overlay.innerHTML = `
        <div id="tmpl-modal-box">
          <div class="modal-header" style="padding: 15px 20px;">
            <h5 class="modal-title">${t('modalTitle')}</h5>
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

    const wzSelect = overlay.querySelector('#tmpl-select');
    wzSelect.value = templates[0].id;

    const wzPreview = document.createElement('wz-textarea');
    setWzTextareaAttributes(wzPreview, 'content-preview', 'wz-textarea-preview', undefined, false);
    wzPreview.classList.add('preview-read-only');

    wzPreview.value = processTemplateContent(templates[0].content);
    overlay.querySelector('#wz-preview-wrapper').appendChild(wzPreview);

    wzSelect.addEventListener('change', () => {
      const selectedId = wzSelect.value;
      const selectedTemplate = templates.find((tmpl) => tmpl.id === selectedId);
      wzPreview.value = processTemplateContent(selectedTemplate.content);
    });

    overlay.querySelector('#btn-close').onclick = () => {
      overlay.remove();
    };

    overlay.querySelector('#btn-insert').onclick = () => {
      fillTextToWaze(targetTextarea, wzPreview.value);
      overlay.remove();
    };
  }

  function injectTrigger() {
    const panel = document.querySelector('wz-card.problem-edit');
    if (!panel) return;

    const forms = panel.querySelectorAll('form.new-comment-form');
    forms.forEach((form) => {
      if (form.querySelector('.btn-quick-reply')) return;

      const wzTA = form.querySelector('wz-textarea.new-comment-text');
      if (wzTA) {
        fetchCurrentURData();

        const btn = document.createElement('wz-button');
        btn.className = 'btn-quick-reply';
        btn.setAttribute('color', 'secondary');
        btn.setAttribute('size', 'md');
        btn.innerText = t('triggerBtn');
        btn.style.cssText = 'width: 100%; margin-bottom: 6px;';
        btn.onclick = (e) => {
          e.preventDefault();
          openModal(wzTA);
        };
        form.insertBefore(btn, wzTA);
      }
    });
  }

  function renderSidebarList(tabPane) {
    const list = tabPane.querySelector('#tmpl-list');
    list.innerHTML = '';
    getTemplates().forEach((t) => {
      const li = document.createElement('li');

      li.innerHTML = `
            <wz-card class="list-item-card" size="sm" elevation="0" elevation-on-hover="0" style="cursor: default;">
              <div class="list-item-card-layout" style="grid-template-columns: inherit;">
                <div class="list-item-card-info">
                  <div class="list-item-card-title" title="${t.name}">${t.name}</div>
                  <wz-caption title="${t.content}" style="overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
                    ${t.content}
                  </wz-caption>
                </div>

                <div class="list-item-card-actions" style="margin-bottom: 0; margin-right: 0; flex-direction: row; align-items: center;">
                  <wz-button class="fav-btn" data-id="${t.id}" color="clear-icon" size="sm">
                    <i class="w-icon ${t.isFavorite ? 'w-icon-star-fill' : 'w-icon-star'}" style="color: ${t.isFavorite ? 'var(--cautious)' : ''}"></i>
                  </wz-button>

                  <wz-button class="edit-btn" data-id="${t.id}" color="clear-icon" size="sm">
                    <i class="w-icon w-icon-pencil"></i>
                  </wz-button>

                  <wz-button class="del-btn" data-id="${t.id}" color="clear-icon" size="sm">
                    <i class="w-icon w-icon-trash"></i>
                  </wz-button>
                </div>
              </div>
            </wz-card>
            `;
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
          const nameInput = document.querySelector('#name-input');
          const contentTextarea = document.querySelector('#content-textarea');
          const submitBtn = document.querySelector('#submit-btn');
          const cancelBtn = document.querySelector('#cancel-btn');

          editingTemplateId = targetId;

          if (nameInput && contentTextarea && submitBtn && cancelBtn) {
            nameInput.value = target.name;
            contentTextarea.value = target.content;
            submitBtn.innerText = t('saveBtn');
            cancelBtn.style.display = '';
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
            contentTextarea.dispatchEvent(new Event('input', { bubbles: true }));
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

  function initSidebar() {
    if (typeof W === 'undefined' || !W.userscripts) return;
    const { tabLabel, tabPane } = W.userscripts.registerSidebarTab('UR-Tmpl');
    tabLabel.innerText = 'URRM';
    tabPane.innerHTML = `
            <div style="padding: 10px">
              <div style="text-align: center; margin-bottom: 8px;">
                <h6 style="margin-top:0">WME UR Reply Manager</h6>
              </div>

              <div style="margin-bottom: 8px;">
                <wz-label html-for="name-input">${t('labelName')}</wz-label>
                <wz-text-input id="name-input" name="wz-text-input-template-name" placeholder="${t('placeholderName')}" autocomplete="off" type="text" size="md" maxlength="100"></wz-text-input>

                <div id="wz-input-wrapper" style="margin-top:10px;"></div>

                <div style="margin-top:10px; display: flex; justify-content: flex-end; gap: 8px;">
                  <wz-button id="cancel-btn" color="secondary" size="md" style="display: none;">${t('cancelBtn')}</wz-button>
                  <wz-button id="submit-btn" color="primary" size="md" disabled>${t('addBtn')}</wz-button>
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <h6 style="margin: 0;">${t('listHeading')}</h6>

                <div style="display: flex; gap: 5px;">
                  <wz-button id="export-tmpl" color="secondary" size="sm">${t('exportBtn')}</wz-button>
                  <wz-button id="import-tmpl" color="secondary" size="sm">${t('importBtn')}</wz-button>
                  <input type="file" id="import-file" style="display: none;" accept=".txt" />
                </div>
              </div>

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

    const nameInput = tabPane.querySelector('#name-input');
    const submitBtn = tabPane.querySelector('#submit-btn');
    const cancelBtn = tabPane.querySelector('#cancel-btn');
    const exportBtn = tabPane.querySelector('#export-tmpl');
    const importBtn = tabPane.querySelector('#import-tmpl');
    const fileInput = tabPane.querySelector('#import-file');

    const resetEditState = () => {
      editingTemplateId = null;
      submitBtn.innerText = t('addBtn');
      nameInput.value = '';
      wzInput.value = '';
      submitBtn.setAttribute('disabled', '');
      cancelBtn.style.display = 'none';
    };

    const validate = () => {
      const hasName = nameInput.value.trim().length > 0;
      const hasContent = wzInput.value.trim().length > 0;
      if (hasName && hasContent) {
        submitBtn.removeAttribute('disabled');
      } else {
        submitBtn.setAttribute('disabled', '');
      }
    };

    nameInput.addEventListener('input', validate);
    wzInput.addEventListener('input', validate);

    // --- Cancel ---
    cancelBtn.onclick = () => {
      if (editingTemplateId) {
        if (confirm(t('cancelEdit'))) {
          resetEditState();
        }
      } else {
        resetEditState();
      }
    };

    // --- Submit ---
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
      submitBtn.setAttribute('disabled', '');
      renderSidebarList(tabPane);
    };

    // --- Export ---
    exportBtn.onclick = () => {
      const templates = getTemplates();
      const blob = new Blob([JSON.stringify(templates, null, 2)], {
        type: 'text/plain;charset=utf-8',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'wme_ur_reply_manager.txt';
      a.click();
      URL.revokeObjectURL(url);
    };

    // --- Import ---
    importBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const importedData = JSON.parse(event.target.result);
          if (Array.isArray(importedData)) {
            const currentData = getTemplates();
            const updatedData = [
              ...new Map([...currentData, ...importedData].map((item) => [item.id, item])).values(),
            ];

            saveTemplates(updatedData);
            renderSidebarList(tabPane);
            fileInput.value = '';
            alert(t('importSuccess'));
          } else {
            alert(t('importError'));
          }
        } catch (err) {
          console.warn(`${LOG_PREFIX} Import parsing failed:`, err);
          alert(t('importError'));
        }
      };
      reader.readAsText(file);
    };

    renderSidebarList(tabPane);
  }

  function bootstrap() {
    if (typeof W === 'undefined' || !W.userscripts) {
      setTimeout(bootstrap, 500);
      return;
    }

    initSidebar();
    injectTrigger();

    const observer = new MutationObserver(() => {
      injectTrigger();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  bootstrap();
})();
