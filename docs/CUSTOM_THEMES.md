# Theme Development Guide

sixonefour uses a folder-based theme system. Each theme is contained within its own directory and defined by a
`theme.json` manifest file.

## Theme Structure

A typical theme folder looks like this:

```text
themes/
  MyCustomTheme/
    theme.json      # Theme metadata (required)
    styles.css      # CSS styles (required)
    logo.png        # Custom logo (optional)
    background.mp4  # Video background (optional)
```

## The manifest (`theme.json`)

The `theme.json` file defines your theme's properties and maps its assets.

```json
{
    "name": "My Custom Theme",
    "description": "A beautiful dark theme with a video background",
    "version": "1.0.0",
    "author": "YourName",
    "style": "styles.css",
    "assets": {
        "logo": "logo.png",
        "videoBackground": "background.mp4"
    }
}
```

### Manifest Fields

| Field         | Type   | Description                                             |
| :------------ | :----- | :------------------------------------------------------ |
| `name`        | string | The display name of your theme.                         |
| `description` | string | A short summary shown in the settings.                  |
| `version`     | string | Semantic versioning (e.g., 1.0.0).                      |
| `author`      | string | Your name or handle.                                    |
| `style`       | string | Path to the main CSS file relative to the theme folder. |
| `assets`      | object | Optional assets like `logo` and `videoBackground`.      |

## CSS Development

Your CSS file modifies the SoundCloud interface. Use `!important` to ensure your styles take precedence.

```css
/* Example: Changing the main background */
body {
    background-color: #0d0d0d !important;
}

/* Example: Styling the header */
.header {
    background: rgba(0, 0, 0, 0.8) !important;
    backdrop-filter: blur(10px);
}
```

> [!TIP] For a full list of available CSS selectors, see [SELECTORS_LIST.md](./SELECTORS_LIST.md).

## Working with Assets

### Custom Logo

You can replace the default SoundCloud logo in the header.

1. Add your image (PNG/SVG recommended) to the theme folder.
2. Link it in `theme.json` under `assets.logo`.

### Video Backgrounds

You can add a custom video background that plays behind the UI.

1. Add your video (MP4 recommended) to the theme folder.
2. Link it in `theme.json` under `assets.videoBackground`.

## Installation & Usage

1. **Access Themes Folder**:
    - Open Settings (`F1`).
    - Click **Open Themes Folder**.
2. **Install**: Place your theme folder into the opened directory.
3. **Usage**:
    - Click **Refresh Themes** in settings.
    - Select your theme from the dropdown.

---

## Contributing

If you've created a great theme, feel free to open a Pull Request! Please ensure your theme follows the folder structure
and includes a valid `theme.json`.
