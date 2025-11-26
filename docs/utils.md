# Utils

The `Utils` class provides static utility functions for common operations such as DOM validation, input sanitization, and locale handling.

## Import

```javascript
import { Utils } from '@liturgical-calendar/components-js';
```

## Locale Utilities

These methods help detect and match user language preferences with available locales.

### getUserLanguages()

Returns an array of the user's preferred languages from browser settings, in order of preference.

```javascript
const userLanguages = Utils.getUserLanguages();
// Returns: ['en-US', 'en', 'fr'] based on browser settings
```

**Returns:** `string[]` - Array of language codes

### findBestLocale(userLanguages, availableLocales)

Finds the best matching locale from available options based on user's language preferences. Tries exact match first, then language prefix match, for each preferred language in order.

```javascript
const userLanguages = Utils.getUserLanguages(); // ['en-US', 'en']
const availableLocales = ['it', 'en', 'fr', 'de'];
const bestLocale = Utils.findBestLocale(userLanguages, availableLocales);
// Returns: 'en' (matches 'en-US' prefix)
```

**Parameters:**

| Parameter          | Type       | Description                                        |
|--------------------|------------|----------------------------------------------------|
| `userLanguages`    | `string[]` | User's preferred languages in order of preference  |
| `availableLocales` | `string[]` | Array of available locale strings to match against |

**Returns:** `string` - The best matching locale value, or the first available option, or `'en'` as fallback

**Match Priority:**

1. Exact match (e.g., `'en-US'` matches `'en-US'`)
2. Language prefix match (e.g., `'en-US'` matches `'en'` or `'en_GB'`)
3. First available locale
4. `'en'` as final fallback

## Example Usage

Setting up locale detection with ApiOptions:

```javascript
import { ApiClient, ApiOptions, ApiOptionsFilter, Utils } from '@liturgical-calendar/components-js';

const userLanguages = Utils.getUserLanguages();
const initialLang = userLanguages[0] || 'en';

ApiClient.init().then(apiClient => {
    const apiOptions = new ApiOptions(initialLang)
        .filter(ApiOptionsFilter.LOCALE_ONLY);
    apiOptions.appendTo('#localeContainer');

    // Get available locales from the rendered select options
    const localeOptions = Array.from(apiOptions._localeInput._domElement.options)
        .map(opt => opt.value);

    // Find best matching locale
    const selectedLocale = Utils.findBestLocale(userLanguages, localeOptions);
    apiOptions._localeInput._domElement.value = selectedLocale;

    // Fetch with the matched locale
    apiClient.fetchCalendar(selectedLocale);
});
```

## Validation Utilities

### validateElementSelector(element)

Validates a given element selector and returns the corresponding DOM element.

```javascript
const element = Utils.validateElementSelector('#my-container');
// Returns the DOM element if found, throws Error if not found
```

**Parameters:**

| Parameter | Type     | Description                    |
|-----------|----------|--------------------------------|
| `element` | `string` | The CSS selector to validate   |

**Returns:** `Element` - The DOM element corresponding to the selector

**Throws:** `Error` if the element is not a string or is not found in the DOM

### validateClassName(className)

Checks if the provided class name is a valid CSS class name.

```javascript
Utils.validateClassName('my-class');    // true
Utils.validateClassName('123invalid');  // false (starts with digit)
Utils.validateClassName('--invalid');   // false (starts with dashes)
```

**Parameters:**

| Parameter   | Type     | Description              |
|-------------|----------|--------------------------|
| `className` | `string` | The class name to check  |

**Returns:** `boolean` - `true` if valid, `false` otherwise

### validateId(id)

Checks if the provided string is a valid CSS ID.

```javascript
Utils.validateId('my-id');      // true
Utils.validateId('_private');   // true
Utils.validateId('123invalid'); // false
```

**Parameters:**

| Parameter | Type     | Description        |
|-----------|----------|--------------------|
| `id`      | `string` | The ID to validate |

**Returns:** `boolean` - `true` if valid, `false` otherwise

### sanitizeInput(input)

Sanitizes the given input string to prevent XSS attacks by stripping HTML tags.

```javascript
Utils.sanitizeInput('<script>alert("xss")</script>Hello');
// Returns: 'Hello'
```

**Parameters:**

| Parameter | Type     | Description            |
|-----------|----------|------------------------|
| `input`   | `string` | The string to sanitize |

**Returns:** `string` - The sanitized string with HTML tags removed
