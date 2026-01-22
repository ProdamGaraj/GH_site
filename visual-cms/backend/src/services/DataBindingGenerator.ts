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
      const response = await fetch(source.endpoint || '/api/data/' + source.dataSourceId);
      const data = await response.json();
      _dataStore[source.alias] = data;
      return data;
    } catch (error) {
      console.error('Failed to fetch data for', source.alias, error);
      return null;
    }
  }
  
  // Update all bindings
  function updateBindings() {
    _bindings.forEach(function(binding) {
      const element = document.querySelector('[data-element-id="' + binding.blockId + '"]');
      if (!element) return;
      
      const data = _dataStore[binding.sourceAlias];
      if (!data) return;
      
      if (binding.type === 'input' && binding.fieldMappings) {
        binding.fieldMappings.forEach(function(mapping) {
          const value = getNestedValue(data, mapping.sourceField);
          applyValue(element, mapping.targetProperty, value);
        });
      }
      
      if (binding.type === 'repeater' && binding.repeaterConfig) {
        renderRepeater(element, data, binding.repeaterConfig);
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
  function renderRepeater(container, items, config) {
    if (!Array.isArray(items)) return;
    
    const template = document.querySelector(config.itemTemplate);
    if (!template) return;
    
    container.innerHTML = '';
    
    items.forEach(function(item, index) {
      const clone = template.content.cloneNode(true);
      
      // Replace template variables
      clone.querySelectorAll('[data-bind]').forEach(function(el) {
        const field = el.getAttribute('data-bind');
        const value = getNestedValue(item, field);
        if (value !== undefined) {
          el.textContent = value;
        }
      });
      
      container.appendChild(clone);
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
