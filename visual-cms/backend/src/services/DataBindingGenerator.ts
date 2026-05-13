/**
 * Генератор runtime скрипта для Data Binding на опубликованных страницах
 */

export interface FieldOverrideConfig {
  joinField: string
  values: Record<string, string | number>
  displayTemplate?: string // Шаблон отображения: "от {value} млн сум" → числовые значения форматируются при показе
}

export interface DataBindingConfig {
  blockId: string
  bindingId?: string // ID привязки для использования fetch-with-transforms API
  type: 'input' | 'output' | 'repeater'
  sourceAlias: string
  fieldMappings?: Array<{
    sourceField: string
    targetProperty: string
    transform?: string
  }>
  fieldOverrides?: Record<string, FieldOverrideConfig>
  // Динамические фильтры - получают значения из form-элементов
  dynamicFilters?: Array<{
    id: string
    sourceBlockId: string  // ID элемента (input/select) откуда брать значение
    field: string          // Поле данных для фильтрации
    operator: string       // Оператор сравнения (eq, gte, lte, etc)
    skipIfEmpty?: boolean  // Пропустить фильтр если значение пустое
  }>
  repeaterConfig?: {
    itemTemplate: string
    containerSelector: string
    collectionLink?: {
      basePath: string
      slugField: string
      linkSelector?: string
    }
    pagination?: {
      enabled: boolean
      pageSize: number
    }
  }
  outputConfig?: {
    trigger: 'submit' | 'click' | 'change' | 'blur' | 'interval' | 'custom'
    method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'
    endpoint?: string
    payloadMappings?: Array<{
      sourceField: string
      targetField: string
      type: 'direct' | 'static' | 'computed'
      value?: string
    }>
    validations?: Array<{
      field: string
      rules: Array<{
        type: string
        value?: string | number
        message?: string
      }>
    }>
    onSuccess?: {
      action: 'message' | 'redirect' | 'refresh' | 'reset' | 'hide' | 'custom'
      value?: string
    }
    onError?: {
      action: 'message' | 'retry' | 'custom'
      value?: string
      retryCount?: number
    }
  }
}

export interface PageDataSourceConfig {
  alias: string
  dataSourceId: string
  endpoint?: string
  loadStrategy: 'pageLoad' | 'onDemand' | 'interval'
  loadInterval?: number
  cacheEnabled: boolean
  cacheTTL?: number
  /** Тип источника. Для 'page-variable' данные не фетчатся, а берутся из _variables[variableName]. */
  type?: string
  /** Имя page-переменной (только для type='page-variable'). */
  variableName?: string
}

export interface PageDataConfig {
  dataSources: PageDataSourceConfig[]
  bindings: DataBindingConfig[]
  variables: Array<{
    name: string
    type: string
    defaultValue: unknown
  }>
}

/**
 * Генерирует runtime JavaScript для Data Binding
 */
