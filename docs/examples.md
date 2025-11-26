# Examples

The `examples/` folder contains working examples demonstrating how to use the library components.

## Running Examples

1. Start the Liturgical Calendar API on `localhost:8000`
2. Serve the examples folder with any static server:

```bash
# Using Python
python3 -m http.server 3001

# Using PHP
php -S localhost:3001

# Using Node.js (npx)
npx serve -p 3001
```

3. Open the example in your browser (e.g., `http://localhost:3001/examples/LiturgyOfTheDay/`)

---

## LiturgyOfTheDay

**Path:** `examples/LiturgyOfTheDay/`

Displays today's liturgical events with calendar and locale selection.

![LiturgyOfTheDay Example](images/liturgyoftheday.png)

### Features

- Calendar selection (General Roman, National, Diocesan)
- Locale selection with browser language detection
- Lectionary readings display
- Automatic handling of year-end edge cases (Advent transition)
- Bootstrap 5 styling

### Files

| File | Description |
|------|-------------|
| `index.html` | HTML structure with Bootstrap |
| `main.js` | Component setup and configuration |
| `main.css` | Custom styling for readings and grades |

### Key Implementation Details

```javascript
// Browser language detection
function getUserLanguages() {
    if (navigator.languages && navigator.languages.length > 0) {
        return [...navigator.languages];
    }
    return navigator.language ? [navigator.language] : ['en'];
}

// Match user language to available locales
function findBestLocale(userLanguages, localeOptions) {
    // Try exact match, then prefix match, then fallback
}
```

---

## LiturgyOfAnyDay

**Path:** `examples/LiturgyOfAnyDay/`

Browse liturgical events for any date with interactive date controls.

![LiturgyOfAnyDay Example](images/liturgyofanyday.png)

### Features

- Day, Month, Year input controls
- Calendar and locale selection
- Lectionary readings display
- Automatic December 31st handling (includes Vigil Mass)
- High-contrast text colors on liturgical backgrounds
- Bootstrap 5 styling

### Files

| File | Description |
|------|-------------|
| `index.html` | HTML structure with Bootstrap |
| `main.js` | Component setup with date controls |
| `main.css` | Custom styling with overflow fix |

### Key Implementation Details

```javascript
const liturgyOfAnyDay = new LiturgyOfAnyDay(selectedLocale)
    .dayInputConfig({
        wrapper: 'div',
        wrapperClass: 'col-4 col-md-3',
        class: 'form-control',
        labelClass: 'form-label',
        labelText: 'Day'
    })
    .monthInputConfig({
        wrapper: 'div',
        wrapperClass: 'col-8 col-md-5',
        class: 'form-select',
        labelClass: 'form-label',
        labelText: 'Month'
    })
    .yearInputConfig({
        wrapper: 'div',
        wrapperClass: 'col-12 col-md-4',
        class: 'form-control',
        labelClass: 'form-label',
        labelText: 'Year'
    })
    .buildDateControls()
    .showReadings(true)
    .listenTo(apiClient);
```

### CSS Note

The `.liturgy-of-any-day` class uses `overflow: hidden` to prevent Bootstrap row negative margins
from extending beyond the card borders.

---

## WebCalendar

**Path:** `examples/WebCalendar/`

Full liturgical calendar table with customizable display options.

![WebCalendar Example](images/webcalendar.png)

### Features

- Calendar and locale selection
- API options for year, year type, etc.
- Configurable grouping (by month or liturgical season)
- Color display options (background, indicator, CSS class)
- Grade display (full or abbreviated)
- Date format options

### Files

| File | Description |
|------|-------------|
| `index.html` | HTML structure |
| `main.js` | WebCalendar setup with full configuration |
| `main.css` | Styling for grades and liturgical colors |

---

## PathBuilder

**Path:** `examples/PathBuilder/`

Interactive API URL builder for exploring the API.

![PathBuilder Example](images/pathbuilder.png)

### Features

- Real-time URL construction
- Calendar and year selection
- Direct link to open API request
- Copy-friendly URL display

### Files

| File | Description |
|------|-------------|
| `index.html` | HTML structure |
| `main.js` | PathBuilder setup |
| `main.css` | Basic styling |

---

## Common Patterns

### Locale Detection

All examples use browser language detection:

```javascript
function getUserLanguages() {
    if (navigator.languages?.length > 0) {
        return [...navigator.languages];
    }
    return navigator.language ? [navigator.language] : ['en'];
}

function findBestLocale(userLanguages, localeOptions) {
    const availableLocales = localeOptions.map(opt => opt.value);
    for (const userLang of userLanguages) {
        // Exact match
        const exactMatch = availableLocales.find(
            locale => locale.toLowerCase() === userLang.toLowerCase()
        );
        if (exactMatch) return exactMatch;

        // Prefix match
        const prefix = userLang.split(/[-_]/)[0].toLowerCase();
        const prefixMatch = availableLocales.find(
            locale => locale.split(/[-_]/)[0].toLowerCase() === prefix
        );
        if (prefixMatch) return prefixMatch;
    }
    return availableLocales[0] || 'en';
}
```

### Bootstrap Integration

All examples use Bootstrap 5 for styling:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
```

### Import Map for Local Development

```html
<script type="importmap">
    {
        "imports": {
            "liturgy-components-js": "../../src/index.js"
        }
    }
</script>
```

For production, change to:

```html
<script type="importmap">
    {
        "imports": {
            "liturgy-components-js": "https://cdn.jsdelivr.net/npm/@liturgical-calendar/components-js@latest/+esm"
        }
    }
</script>
```
