# Embeddable Governance Widget

The VoteChain governance widget (`<votechain-proposals>`) is a zero-dependency Web Component
that lets any DAO website display live proposal data without building a frontend from scratch
and without requiring a wallet connection.

## Quick start

Add one script tag and one custom element to your HTML:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>My DAO — Governance</title>
</head>
<body>

  <votechain-proposals
    api-url="https://api.votechain.dev"
    theme="light"
    limit="5"
    filter-state="active">
  </votechain-proposals>

  <!-- Load from CDN (replace x.y.z with the current release) -->
  <script src="https://cdn.jsdelivr.net/npm/votechain-widget@x.y.z/dist/votechain-widget.iife.js"></script>

</body>
</html>
```

## Attributes

| Attribute      | Type             | Default    | Description                                          |
|----------------|------------------|------------|------------------------------------------------------|
| `api-url`      | string (URL)     | —          | Base URL of the VoteChain API. **Required.**         |
| `theme`        | `light` \| `dark`| `light`    | Widget colour scheme.                                |
| `limit`        | number           | `5`        | Maximum number of proposals to display.              |
| `filter-state` | string           | `active`   | Filter by proposal state (`active`, `passed`, `rejected`, `executed`, `cancelled`). Pass `""` to show all states. |

## Examples

### Dark theme, 3 proposals, all states

```html
<votechain-proposals
  api-url="https://api.votechain.dev"
  theme="dark"
  limit="3"
  filter-state="">
</votechain-proposals>
```

### Self-hosted API

```html
<votechain-proposals
  api-url="https://governance.mydao.xyz"
  theme="light"
  limit="10"
  filter-state="active">
</votechain-proposals>
```

## CSS custom properties

You can further style the widget using CSS custom properties on the host element:

```css
votechain-proposals {
  --vc-bg: #f8f9fa;
  --vc-text: #212529;
  --vc-border: #dee2e6;
  --vc-card-bg: #ffffff;
  --vc-meta: #6c757d;
  --vc-badge-bg: #e9ecef;
  --vc-badge-text: #495057;
}
```

## Building from source

The widget lives in `frontend/widget/` and is built with Vite:

```bash
cd frontend/widget
npm install
npm run build
# Output: frontend/widget/dist/votechain-widget.iife.js
```

The `iife` format produces a single self-contained JS file suitable for CDN distribution.

## Browser support

Any browser with [Custom Elements v1](https://caniuse.com/custom-elementsv1) support
(all modern browsers). No polyfills required.

## No wallet required

The widget makes only read-only `GET` requests to the public API. No wallet connection,
no signing, no private keys needed.