export function generateDataBindingRuntime(config: PageDataConfig): string {
  if (!config.dataSources.length && !config.bindings.length && !config.variables.length) {
    return ''
  }

  return `
<!-- Visual CMS Data Binding Runtime -->
<script>
(function() {
  'use strict';
  
  // Variables store
  const _variables = ${JSON.stringify(
    config.variables.reduce((acc, v) => {
      acc[v.name] = v.defaultValue
      return acc
    }, {} as Record<string, unknown>)
  )};
  
  // Data store
  const _dataStore = {};
  
  // Data sources config
  const _dataSources = ${JSON.stringify(config.dataSources)};
  
  // Bindings config
  const _bindings = ${JSON.stringify(config.bindings)};
  
  // Collection context (injected by DeployService.deployCollection)
  const _collectionItem = ${JSON.stringify((config as any)._collectionItem || null)};
  const _collectionFilter = ${JSON.stringify((config as any)._collectionFilter || null)};
  const _collectionCacheTtl = ${(config as any)._collectionCacheTtl || 0};
  const _collectionPollInterval = ${(config as any)._collectionPollInterval || 0};
  
  // Variable getter/setter
  window.$var = function(name, value) {
    if (arguments.length === 1) {
      return _variables[name];
    }
    _variables[name] = value;
    updateBindings();
    return value;
  };
  
  // Data source getter
  window.$data = function(alias) {
    return _dataStore[alias] || null;
  };
  
  // Собрать значение из DOM элемента по его ID
  function getElementValue(elementId) {
    const element = document.querySelector('[data-element-id="' + elementId + '"]');
    if (!element) {
      console.log('[DynamicFilter] Element not found:', elementId);
      return null;
    }
    
    // Для select - получаем value
    if (element.tagName === 'SELECT') {
      var selectedOption = element.options[element.selectedIndex];
      // Если выбран placeholder (первый option без value или с пустым value) - считаем пустым
      if (!element.value || element.selectedIndex === 0 && (!selectedOption.value || selectedOption.disabled)) {
        return null;
      }
      return element.value;
    }
    
    // Для input
    if (element.tagName === 'INPUT') {
      // Checkbox/radio - возвращаем value только если checked
      if (element.type === 'checkbox' || element.type === 'radio') {
        return element.checked ? (element.value || element.textContent?.trim() || 'true') : null;
      }
      return element.value || null;
    }
    
    // Для textarea
    if (element.tagName === 'TEXTAREA') {
      return element.value || null;
    }
    
    // Для button - проверяем класс active / aria-pressed
    if (element.tagName === 'BUTTON') {
      var isActive = element.classList.contains('active') || element.getAttribute('aria-pressed') === 'true';
      return isActive ? (element.value || element.textContent?.trim() || null) : null;
    }
    
    // Для других элементов (div, span, option) - ищем вложенный input/select/checkbox
    var nestedCheckbox = element.querySelector('input[type="checkbox"], input[type="radio"]');
    if (nestedCheckbox) {
      return nestedCheckbox.checked ? (nestedCheckbox.value || element.textContent?.trim() || 'true') : null;
    }
    
    var nestedInput = element.querySelector('select, input, textarea');
    if (nestedInput) {
      if (nestedInput.tagName === 'SELECT') {
        return nestedInput.value || null;
      }
      return nestedInput.value || null;
    }
    
    // Для неинтерактивных элементов (div, span, p) - проверяем состояние "выбранности"
    // Если элемент имеет aria-checked, data-selected, или класс active/selected - считаем выбранным
    var isSelected = element.getAttribute('aria-checked') === 'true' 
      || element.getAttribute('aria-selected') === 'true'
      || element.dataset.selected === 'true'
      || element.dataset.checked === 'true'
      || element.classList.contains('active') 
      || element.classList.contains('selected');
    
    if (isSelected) {
      return element.textContent?.trim() || null;
    }
    
    // Неинтерактивный элемент без явного состояния - не возвращаем значение
    console.log('[DynamicFilter] Element is not interactive and not selected, skipping:', elementId, 'tag:', element.tagName);
    return null;
  }
  
  // Найти override-конфиг по имени поля фильтра.
  // Матчит точно ("price" == "price") или по суффиксу ("-price" в "project-price").
  function _findOverrideByField(fieldOverrides, filterField) {
    if (!fieldOverrides || !filterField) return null;
    if (fieldOverrides[filterField]) return fieldOverrides[filterField];
    var keys = Object.keys(fieldOverrides);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (k === filterField) return fieldOverrides[k];
      if (k.endsWith('-' + filterField) || k.endsWith('.' + filterField)) return fieldOverrides[k];
      if (filterField.endsWith('-' + k) || filterField.endsWith('.' + k)) return fieldOverrides[k];
    }
    return null;
  }
  
  // Собрать динамические фильтры из DOM
  function collectDynamicFilters(binding) {
    if (!binding.dynamicFilters || binding.dynamicFilters.length === 0) {
      return [];
    }
    
    var filters = [];
    binding.dynamicFilters.forEach(function(df) {
      // Пропускаем фильтры без sourceBlockId или field
      if (!df.sourceBlockId || !df.field) {
        return;
      }
      // Пропускаем поля с override — они фильтруются client-side в renderRepeater
      // Матчим точно или по суффиксу: "price" совпадёт с ключом "project-price"
      if (binding.fieldOverrides && _findOverrideByField(binding.fieldOverrides, df.field)) {
        return;
      }
      
      var value = getElementValue(df.sourceBlockId);
      console.log('[DynamicFilter] Collecting:', df.field, '=', value, 'from element:', df.sourceBlockId);
      
      // По умолчанию skipIfEmpty = true (пропускаем пустые/null значения)
      var shouldSkipEmpty = df.skipIfEmpty !== false;
      if (shouldSkipEmpty && (value === null || value === '' || value === undefined)) {
        console.log('[DynamicFilter] Skipping empty filter for field:', df.field);
        return;
      }
      
      // Для динамических фильтров с оператором eq - используем contains для частичного совпадения
      // (значение "Юнусабад" найдёт "Ташкент, Юнусабадский район", "2025" найдёт "2025 Q2")
      var operator = df.operator;
      if (operator === 'eq' && typeof value === 'string' && value.length > 0) {
        // Если значение не UUID - используем contains
        if (!value.match(/^[0-9a-f-]{36}$/i)) {
          operator = 'contains';
          console.log('[DynamicFilter] Upgraded operator from eq to contains for value:', value);
        }
      }
      
      // Если задан populateFrom — используем его как реальное поле в API (df.field = "location", populateFrom = "houses[0].address")
      var apiField = df.populateFrom || df.field;
      
      filters.push({
        field: apiField,
        operator: operator,
        value: value
      });
    });
    
    // Объединяем несколько contains-фильтров одного поля в containsAny (OR вместо AND)
    // Например: completion contains "2026" + completion contains "2027" → completion containsAny ["2026", "2027"]
    var merged = {};
    var result = [];
    filters.forEach(function(f) {
      if (f.operator === 'contains') {
        if (!merged[f.field]) {
          merged[f.field] = { field: f.field, values: [f.value] };
        } else {
          merged[f.field].values.push(f.value);
        }
      } else {
        result.push(f);
      }
    });
    Object.keys(merged).forEach(function(field) {
      var m = merged[field];
      if (m.values.length === 1) {
        result.push({ field: m.field, operator: 'contains', value: m.values[0] });
      } else {
        result.push({ field: m.field, operator: 'containsAny', value: m.values });
      }
    });
    
    return result;
  }
  
  // Заполнить select-элементы уникальными значениями из загруженных данных
  function populateSelectsFromData(binding, rawData) {
    if (!binding || !binding.dynamicFilters || !rawData) return;
    
    // Нормализуем данные — аналогично renderRepeater.
    // fetch-with-transforms возвращает { success, data: [...] }, трансформы уже применены.
    // arrayPath применяем только если data ещё не массив.
    var items = rawData;
    
    // Обёртка { success, data } от fetch-with-transforms
    if (!Array.isArray(items) && rawData.data !== undefined) {
      items = rawData.data;
    }
    
    // Если всё ещё не массив — пробуем arrayPath (прямой запрос к API без трансформов)
    if (!Array.isArray(items) && binding.repeaterConfig && binding.repeaterConfig.arrayPath) {
      items = getNestedValue(rawData, binding.repeaterConfig.arrayPath);
    }
    
    // Последний fallback: items-ключ
    if (!Array.isArray(items) && rawData.items && Array.isArray(rawData.items)) {
      items = rawData.items;
    }
    
    if (!Array.isArray(items) || items.length === 0) return;
    
    binding.dynamicFilters.forEach(function(df) {
      if (!df.sourceBlockId || !df.field) return;
      
      var element = document.querySelector('[data-element-id="' + df.sourceBlockId + '"]');
      if (!element || element.tagName !== 'SELECT') return;
      
      // Резолвим реальный путь к полю в API-данных:
      // 1. Если задан явный populateFrom — используем его
      // 2. Иначе пробуем найти через fieldMappings (суффиксный матч)
      // 3. Fallback: прямое имя поля df.field
      var dataPath = df.field;
      if (df.populateFrom) {
        dataPath = df.populateFrom;
        console.log('[DynamicFilter] Using explicit populateFrom for field "' + df.field + '": ' + dataPath);
      } else if (binding.fieldMappings && Array.isArray(binding.fieldMappings)) {
        var matchedMapping = null;
        for (var mi = 0; mi < binding.fieldMappings.length; mi++) {
          var fm = binding.fieldMappings[mi];
          if (!fm.targetProperty) continue;
          var tp = fm.targetProperty.replace(/^item\./, '');
          if (tp === df.field || tp.endsWith('-' + df.field) || tp.endsWith('.' + df.field)) {
            matchedMapping = fm;
            break;
          }
        }
        if (matchedMapping && matchedMapping.sourceField) {
          dataPath = matchedMapping.sourceField;
          console.log('[DynamicFilter] Resolved data path for field "' + df.field + '": ' + dataPath);
        }
      }
      
      // Функция извлечения значения (valueExtract — JS-выражение с переменной value)
      var extractFn = null;
      if (df.valueExtract) {
        try {
          extractFn = new Function('value', 'try { return (' + df.valueExtract + '); } catch(e) { return value; }');
        } catch(e) {
          console.warn('[DynamicFilter] Invalid valueExtract expression:', df.valueExtract, e);
        }
      }
      
      // Собираем уникальные значения поля
      var uniqueValues = [];
      var seen = {};
      items.forEach(function(item) {
        var rawVal = getNestedValue(item, dataPath);
        if (rawVal === null || rawVal === undefined || rawVal === '') return;
        var val = extractFn ? String(extractFn(String(rawVal))) : String(rawVal);
        if (val && !seen[val]) {
          seen[val] = true;
          uniqueValues.push(val);
        }
      });
      
      if (uniqueValues.length === 0) return;
      
      // Сохраняем текст плейсхолдера (первый option)
      var placeholderText = element.options.length > 0 ? element.options[0].text : 'Все';
      
      // Очищаем и пересоздаём
      element.innerHTML = '';
      
      // Плейсхолдер с пустым value — для сброса фильтра
      var placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = placeholderText;
      element.appendChild(placeholder);
      
      // Добавляем options из данных
      uniqueValues.sort().forEach(function(val) {
        var option = document.createElement('option');
        option.value = val;
        option.textContent = val;
        element.appendChild(option);
      });
      
      console.log('[DynamicFilter] Populated select for field:', df.field, 'with', uniqueValues.length, 'options from data');
    });
  }
  
  // Fetch data from source (uses fetch-with-transforms for bindings with transforms)
  async function fetchData(source, bindingId, binding) {
    try {
      var url = source.endpoint || '/api/data/' + source.dataSourceId;
      var options = { method: 'GET' };
      
      // Если есть bindingId, используем fetch-with-transforms API
      if (bindingId) {
        url = '/api/data/fetch-with-transforms';
        
        // Собираем динамические фильтры из DOM
        var filters = binding ? collectDynamicFilters(binding) : [];
        
        // Добавляем collection filter если этот binding его имеет (Проблема 2)
        if (binding && binding._collectionFilter) {
          filters.push(binding._collectionFilter);
        }
        
        var requestBody = { 
          bindingId: bindingId,
          filters: filters.length > 0 ? filters : undefined
        };
        
        options = {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody)
        };
        console.log('[DataBinding] Using fetch-with-transforms for binding:', bindingId, 'with filters:', filters);
      }
      
      // Ключ хранилища: bindingId (уникален) или sourceAlias (общий) 
      var storeKey = bindingId || source.alias;
      
      // Cache logic: check localStorage first (Проблема 4)
      var cacheKey = '_vcms_cache_' + storeKey;
      if (_collectionCacheTtl > 0) {
        try {
          var cached = localStorage.getItem(cacheKey);
          if (cached) {
            var cacheEntry = JSON.parse(cached);
            var age = (Date.now() - cacheEntry.ts) / 1000;
            if (age < _collectionCacheTtl) {
              console.log('[DataBinding] Cache hit for', storeKey, '(age: ' + Math.round(age) + 's)');
              _dataStore[storeKey] = cacheEntry.data;
              // Stale-while-revalidate: schedule background fetch
              if (age > _collectionCacheTtl / 2) {
                setTimeout(function() { _bgFetch(source, bindingId, binding, storeKey, cacheKey); }, 0);
              }
              return cacheEntry.data;
            }
          }
        } catch(e) { /* localStorage unavailable */ }
      }
      
      console.log('[DataBinding] Fetching data for source:', source.alias, 'storeKey:', storeKey, 'from:', url);
      var response = await fetch(url, options);
      var data = await response.json();
      console.log('[DataBinding] Data received for', storeKey, ':', data);
      _dataStore[storeKey] = data;
      
      // Save to cache
      if (_collectionCacheTtl > 0) {
        try {
          localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data }));
        } catch(e) { /* quota exceeded */ }
      }
      
      return data;
    } catch (error) {
      console.error('[DataBinding] Failed to fetch data for', source.alias, error);
      return null;
    }
  }
  
  // Background fetch for stale-while-revalidate
  async function _bgFetch(source, bindingId, binding, storeKey, cacheKey) {
    try {
      var url = source.endpoint || '/api/data/' + source.dataSourceId;
      var opts = { method: 'GET' };
      if (bindingId) {
        var filters = binding ? collectDynamicFilters(binding) : [];
        if (binding && binding._collectionFilter) filters.push(binding._collectionFilter);
        url = '/api/data/fetch-with-transforms';
        opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bindingId: bindingId, filters: filters.length > 0 ? filters : undefined }) };
      }
      var response = await fetch(url, opts);
      var data = await response.json();
      var oldJson = JSON.stringify(_dataStore[storeKey]);
      var newJson = JSON.stringify(data);
      if (oldJson !== newJson) {
        console.log('[DataBinding] Background revalidation: data changed for', storeKey);
        _dataStore[storeKey] = data;
        try { localStorage.setItem(cacheKey, JSON.stringify({ ts: Date.now(), data: data })); } catch(e) {}
        updateBindings();
      }
    } catch(e) { console.warn('[DataBinding] Background fetch failed:', e); }
  }
  
  // Update all bindings
  function updateBindings() {
    console.log('[DataBinding] Updating bindings, total:', _bindings.length);
    console.log('[DataBinding] Available data sources:', Object.keys(_dataStore));
    _bindings.forEach(function(binding) {
      var element = document.querySelector('[data-element-id="' + binding.blockId + '"]');
      if (!element) {
        console.warn('[DataBinding] Element not found for binding:', binding.blockId);
        return;
      }
      
      // Ищем данные сначала по bindingId, потом по sourceAlias
      var data = _dataStore[binding.bindingId] || _dataStore[binding.sourceAlias];
      if (!data) {
        console.warn('[DataBinding] No data for binding:', binding.bindingId, 'or alias:', binding.sourceAlias);
        console.warn('[DataBinding] Available keys:', Object.keys(_dataStore));
        return;
      }
      
      if (binding.type === 'input' && binding.fieldMappings) {
        console.log('[DataBinding] Applying input binding for:', binding.blockId);
        binding.fieldMappings.forEach(function(mapping) {
          const value = getNestedValue(data, mapping.sourceField);
          applyValue(element, mapping.targetProperty, value);
        });
      }
      
      if (binding.type === 'repeater' && binding.repeaterConfig) {
        // Не рендерим repeater если контейнер - form-элемент (select, input и т.д.)
        if (element.tagName === 'SELECT' || element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
          console.log('[DataBinding] Skipping repeater for form element:', binding.blockId, 'tag:', element.tagName);
          return;
        }
        console.log('[DataBinding] Rendering repeater for:', binding.blockId, 'with data:', data);
        // Собираем client-side фильтры для override-полей (числовые gte/lte)
        var csFilters = [];
        if (binding.dynamicFilters && binding.fieldOverrides) {
          binding.dynamicFilters.forEach(function(df) {
            if (!_findOverrideByField(binding.fieldOverrides, df.field) || !df.sourceBlockId) return;
            var csVal = getElementValue(df.sourceBlockId);
            var shouldSkip = df.skipIfEmpty !== false;
            if (shouldSkip && (csVal === null || csVal === '' || csVal === undefined)) return;
            csFilters.push({ field: df.field, operator: df.operator, value: csVal });
          });
        }
        renderRepeater(element, data, binding.repeaterConfig, binding.fieldMappings, binding.fieldOverrides, csFilters);
      }
    });
  }
  
  // Get nested value from object
  function getNestedValue(obj, path) {
    if (!obj || !path) return undefined;
    // Support dot and bracket notation: houses[0].files[0].file_url
    var keys = String(path).replace(/\\[(\\d+)\\]/g, '.$1').split('.');
    return keys.reduce(function(acc, key) {
      return acc && acc[key];
    }, obj);
  }

  // Slugify string (transliterate cyrillic + lowercase + dashes)
  function slugify(str) {
    var cyr = {'\u0430':'a','\u0431':'b','\u0432':'v','\u0433':'g','\u0434':'d','\u0435':'e','\u0451':'yo','\u0436':'zh','\u0437':'z','\u0438':'i','\u0439':'y','\u043a':'k','\u043b':'l','\u043c':'m','\u043d':'n','\u043e':'o','\u043f':'p','\u0440':'r','\u0441':'s','\u0442':'t','\u0443':'u','\u0444':'f','\u0445':'kh','\u0446':'ts','\u0447':'ch','\u0448':'sh','\u0449':'shch','\u044a':'','\u044b':'y','\u044c':'','\u044d':'e','\u044e':'yu','\u044f':'ya'};
    return str.toLowerCase().split('').map(function(ch) { return cyr[ch] !== undefined ? cyr[ch] : ch; }).join('')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 100);
  }
  
  // Apply value to element property
  function applyValue(element, property, value) {
    switch (property) {
      case 'textContent':
        element.textContent = value;
        break;
      case 'innerHTML':
        element.innerHTML = value;
        break;
      case 'src':
      case 'href':
      case 'alt':
      case 'title':
        element.setAttribute(property, value);
        break;
      default:
        if (property.startsWith('style.')) {
          var cssProp = property.slice(6);
          var cssValue = value;
          // Для backgroundImage / background — оборачиваем голый URL в url("...")
          if (typeof cssValue === 'string' && cssValue.length > 0
              && (cssProp === 'backgroundImage' || cssProp === 'background-image')
              && !/^\\s*(url|none|linear-gradient|radial-gradient|conic-gradient|var)\\(/i.test(cssValue)) {
            cssValue = 'url("' + String(cssValue).replace(/"/g, '\\\\"') + '")';
          }
          element.style[cssProp] = cssValue;
        } else if (property.startsWith('attr.')) {
          element.setAttribute(property.slice(5), value);
        } else if (property.startsWith('data-')) {
          element.setAttribute(property, value);
        }
    }
  }
  
  // Render repeater items
  function renderRepeater(container, data, config, fieldMappings, fieldOverrides, clientSideFilters) {
    console.log('[Repeater] Starting render with config:', config);
    console.log('[Repeater] Container:', container);
    console.log('[Repeater] Data received:', data);
    
    // Данные должны быть массивом или объектом с массивом
    let items = data;
    
    // Если указан arrayPath, используем его для извлечения массива
    if (config.arrayPath && !Array.isArray(data)) {
      items = getNestedValue(data, config.arrayPath);
      console.log('[Repeater] Extracted items using arrayPath "' + config.arrayPath + '":', items);
    }
    
    // Если data - это объект с вложенным массивом (например {success: true, data: [...]})
    if (!Array.isArray(items)) {
      if (data.data && Array.isArray(data.data)) {
        items = data.data;
      } else if (data.items && Array.isArray(data.items)) {
        items = data.items;
      } else {
        console.error('[Repeater] Data is not an array:', data);
        return;
      }
    }

    // Применяем client-side фильтры для override-полей (числовые gte/lte)
    if (clientSideFilters && clientSideFilters.length > 0 && fieldOverrides) {
      items = items.filter(function(item) {
        return clientSideFilters.every(function(cf) {
          var overrideCfg = _findOverrideByField(fieldOverrides, cf.field);
          if (!overrideCfg) return true;
          var joinVal = String(getNestedValue(item, overrideCfg.joinField) !== undefined ? getNestedValue(item, overrideCfg.joinField) : '');
          var rawVal = overrideCfg.values[joinVal];
          if (rawVal === undefined) return true;
          var numVal = typeof rawVal === 'number' ? rawVal : parseFloat(String(rawVal));
          if (isNaN(numVal)) return true;
          var filterNum = parseFloat(String(cf.value));
          if (isNaN(filterNum)) return true;
          if (cf.operator === 'gte') return numVal >= filterNum;
          if (cf.operator === 'lte') return numVal <= filterNum;
          return true;
        });
      });
      console.log('[Repeater] After client-side filters:', items.length, 'items');
    }
    
    console.log('[Repeater] Items to render:', items.length);
    console.log('[Repeater] Looking for template with ID:', config.itemTemplate);
    
    // Находим Template блок — ищем ВНУТРИ контейнера, чтобы не найти дубликат в другом месте
    var templateElement = container.querySelector('[data-element-id="' + config.itemTemplate + '"]');
    // Если в контейнере нет — fallback на document
    if (!templateElement) {
      templateElement = document.querySelector('[data-element-id="' + config.itemTemplate + '"]');
    }
    if (!templateElement) {
      console.error('[Repeater] Template block not found with ID:', config.itemTemplate);
      console.error('[Repeater] Available elements:', Array.from(document.querySelectorAll('[data-element-id]')).map(el => el.getAttribute('data-element-id')));
      console.error('[Repeater] Container children:', Array.from(container.children).map(el => ({
        tag: el.tagName,
        id: el.getAttribute('data-element-id'),
        classes: el.className
      })));
      return;
    }
    
    console.log('[Repeater] Template found:', templateElement);
    
    // Сохраняем оригинальный inline display ОДНОКРАТНО (на повторных вызовах он уже = 'none').
    // Иначе клон унаследует display:none и сломается layout.
    var originalDisplay;
    if (templateElement.hasAttribute('data-original-display')) {
      originalDisplay = templateElement.getAttribute('data-original-display');
    } else {
      originalDisplay = templateElement.style.display || '';
      templateElement.setAttribute('data-original-display', originalDisplay);
    }
    // Скрываем оригинальный template
    templateElement.style.display = 'none';
    
    // Удаляем старые повторяемые элементы (data-repeater-item) И прячем статические 
    // «братья» шаблона — карточки, которые были в HTML как образцы данных.
    // Прячем любой дочерний элемент с data-element-id (кроме самого шаблона),
    // т.к. тег карточки может отличаться (div vs a).
    // ИСКЛЮЧЕНИЕ: hybrid-static-слайды (data-carousel-static="true") оставляем
    // видимыми — это намеренно вставленные пользователем статические слайды
    // в hybrid-режиме карусели (template + статика в одном треке).
    Array.from(container.children).forEach(function(child) {
      if (child.hasAttribute('data-repeater-item')) {
        child.remove();
      } else if (child.hasAttribute('data-carousel-static')) {
        // hybrid-static-слайд — не трогаем (видим, на своём месте в DOM)
        return;
      } else if (child !== templateElement && child.hasAttribute('data-element-id')) {
        child.style.display = 'none';
        child.setAttribute('data-repeater-original', 'true');
      }
    });
    
    console.log('[Repeater] Rendering', items.length, 'items with template:', config.itemTemplate);
    
    // Якорь для вставки clones — узел, ИДУЩИЙ ПОСЛЕ template'а в DOM.
    // Hybrid-MVP: clones размещаются СРАЗУ ПОСЛЕ template'а, поэтому static-children
    // ДО template остаются слева, ПОСЛЕ template — справа от сгенерированных.
    // Если template в конце контейнера (старый case без hybrid-static) — anchor=null,
    // и insertBefore(clone, null) эквивалентен appendChild — обратная совместимость.
    var insertAnchor = templateElement.nextSibling;
    
    // Клонируем template для каждого элемента
    items.forEach(function(item, index) {
      console.log('[Repeater] Processing item #' + index + ':', JSON.stringify(item).substring(0, 200));
      
      const clone = templateElement.cloneNode(true);
      // Восстанавливаем оригинальный display (flex/grid/block), а не пустую строку.
      clone.style.display = originalDisplay;
      clone.removeAttribute('data-original-display');
      // Сохраняем originalId для возможности обновления
      const originalId = clone.getAttribute('data-element-id');
      clone.setAttribute('data-repeater-item', index);
      clone.setAttribute('data-repeater-item-id', originalId);
      
      // Применяем field mappings если есть
      if (fieldMappings && fieldMappings.length > 0) {
        console.log('[Repeater] Item #' + index + ' - applying ' + fieldMappings.length + ' field mappings');
        applyFieldMappingsToElement(clone, item, fieldMappings, fieldOverrides);
      } else {
        console.log('[Repeater] Item #' + index + ' - NO field mappings, using auto-detection');
        // Иначе пытаемся автоопределить через data-bind и {{template}}
        updateElementContent(clone, item);
      }
      
      // Auto-link: если repeater привязан к коллекции, проставляем href
      if (config.collectionLink) {
        var rawSlug = getNestedValue(item, config.collectionLink.slugField);
        var titleVal = config.collectionLink.titleField ? getNestedValue(item, config.collectionLink.titleField) : '';
        // Всегда нормализуем slug — единый формат URL
        var slugValue = slugify(String(rawSlug || titleVal || '')) || item.id || item._id || index;
        var href = config.collectionLink.basePath + '/' + encodeURIComponent(String(slugValue)) + '.html';
        var linkEl = config.collectionLink.linkSelector
          ? clone.querySelector(config.collectionLink.linkSelector)
          : (clone.tagName === 'A' ? clone : clone.querySelector('a'));
        if (linkEl) {
          linkEl.setAttribute('href', href);
        } else {
          // Fallback: оборачиваем клон в <a> или добавляем onclick
          clone.style.cursor = 'pointer';
          clone.setAttribute('role', 'link');
          clone.addEventListener('click', (function(url) {
            return function(e) {
              if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
                window.location.href = url;
              }
            };
          })(href));
        }
      }
      
      // Вставляем клон сразу ПОСЛЕ template'а (hybrid-MVP: static-children
      // ДО template остаются слева, ПОСЛЕ — справа от сгенерированных).
      // anchor=null → insertBefore работает как appendChild (обратная совместимость).
      container.insertBefore(clone, insertAnchor);
    });
    
    console.log('[Repeater] Render complete');
  }
  
  // Применить field mappings к элементу
  function applyFieldMappingsToElement(element, data, mappings, fieldOverrides) {
    console.log('[FieldMapping] ===== START =====');
    console.log('[FieldMapping] Applying ' + mappings.length + ' mappings to element');
    console.log('[FieldMapping] Data for this item:', JSON.stringify(data).substring(0, 300));
    console.log('[FieldMapping] Mappings:', JSON.stringify(mappings).substring(0, 500));
    
    mappings.forEach(function(mapping) {
      var value = getNestedValue(data, mapping.sourceField);
      console.log('[FieldMapping] Field "' + mapping.sourceField + '" -> value: "' + (value ? String(value).substring(0, 100) : 'undefined') + '"');

      // Проверяем ручные overrides (статические значения по ключу)
      if (fieldOverrides) {
        var rawFN = mapping.targetProperty && mapping.targetProperty.indexOf('item.') === 0 ? mapping.targetProperty.slice(5) : (mapping.targetProperty || '');
        while (rawFN.indexOf('.-') !== -1) rawFN = rawFN.split('.-').join('-');
        var overrideCfg = fieldOverrides[rawFN] || fieldOverrides[mapping.targetProperty];
        if (overrideCfg && overrideCfg.joinField && overrideCfg.values) {
          var joinVal = String(getNestedValue(data, overrideCfg.joinField) !== undefined ? getNestedValue(data, overrideCfg.joinField) : '');
          var rawOverrideVal = overrideCfg.values[joinVal];
          if (rawOverrideVal !== undefined) {
            if (overrideCfg.displayTemplate) {
              value = overrideCfg.displayTemplate.split('{value}').join(String(rawOverrideVal));
            } else {
              value = rawOverrideVal;
            }
            console.log('[FieldMapping] Override applied for "' + rawFN + '" (joinVal=' + joinVal + '):', value);
          }
        }
      }
      
      if (value === undefined) {
        console.warn('[FieldMapping] ⚠️ No value for field:', mapping.sourceField, 'in data:', data);
        return;
      }
      
      // Apply template: transform (safe string substitution)
      if (mapping.transform && mapping.transform.indexOf('template:') === 0) {
        var tpl = mapping.transform.substring('template:'.length);
        value = tpl.split('{{value}}').join(String(value));
        console.log('[FieldMapping] Applied template transform:', value);
      }
      
      console.log('[FieldMapping] ✓ Applying', mapping.sourceField, '->', mapping.targetProperty);
      
      // targetProperty может быть:
      // - "self.style.backgroundImage" / "self.attr.href" / "self.textContent" — применяем к корню template
      // - "[data-bind=image].style.backgroundImage" / "[data-bind=cta].attr.href" — селектор + свойство
      // - "item.project-image" - ищем элемент с data-bind="project-image"
      // - "item.title" - ищем элемент с data-bind="title" 
      // - "children.0.content" - N-й child элемент
      
      // self.* — корень template-клона
      if (mapping.targetProperty.indexOf('self.') === 0) {
        applyValue(element, mapping.targetProperty.slice(5), value);
        return;
      }
      
      // [data-bind=X].style.Y / [data-bind=X].attr.Y / [data-bind=X].textContent
      var selectorMatch = mapping.targetProperty.match(/^\\[data-bind=([^\\]]+)\\]\\.(.+)$/);
      if (selectorMatch) {
        var bindKey = selectorMatch[1].replace(/^['"]|['"]$/g, '');
        var prop = selectorMatch[2];
        var targetEl = element.querySelector('[data-bind="' + bindKey + '"]');
        if (targetEl) {
          applyValue(targetEl, prop, value);
        } else {
          console.warn('[FieldMapping] data-bind selector not found:', bindKey);
        }
        return;
      }
      
      const parts = mapping.targetProperty.split('.');
      
      // Формат "item.field-name" - ищем по data-bind ИЛИ по metadata.name
      if (parts[0] === 'item' && parts.length >= 2) {
        var rawFieldName = parts.slice(1).join('.'); // например "project-image" или "project.-image"
        // Нормализуем: убираем лишние точки между дефисами
        var fieldName = rawFieldName;
        while (fieldName.indexOf('.-') !== -1) fieldName = fieldName.split('.-').join('-');
        while (fieldName.indexOf('-.') !== -1) fieldName = fieldName.split('-.').join('-');
        while (fieldName.charAt(0) === '.' || fieldName.charAt(0) === '-') fieldName = fieldName.substring(1);
        while (fieldName.charAt(fieldName.length - 1) === '.' || fieldName.charAt(fieldName.length - 1) === '-') fieldName = fieldName.substring(0, fieldName.length - 1);
        
        // Сначала ищем элемент с data-bind атрибутом, который содержит название поля
        let targetElement = element.querySelector('[data-bind="' + fieldName + '"]');
        
        // Синонимы для полей (поле данных -> возможные названия элементов)
        const fieldSynonyms = {
          'title': ['name', 'title', 'heading', 'header', 'заголовок', 'название'],
          'name': ['title', 'name', 'heading', 'header', 'заголовок', 'название'],
          'status': ['status', 'badge', 'tag', 'label', 'статус', 'element'],
          'image': ['image', 'img', 'photo', 'picture', 'картинка', 'изображение', 'container'],
          'price': ['price', 'cost', 'цена', 'стоимость'],
          'location': ['location', 'address', 'place', 'локация', 'адрес', 'место']
        };
        
        // Получаем возможные синонимы: пробуем и полный fieldName, и последний сегмент (после последнего дефиса)
        var fieldNameLower = fieldName.toLowerCase();
        var lastSegment = fieldName.split('-').pop().toLowerCase();
        var synonyms = fieldSynonyms[fieldNameLower] || fieldSynonyms[lastSegment] || [fieldNameLower];
        
        // Если не нашли - ищем по metadata.name в data-element-name (more robust)
        if (!targetElement) {
          const allElements = element.querySelectorAll('[data-element-name]');
          for (let i = 0; i < allElements.length; i++) {
            const elementName = allElements[i].getAttribute('data-element-name').toLowerCase();
            
            // Проверяем прямое совпадение или частичное
            if (elementName.includes(fieldName.toLowerCase()) || 
                fieldName.toLowerCase().includes(elementName)) {
              targetElement = allElements[i];
              console.log('[FieldMapping] Found element by name match:', elementName, 'for field:', fieldName);
              break;
            }
            
            // Проверяем синонимы
            for (let syn of synonyms) {
              if (elementName.includes(syn) || syn.includes(elementName.split(' ').pop())) {
                targetElement = allElements[i];
                console.log('[FieldMapping] Found element by synonym match:', elementName, 'for field:', fieldName, '(synonym:', syn + ')');
                break;
              }
            }
            if (targetElement) break;
          }
        }
        
        // Fallback: ищем элемент который содержит часть названия в data-bind
        if (!targetElement) {
          const allBindElements = element.querySelectorAll('[data-bind]');
          for (let i = 0; i < allBindElements.length; i++) {
            const bindValue = allBindElements[i].getAttribute('data-bind');
            if (bindValue && (bindValue.includes(fieldName) || fieldName.includes(bindValue.split('-').pop()))) {
              targetElement = allBindElements[i];
              console.log('[FieldMapping] Found element by partial match:', bindValue, 'for field:', fieldName);
              break;
            }
          }
        }
        
        if (targetElement) {
          // Если значение похоже на URL/путь к изображению, а targetElement — не IMG, ищем <img> внутри
          var looksLikeImage = typeof value === 'string' && (
            value.match(/\\.(jpg|jpeg|png|gif|svg|webp|avif)(\\?|$)/i) ||
            value.startsWith('data:image/') ||
            value.match(/images\\.unsplash\\.com/i) ||
            (value.match(/^https?:\\/\\//i) && fieldName && fieldName.toLowerCase().indexOf('image') !== -1)
          );
          if (looksLikeImage && targetElement.tagName !== 'IMG') {
            var nestedImg = targetElement.querySelector('img');
            if (nestedImg) {
              console.log('[FieldMapping] Value looks like image, using nested <img> instead of container');
              targetElement = nestedImg;
            }
          }
          
          // Определяем как применить значение в зависимости от типа элемента
          if (targetElement.tagName === 'IMG') {
            targetElement.setAttribute('src', value);
            console.log('[FieldMapping] Set image src:', value);
          } else if (targetElement.tagName === 'A') {
            targetElement.setAttribute('href', value);
          } else {
            targetElement.textContent = value;
            console.log('[FieldMapping] Set text content:', value);
          }
        } else {
          console.log('[FieldMapping] Target element not found for field:', fieldName);
          // Fallback: пытаемся найти первый элемент содержащий имя поля в каком-либо атрибуте
          const allElements = Array.from(element.querySelectorAll('*'));
          for (let el of allElements) {
            if (el.className && el.className.includes(fieldName)) {
              el.textContent = value;
              console.log('[FieldMapping] Applied to element by class match:', el.className);
              break;
            }
          }
        }
      }
      // Формат "children.N.property" - обращение к N-му child
      else if (parts[0] === 'children' && parts.length >= 2) {
        const childIdHint = parts[1];
        const property = parts[2] || 'content';
        
        let targetElement = element.querySelector('[data-element-id*="' + childIdHint + '"]');
        
        if (!targetElement && !isNaN(childIdHint)) {
          const index = parseInt(childIdHint);
          targetElement = element.children[index];
        }
        
        if (targetElement) {
          applyValue(targetElement, property, value);
        }
      }
      // Прямое свойство
      else {
        applyValue(element, mapping.targetProperty, value);
      }
    });
  }
  
  // Обновить содержимое элемента данными (fallback для авто-обнаружения)
  function updateElementContent(element, data) {
    // Проходим по всем вложенным элементам
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );
    
    const nodes = [element];
    let node;
    while (node = walker.nextNode()) {
      nodes.push(node);
    }
    
    nodes.forEach(function(node) {
      // Ищем data-bind атрибут для автоматического связывания
      const bindField = node.getAttribute('data-bind');
      if (bindField) {
        const value = getNestedValue(data, bindField);
        if (value !== undefined) {
          if (node.tagName === 'IMG') {
            node.src = value;
          } else if (node.tagName === 'A') {
            node.href = value;
          } else {
            node.textContent = value;
          }
        }
      }
      
      // Проверяем textContent на шаблонные переменные {{field}}
      if (node.childNodes.length > 0) {
        node.childNodes.forEach(function(child) {
          if (child.nodeType === Node.TEXT_NODE && child.textContent) {
            const text = child.textContent;
            const matches = text.match(/\{\{([^}]+)\}\}/g);
            if (matches) {
              let newText = text;
              matches.forEach(function(match) {
                const field = match.replace(/\{\{|\}\}/g, '').trim();
                const value = getNestedValue(data, field);
                if (value !== undefined) {
                  newText = newText.replace(match, value);
                }
              });
              child.textContent = newText;
            }
          }
        });
      }
    });
  }
  
  // ==================== OUTPUT BINDINGS ====================
  
  // Setup output binding for an element
  function setupOutputBinding(binding) {
    const element = document.querySelector('[data-element-id="' + binding.blockId + '"]');
    if (!element || !binding.outputConfig) return;
    
    const config = binding.outputConfig;
    const form = element.closest('form') || element.querySelector('form');
    
    if (config.trigger === 'submit' || config.trigger === 'click') {
      // Для submit/click — НЕ вешаем на весь блок, иначе клик на input вызовет отправку
      if (form) {
        // Если есть форма — слушаем submit события формы
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          e.stopPropagation();
          await handleOutputSubmit(element, binding, form);
        });
        console.log('[OutputBinding] Attached submit handler to <form> in block', binding.blockId);
      } else {
        // Нет формы — ищем кнопку и вешаем click только на неё
        var submitBtn = element.querySelector('button[type="submit"]') || element.querySelector('button') || element.querySelector('a.btn, a[class*="button"], [role="button"]');
        if (submitBtn) {
          submitBtn.addEventListener('click', async function(e) {
            e.preventDefault();
            e.stopPropagation();
            await handleOutputSubmit(element, binding, form);
          });
          console.log('[OutputBinding] Attached click handler to button in block', binding.blockId);
        } else {
          console.warn('[OutputBinding] No <form> or <button> found in block', binding.blockId, '— cannot attach trigger safely');
        }
      }
    } else if (config.trigger === 'change' || config.trigger === 'blur') {
      // Для change/blur — вешаем на сам элемент
      element.addEventListener(config.trigger, async function(e) {
        await handleOutputSubmit(element, binding, form);
      });
    }
    
    // Интервальный триггер
    if (config.trigger === 'interval' && config.triggerInterval) {
      setInterval(function() {
        handleOutputSubmit(element, binding, form);
      }, config.triggerInterval * 1000);
    }
  }
  
  // Обработка отправки данных
  async function handleOutputSubmit(element, binding, form) {
    const config = binding.outputConfig;
    const button = element.querySelector('button[type="submit"]') || element.querySelector('button');
    
    // Состояние загрузки
    setButtonState(button, 'loading');
    
    try {
      // Собираем данные
      const payload = collectPayload(element, form, config.payloadMappings);
      
      // Валидация
      if (config.validations) {
        const errors = validatePayload(payload, config.validations);
        if (Object.keys(errors).length > 0) {
          showValidationErrors(element, errors);
          setButtonState(button, 'error');
          return;
        }
      }
      
      // Получаем endpoint
      var configEndpoint = config.endpoint || '';
      var dataSource = _dataSources.find(function(ds) {
        return ds.alias === binding.sourceAlias;
      });
      var dsBaseUrl = dataSource ? dataSource.endpoint : '';
      
      // Собираем итоговый endpoint
      var endpoint;
      if (configEndpoint.startsWith('http://') || configEndpoint.startsWith('https://')) {
        // Абсолютный URL — используем как есть
        endpoint = configEndpoint;
      } else if (configEndpoint && dsBaseUrl) {
        // Есть путь + базовый URL — склеиваем
        var base = dsBaseUrl.endsWith('/') ? dsBaseUrl.slice(0, -1) : dsBaseUrl;
        var sub = configEndpoint.startsWith('/') ? configEndpoint : '/' + configEndpoint;
        endpoint = base + sub;
      } else if (configEndpoint.startsWith('/')) {
        // Абсолютный путь без базового URL — используем как есть
        endpoint = configEndpoint;
      } else if (configEndpoint) {
        // Относительный путь, но нет источника данных — пробуем /api/ prefix
        endpoint = '/api/' + configEndpoint;
      } else if (dsBaseUrl) {
        // Нет пути в конфиге, но есть URL источника данных
        endpoint = dsBaseUrl;
      } else {
        // Ничего не указано — fallback
        endpoint = '/api/data/submit';
      }
      
      console.log('[OutputBinding] Sending to endpoint:', endpoint);
      
      // Определяем формат тела запроса
      // Если endpoint — это прямой API (не /api/data/submit), отправляем payload напрямую
      var requestBody;
      if (endpoint === '/api/data/submit') {
        requestBody = {
          dataSourceId: binding.sourceAlias,
          data: payload,
          blockId: binding.blockId,
          trigger: config.trigger,
        };
      } else {
        // Прямой API-эндпоинт — отправляем поля payload в корне body
        requestBody = payload;
      }
      
      // Отправляем запрос
      const response = await fetch(endpoint, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      // Проверяем content-type перед парсингом JSON
      var contentType = response.headers.get('content-type') || '';
      var result;
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // Сервер вернул не JSON (возможно HTML ошибку)
        var text = await response.text();
        console.error('[OutputBinding] Server returned non-JSON response:', text.substring(0, 200));
        result = { success: false, error: { message: 'Сервер вернул некорректный ответ (не JSON). Проверьте endpoint: ' + endpoint } };
      }
      
      if (response.ok && result.success) {
        setButtonState(button, 'success');
        handleSuccessAction(element, config.onSuccess, result);
        
        // Сброс формы
        if (form) form.reset();
      } else {
        setButtonState(button, 'error');
        handleErrorAction(element, config.onError, result.error);
      }
    } catch (error) {
      console.error('Output binding error:', error);
      setButtonState(button, 'error');
      handleErrorAction(element, config.onError, { message: error.message });
    }
  }
  
  // Сбор данных payload
  function collectPayload(element, form, mappings) {
    const payload = {};
    
    if (form) {
      // Из формы — собираем поля с атрибутом name
      const formData = new FormData(form);
      formData.forEach(function(value, key) {
        payload[key] = value;
      });
    }
    
    // Применяем маппинги
    if (mappings) {
      mappings.forEach(function(m) {
        var fieldKey = m.targetField || m.sourceField;
        
        if (m.type === 'direct') {
          // 1. Ищем по атрибуту name
          var input = element.querySelector('[name="' + m.sourceField + '"]');
          
          // 2. Ищем по data-element-name (напр. "Name Input" для sourceField "name")
          if (!input) {
            var allInputs = element.querySelectorAll('input, select, textarea');
            for (var i = 0; i < allInputs.length; i++) {
              var elName = (allInputs[i].getAttribute('data-element-name') || '').toLowerCase();
              if (elName.indexOf(m.sourceField.toLowerCase()) !== -1) {
                input = allInputs[i];
                break;
              }
            }
          }
          
          // 3. Ищем по data-element-name у родительского контейнера
          if (!input) {
            var containers = element.querySelectorAll('[data-element-name]');
            for (var j = 0; j < containers.length; j++) {
              var cName = (containers[j].getAttribute('data-element-name') || '').toLowerCase();
              if (cName.indexOf(m.sourceField.toLowerCase()) !== -1) {
                var nested = containers[j].querySelector('input, select, textarea');
                if (!nested && (containers[j].tagName === 'INPUT' || containers[j].tagName === 'SELECT' || containers[j].tagName === 'TEXTAREA')) {
                  nested = containers[j];
                }
                if (nested) {
                  input = nested;
                  break;
                }
              }
            }
          }
          
          // 4. Ищем по placeholder
          if (!input) {
            var byPlaceholder = element.querySelector('[placeholder*="' + m.sourceField + '" i]');
            if (byPlaceholder) input = byPlaceholder;
          }
          
          if (input) {
            payload[fieldKey] = input.value;
            console.log('[OutputBinding] Collected field "' + fieldKey + '" =', input.value);
          } else {
            console.warn('[OutputBinding] Could not find input for sourceField "' + m.sourceField + '"');
          }
        } else if (m.type === 'static') {
          payload[fieldKey] = m.value;
        } else if (m.type === 'computed' && m.value) {
          try {
            payload[fieldKey] = eval(m.value);
          } catch (e) {
            console.error('Computed field error:', e);
          }
        }
      });
    }
    
    console.log('[OutputBinding] Final payload:', JSON.stringify(payload));
    return payload;
  }
  
  // Валидация payload
  function validatePayload(payload, validations) {
    const errors = {};
    
    validations.forEach(function(v) {
      const value = payload[v.field];
      
      v.rules.forEach(function(rule) {
        switch (rule.type) {
          case 'required':
            if (!value || value.toString().trim() === '') {
              errors[v.field] = errors[v.field] || [];
              errors[v.field].push(rule.message || 'Обязательное поле');
            }
            break;
          case 'email':
            if (value && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(value)) {
              errors[v.field] = errors[v.field] || [];
              errors[v.field].push(rule.message || 'Неверный email');
            }
            break;
          case 'minLength':
            if (value && value.length < rule.value) {
              errors[v.field] = errors[v.field] || [];
              errors[v.field].push(rule.message || 'Минимум ' + rule.value + ' символов');
            }
            break;
          case 'maxLength':
            if (value && value.length > rule.value) {
              errors[v.field] = errors[v.field] || [];
              errors[v.field].push(rule.message || 'Максимум ' + rule.value + ' символов');
            }
            break;
          case 'pattern':
            if (value && rule.value && !new RegExp(rule.value).test(value)) {
              errors[v.field] = errors[v.field] || [];
              errors[v.field].push(rule.message || 'Неверный формат');
            }
            break;
        }
      });
    });
    
    return errors;
  }
  
  // Показать ошибки валидации
  function showValidationErrors(element, errors) {
    // Удаляем старые ошибки
    element.querySelectorAll('.validation-error').forEach(function(el) {
      el.remove();
    });
    
    // Показываем новые
    Object.keys(errors).forEach(function(field) {
      const input = element.querySelector('[name="' + field + '"]');
      if (input) {
        input.classList.add('border-red-500');
        const errorEl = document.createElement('div');
        errorEl.className = 'validation-error text-red-500 text-sm mt-1';
        errorEl.textContent = errors[field][0];
        input.parentNode.appendChild(errorEl);
      }
    });
  }
  
  // Состояние кнопки
  function setButtonState(button, state) {
    if (!button) return;
    
    const originalText = button.getAttribute('data-original-text') || button.textContent;
    button.setAttribute('data-original-text', originalText);
    
    button.classList.remove('loading', 'success', 'error');
    
    switch (state) {
      case 'loading':
        button.disabled = true;
        button.classList.add('loading');
        button.innerHTML = '<span class="spinner"></span> Отправка...';
        break;
      case 'success':
        button.disabled = false;
        button.classList.add('success');
        button.innerHTML = '✓ Успешно';
        setTimeout(function() {
          button.textContent = originalText;
          button.classList.remove('success');
        }, 2000);
        break;
      case 'error':
        button.disabled = false;
        button.classList.add('error');
        button.innerHTML = '✗ Ошибка';
        setTimeout(function() {
          button.textContent = originalText;
          button.classList.remove('error');
        }, 3000);
        break;
    }
  }
  
  // Обработка успешного действия
  function handleSuccessAction(element, onSuccess, result) {
    if (!onSuccess) return;
    
    switch (onSuccess.action) {
      case 'message':
        alert(onSuccess.value || 'Успешно отправлено!');
        break;
      case 'redirect':
        if (onSuccess.value) window.location.href = onSuccess.value;
        break;
      case 'refresh':
        window.location.reload();
        break;
      case 'reset':
        const form = element.querySelector('form');
        if (form) form.reset();
        break;
      case 'hide':
        element.style.display = 'none';
        break;
    }
  }
  
  // Обработка ошибки
  function handleErrorAction(element, onError, error) {
    if (!onError) {
      alert('Ошибка: ' + (error?.message || 'Неизвестная ошибка'));
      return;
    }
    
    switch (onError.action) {
      case 'message':
        alert(onError.value || error?.message || 'Произошла ошибка');
        break;
      case 'retry':
        // Retry логика обрабатывается в handleOutputSubmit
        break;
    }
  }
  
  // Initialize on page load
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[DataBinding] Initializing with', _bindings.length, 'bindings');

    // Pre-fill _dataStore for page-variable sources — эти данные не фетчатся, берутся из _variables.
    _dataSources.forEach(function(source) {
      if (source.type === 'page-variable' && source.variableName) {
        _dataStore[source.alias] = _variables[source.variableName];
        console.log('[DataBinding] Initialized page-variable source:', source.alias, '<-', source.variableName);
      }
    });

    // Собираем уникальные пары (sourceAlias, bindingId, binding)
    const sourcesToLoad = new Map();
    
    _bindings.forEach(function(binding) {
      if (binding.type === 'input' || binding.type === 'repeater') {
        const source = _dataSources.find(s => s.alias === binding.sourceAlias);
        // page-variable источники не нуждаются в fetch — данные уже в _dataStore.
        if (source && source.type === 'page-variable') {
          return;
        }
        if (source && source.loadStrategy === 'pageLoad') {
          // Используем bindingId если есть, иначе только sourceAlias
          const key = binding.bindingId || binding.sourceAlias;
          if (!sourcesToLoad.has(key)) {
            sourcesToLoad.set(key, { source: source, bindingId: binding.bindingId, binding: binding });
          }
        }
      }
    });
    
    // Функция для перезагрузки данных с фильтрами
    function reloadWithFilters(config) {
      console.log('[DataBinding] Reloading data with filters for:', config.bindingId);
      fetchData(config.source, config.bindingId, config.binding).then(updateBindings);
    }

    // Если есть page-variable bindings — применяем их немедленно (без fetch)
    var hasPageVarSources = _dataSources.some(function(s) { return s.type === 'page-variable'; });
    if (hasPageVarSources) {
      console.log('[DataBinding] Applying page-variable bindings immediately');
      updateBindings();
    }
    
    // Загружаем данные для каждого уникального источника с bindingId
    sourcesToLoad.forEach(function(config, key) {
      console.log('[DataBinding] Loading data for:', key, 'bindingId:', config.bindingId);
      // Первая загрузка БЕЗ динамических фильтров (select-ы ещё содержат placeholder-текст,
      // который будет ошибочно отправлен как фильтр). После загрузки populateSelectsFromData
      // заменит options на реальные значения с пустым placeholder.
      fetchData(config.source, config.bindingId, null).then(function(data) {
        // Заполняем select-ы уникальными значениями из данных
        populateSelectsFromData(config.binding, data);
        updateBindings();
      });
      
      // Если есть dynamicFilters - настраиваем слушатели изменений
      if (config.binding && config.binding.dynamicFilters && config.binding.dynamicFilters.length > 0) {
        config.binding.dynamicFilters.forEach(function(df) {
          const filterElement = document.querySelector('[data-element-id="' + df.sourceBlockId + '"]');
          if (!filterElement) return;
          
          // Для BUTTON - toggle класс active по клику
          if (filterElement.tagName === 'BUTTON') {
            filterElement.addEventListener('click', function() {
              filterElement.classList.toggle('active');
              // Визуальный feedback
              if (filterElement.classList.contains('active')) {
                filterElement.style.backgroundColor = 'rgba(210,159,102,0.3)';
                filterElement.style.borderColor = '#D29F66';
                filterElement.style.fontWeight = '600';
              } else {
                filterElement.style.backgroundColor = '';
                filterElement.style.borderColor = '';
                filterElement.style.fontWeight = '';
              }
              console.log('[DynamicFilter] Button toggled:', df.field, '=', filterElement.textContent?.trim(), 'active:', filterElement.classList.contains('active'));
              reloadWithFilters(config);
            });
            console.log('[DynamicFilter] Attached click toggle to button:', df.sourceBlockId);
            return;
          }
          
          // Для select/input добавляем обработчик change
          const input = filterElement.tagName === 'SELECT' || filterElement.tagName === 'INPUT' 
            ? filterElement 
            : filterElement.querySelector('select, input');
          
          if (input) {
            // Для override-полей (client-side фильтр) слушаем 'input' и вызываем updateBindings напрямую.
            // Для остальных полей — 'change' + reloadWithFilters (API-запрос).
            var isOverrideField = config.binding.fieldOverrides && _findOverrideByField(config.binding.fieldOverrides, df.field);
            if (isOverrideField) {
              input.addEventListener('input', function() {
                console.log('[DynamicFilter] Override field input:', df.field, '=', input.value);
                updateBindings();
              });
              input.addEventListener('change', function() {
                updateBindings();
              });
              console.log('[DynamicFilter] Attached input+updateBindings to override field:', df.sourceBlockId);
            } else {
              input.addEventListener('change', function() {
                console.log('[DynamicFilter] Filter changed:', df.field, '=', input.value);
                reloadWithFilters(config);
              });
              console.log('[DynamicFilter] Attached change+reload listener to:', df.sourceBlockId);
            }
          }
        });
      }
    });
    
    // Setup interval loading
    _dataSources.forEach(function(source) {
      if (source.loadStrategy === 'interval' && source.loadInterval) {
        // Для интервальной загрузки находим соответствующий binding
        const binding = _bindings.find(b => b.sourceAlias === source.alias);
        const bindingId = binding ? binding.bindingId : null;
        
        setInterval(function() {
          fetchData(source, bindingId, binding).then(updateBindings);
        }, source.loadInterval * 1000);
      }
    });
    
    // Setup output bindings
    _bindings.forEach(function(binding) {
      if (binding.type === 'output') {
        setupOutputBinding(binding);
      }
    });
    
    // Collection polling: periodically refetch data (Проблема 4)
    if (_collectionPollInterval > 0) {
      var _pollInFlight = false;
      var _pollTimer = setInterval(function() {
        // Don't poll hidden tabs
        if (document.visibilityState !== 'visible') return;
        if (_pollInFlight) return;
        _pollInFlight = true;
        
        var promises = [];
        sourcesToLoad.forEach(function(config, key) {
          promises.push(fetchData(config.source, config.bindingId, config.binding));
        });
        Promise.all(promises).then(function() {
          updateBindings();
          _pollInFlight = false;
        }).catch(function() { _pollInFlight = false; });
      }, _collectionPollInterval * 1000);
      
      // Stop polling when tab is hidden, resume when visible
      document.addEventListener('visibilitychange', function() {
        // Timer clears itself via guard, no need to clearInterval
      });
    }
  });
})();
</script>
`
}

/**
 * Генерирует data-атрибуты для элемента с привязкой
 */
export function generateBindingAttributes(binding: DataBindingConfig): string {
  const attrs: string[] = []
  
  attrs.push(`data-binding-type="${binding.type}"`)
  attrs.push(`data-binding-source="${binding.sourceAlias}"`)
  
  if (binding.fieldMappings?.length) {
    attrs.push(`data-binding-fields="${binding.fieldMappings.map(m => m.sourceField).join(',')}"`)
  }
  
  if (binding.type === 'repeater') {
    attrs.push('data-repeater="true"')
  }
  
  return attrs.join(' ')
}

export default { generateDataBindingRuntime, generateBindingAttributes }
