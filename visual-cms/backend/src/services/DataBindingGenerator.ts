/**
 * Генератор runtime скрипта для Data Binding на опубликованных страницах
 */

export interface DataBindingConfig {
  blockId: string
  type: 'input' | 'output' | 'repeater'
  sourceAlias: string
  fieldMappings?: Array<{
    sourceField: string
    targetProperty: string
    transform?: string
  }>
  repeaterConfig?: {
    itemTemplate: string
    containerSelector: string
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
  
  // Fetch data from source
  async function fetchData(source) {
    try {
      console.log('[DataBinding] Fetching data for source:', source.alias, 'from:', source.endpoint || '/api/data/' + source.dataSourceId);
      const response = await fetch(source.endpoint || '/api/data/' + source.dataSourceId);
      const data = await response.json();
      console.log('[DataBinding] Data received for', source.alias, ':', data);
      _dataStore[source.alias] = data;
      return data;
    } catch (error) {
      console.error('[DataBinding] Failed to fetch data for', source.alias, error);
      return null;
    }
  }
  
  // Update all bindings
  function updateBindings() {
    console.log('[DataBinding] Updating bindings, total:', _bindings.length);
    console.log('[DataBinding] Available data sources:', Object.keys(_dataStore));
    _bindings.forEach(function(binding) {
      const element = document.querySelector('[data-element-id="' + binding.blockId + '"]');
      if (!element) {
        console.warn('[DataBinding] Element not found for binding:', binding.blockId);
        console.log('[DataBinding] Available elements:', Array.from(document.querySelectorAll('[data-element-id]')).slice(0, 10).map(el => el.getAttribute('data-element-id')));
        return;
      }
      
      const data = _dataStore[binding.sourceAlias];
      if (!data) {
        console.warn('[DataBinding] No data for source alias:', binding.sourceAlias);
        console.warn('[DataBinding] Available aliases:', Object.keys(_dataStore));
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
        console.log('[DataBinding] Rendering repeater for:', binding.blockId, 'with data:', data);
        renderRepeater(element, data, binding.repeaterConfig, binding.fieldMappings);
      }
    });
  }
  
  // Get nested value from object
  function getNestedValue(obj, path) {
    return path.split('.').reduce(function(acc, key) {
      return acc && acc[key];
    }, obj);
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
          element.style[property.slice(6)] = value;
        } else if (property.startsWith('data-')) {
          element.setAttribute(property, value);
        }
    }
  }
  
  // Render repeater items
  function renderRepeater(container, data, config, fieldMappings) {
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
    
    console.log('[Repeater] Items to render:', items.length);
    console.log('[Repeater] Looking for template with ID:', config.itemTemplate);
    
    // Находим Template блок
    const templateElement = document.querySelector('[data-element-id="' + config.itemTemplate + '"]');
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
    
    // Скрываем оригинальный template
    templateElement.style.display = 'none';
    
    // Удаляем только старые повторяемые элементы (те что имеют data-repeater-item атрибут)
    // Остальные элементы контейнера (фильтры, заголовки) остаются на месте
    Array.from(container.children).forEach(function(child) {
      if (child.hasAttribute('data-repeater-item')) {
        child.remove();
      }
    });
    
    console.log('[Repeater] Rendering', items.length, 'items with template:', config.itemTemplate);
    
    // Клонируем template для каждого элемента
    items.forEach(function(item, index) {
      const clone = templateElement.cloneNode(true);
      clone.style.display = ''; // Показываем клон
      // Сохраняем originalId для возможности обновления
      const originalId = clone.getAttribute('data-element-id');
      clone.setAttribute('data-repeater-item', index);
      clone.setAttribute('data-repeater-item-id', originalId);
      
      // Применяем field mappings если есть
      if (fieldMappings && fieldMappings.length > 0) {
        applyFieldMappingsToElement(clone, item, fieldMappings);
      } else {
        // Иначе пытаемся автоопределить через data-bind и {{template}}
        updateElementContent(clone, item);
      }
      
      // Вставляем клон в конец контейнера
      // Не используем insertBefore, так как шаблон может быть в другом контейнере
      container.appendChild(clone);
    });
    
    console.log('[Repeater] Render complete');
  }
  
  // Применить field mappings к элементу
  function applyFieldMappingsToElement(element, data, mappings) {
    console.log('[FieldMapping] Applying mappings:', mappings);
    console.log('[FieldMapping] Data:', data);
    
    mappings.forEach(function(mapping) {
      const value = getNestedValue(data, mapping.sourceField);
      if (value === undefined) {
        console.log('[FieldMapping] No value for field:', mapping.sourceField);
        return;
      }
      
      console.log('[FieldMapping] Applying', mapping.sourceField, '=', value, 'to', mapping.targetProperty);
      
      // targetProperty может быть:
      // - "item.project-image" - ищем элемент с data-bind="project-image"
      // - "item.title" - ищем элемент с data-bind="title" 
      // - "children.0.content" - N-й child элемент
      
      const parts = mapping.targetProperty.split('.');
      
      // Формат "item.field-name" - ищем по data-bind ИЛИ по metadata.name
      if (parts[0] === 'item' && parts.length === 2) {
        const fieldName = parts[1]; // например "project-image" или "image"
        
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
        
        // Получаем возможные синонимы для текущего поля
        const synonyms = fieldSynonyms[fieldName.toLowerCase()] || [fieldName.toLowerCase()];
        
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
    
    // Определяем событие триггера
    const triggerEvent = {
      'submit': 'submit',
      'click': 'click',
      'change': 'change',
      'blur': 'blur'
    }[config.trigger] || 'click';
    
    // Находим форму или элемент для триггера
    const form = element.closest('form') || element.querySelector('form');
    const targetElement = form || element;
    
    // Добавляем обработчик
    targetElement.addEventListener(triggerEvent, async function(e) {
      if (triggerEvent === 'submit') {
        e.preventDefault();
      }
      
      await handleOutputSubmit(element, binding, form);
    });
    
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
      const endpoint = config.endpoint || _dataSources.find(function(ds) {
        return ds.alias === binding.sourceAlias;
      })?.endpoint || '/api/data/submit';
      
      // Отправляем запрос
      const response = await fetch(endpoint, {
        method: config.method || 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          dataSourceId: binding.sourceAlias,
          data: payload,
          blockId: binding.blockId,
          trigger: config.trigger,
        }),
      });
      
      const result = await response.json();
      
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
      // Из формы
      const formData = new FormData(form);
      formData.forEach(function(value, key) {
        payload[key] = value;
      });
    }
    
    // Применяем маппинги
    if (mappings) {
      mappings.forEach(function(m) {
        if (m.type === 'direct') {
          const input = element.querySelector('[name="' + m.sourceField + '"]');
          if (input) payload[m.targetField] = input.value;
        } else if (m.type === 'static') {
          payload[m.targetField] = m.value;
        } else if (m.type === 'computed' && m.value) {
          try {
            payload[m.targetField] = eval(m.value);
          } catch (e) {
            console.error('Computed field error:', e);
          }
        }
      });
    }
    
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
    // Load data sources configured for page load
    _dataSources.forEach(function(source) {
      if (source.loadStrategy === 'pageLoad') {
        fetchData(source).then(updateBindings);
      }
      
      if (source.loadStrategy === 'interval' && source.loadInterval) {
        setInterval(function() {
          fetchData(source).then(updateBindings);
        }, source.loadInterval * 1000);
      }
    });
    
    // Setup output bindings
    _bindings.forEach(function(binding) {
      if (binding.type === 'output') {
        setupOutputBinding(binding);
      }
    });
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
