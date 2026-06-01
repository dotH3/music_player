# Cover Bleed 🎨🎵

Reproductor de **álbumes** para Android, hecho como **PWA** (app web instalable) con
Vite + Tailwind. Elegís una carpeta de música, agrupa todo en álbumes y, mientras
escuchás, **el color dominante de la portada tiñe toda la pantalla**.

> Estilo elegido: _Cover Bleed_ — la portada es la protagonista.

## Cómo se ve / cómo funciona

- **Inicio:** grilla de portadas de todos tus álbumes.
- **Tocás un álbum:** se abre el reproductor con la portada grande y el fondo
  teñido con sus colores. Controles play/pausa, anterior/siguiente, barra de
  progreso y lista de pistas (deslizá hacia abajo).
- **Mini-barra:** mientras suena algo, una barra abajo te lleva de vuelta al reproductor.
- Lee tags (álbum, artista, nº de pista) y la portada **embebida** en los archivos
  (o un `cover.jpg` / `folder.jpg` dentro de la carpeta del álbum).
- Formatos: mp3, m4a/aac, flac, ogg/opus, wav, webm.
- Agrupa **una carpeta = un álbum** (como guardás tu música).

## Probarlo en tu teléfono (modo desarrollo)

```bash
npm install
npm run dev          # muestra una URL "Network", p.ej. http://192.168.x.x:5173
```

En el celu (en la **misma WiFi**) abrí esa URL en **Chrome**. Tocá **Elegir
carpeta**, seleccioná tu carpeta de música y listo.

## Instalarlo como app (recomendado)

La instalación como app ("Agregar a pantalla de inicio") y el modo offline
necesitan **HTTPS**. Lo más simple es publicarlo en un hosting estático gratis:

```bash
npm run build        # genera dist/
```

Subí la carpeta `dist/` a Netlify / Vercel / GitHub Pages / Cloudflare Pages.
Después abrís la URL `https://…` en Chrome del celu → menú → **Agregar a pantalla
de inicio**. Queda como una app de verdad, a pantalla completa.

> En una IP de LAN por `http://` el navegador no instala la PWA ni registra el
> service worker (es una restricción de seguridad del navegador, no del código).
> El selector de carpeta sí funciona igual en modo `dev`.

## Scripts

| Comando            | Qué hace                                        |
| ------------------ | ----------------------------------------------- |
| `npm run dev`      | Servidor de desarrollo (expuesto en la LAN)     |
| `npm run build`    | Build de producción en `dist/`                  |
| `npm run preview`  | Sirve el build de producción                    |
| `npm run icons`    | Regenera los iconos PWA desde el SVG            |

## Limitaciones del MVP (a propósito)

- **Re-elegís la carpeta cada vez** que abrís la app. Los navegadores de Android
  no permiten acceso persistente a carpetas desde una web. Para acceso
  persistente y una app nativa real, el mismo código se puede empaquetar con
  **Capacitor** (APK) más adelante — requiere instalar JDK + Android SDK.
- No hay búsqueda, playlists ni ecualizador: es un reproductor de álbumes y nada más.

## Estructura

```
src/
  main.js            # controlador: estado, navegación, mini-barra, registro del SW
  style.css          # Tailwind v4 + estilos del "bleed", grano, slider, animaciones
  lib/
    scanner.js       # FileList -> álbumes (tags + portada, agrupado por carpeta)
    color.js         # extrae la paleta dominante de cada portada (canvas)
    player.js        # motor de audio (<audio> + Media Session API)
  ui/
    library.js       # grilla de álbumes / estados vacío y de carga
    nowplaying.js     # reproductor cover-bleed + lista de pistas
    icons.js         # iconos SVG inline
public/
  manifest.webmanifest, sw.js, icons/   # PWA
scripts/gen-icons.js  # genera los PNG de iconos con sharp
```
