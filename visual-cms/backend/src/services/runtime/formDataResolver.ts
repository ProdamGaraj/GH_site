/**
 * JS-исходник резолвера form-data, встраиваемый в runtime опубликованной страницы.
 *
 * form-data — client-runtime тип: бэкенд его не фетчит, значение читается в
 * браузере посетителя из URL-параметров / localStorage / sessionStorage / cookies.
 *
 * Код вынесен ОТДЕЛЬНОЙ СТРОКОЙ (а не инлайном в шаблоне DataBindingGenerator),
 * чтобы один и тот же исходник и встраивался в страницу, и проверялся в тестах
 * через `new Function(...)` — без расхождения «тестируем одно, деплоим другое».
 *
 * Контракт функции `resolveFormData(source)`:
 *   source.formDataType: 'url-params' | 'local-storage' | 'session-storage' | 'cookies'
 *   source.formDataKey:  имя параметра/ключа (для url-params необязательно —
 *                        без ключа возвращается объект со всеми параметрами)
 *   source.formDataDefault: значение по умолчанию, если ключ отсутствует
 *
 * Зависит от глобалей браузера window/document (в тестах подставляются моки).
 */
export const FORM_DATA_RESOLVER_JS = `
  function resolveFormData(source) {
    var key = source.formDataKey;
    var def = (source.formDataDefault !== undefined ? source.formDataDefault : null);
    try {
      if (source.formDataType === 'url-params') {
        var params = new URLSearchParams(window.location.search);
        if (!key) {
          var obj = {};
          params.forEach(function(v, k) { obj[k] = v; });
          return obj;
        }
        return params.has(key) ? params.get(key) : def;
      }
      if (source.formDataType === 'local-storage' || source.formDataType === 'session-storage') {
        var store = source.formDataType === 'local-storage' ? window.localStorage : window.sessionStorage;
        if (!key) return def;
        var raw = store.getItem(key);
        if (raw === null || raw === undefined) return def;
        try { return JSON.parse(raw); } catch (e) { return raw; }
      }
      if (source.formDataType === 'cookies') {
        if (!key) return def;
        var cookies = (document.cookie || '').split(';');
        for (var i = 0; i < cookies.length; i++) {
          var parts = cookies[i].split('=');
          var name = (parts[0] || '').trim();
          if (name === key) {
            return decodeURIComponent((parts.slice(1).join('=') || '').trim());
          }
        }
        return def;
      }
      return def;
    } catch (e) {
      return def;
    }
  }
`
