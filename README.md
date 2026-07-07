# CW Paywall Marker

Chrome extension for marking paid articles on CW listing pages.

## Install

1. Open `chrome://extensions/`.
2. Turn on Developer mode.
3. Click Load unpacked.
4. Select this folder: `chromeEx`.

## Use

Open a CW listing page, for example:

```text
https://www.cw.com.tw/subchannel.action?idSubChannel=608
```

The extension scans article links on the page. If an article HTML contains a `paywall` marker, it adds `🔒` before the title.
