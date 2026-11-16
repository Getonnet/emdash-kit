# Kilde for emdash-kit-how-to.pdf

`how-to.html` er kilden til `../emdash-kit-how-to.pdf` (6 sider A4). Endre HTML-en, og skriv ut på nytt med Chrome:

```sh
cd docs/how-to-kilde
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --no-pdf-header-footer \
  --print-to-pdf="$(cygpath -w "$PWD/../emdash-kit-how-to.pdf")" "file:///$(cygpath -m "$PWD")/how-to.html"
```

- `img/`: skjermbilder (GetOnNet fra live-nettstedet, AESTO-fargene fra en lokal testserver med kit 1.1)
- `fonts/`: Figtree og Bricolage Grotesque (samme filer som getonnet.no bruker)
