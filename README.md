# VERSA

Plataforma que conecta a músicos emergentes, estudios y salas de ensayo, managers y disqueras de Medellín, y registra la trayectoria de cada músico de forma verificable (doble confirmación).

Sitio estático (HTML + CSS + JS nativo) con **Supabase** como backend (autenticación, base de datos y seguridad por fila) y **Vercel** como hosting. No hay paso de build.

## Estructura

```
.
├── index.html                      Landing
├── ingresar/index.html             /ingresar/       Inicio de sesión
├── registro/index.html             /registro/       Crear cuenta (4 tipos de actor)
├── cuenta/index.html               /cuenta/         Perfil, visibilidad, contacto, datos
├── directorio/index.html           /directorio/     Búsqueda de perfiles públicos
├── perfil/index.html               /perfil/?id=…    Perfil público y trayectoria
├── trayectoria/index.html          /trayectoria/    Registrar trabajos y confirmar los de otros
├── legal/
│   ├── privacidad/index.html       /legal/privacidad/
│   └── terminos/index.html         /legal/terminos/
│
├── assets/
│   ├── css/
│   │   ├── site.css                Tokens de diseño, estilos globales y landing
│   │   └── app.css                 Formularios, tarjetas, perfil, trayectoria
│   └── js/
│       ├── core/                   Se carga en todas las páginas
│       │   ├── config.js           URL y anon key de Supabase (pública por diseño)
│       │   ├── app.js              Cliente Supabase, sesión, navegación y utilidades (window.VERSA)
│       │   └── ui.js               Menú móvil, animaciones de aparición
│       └── pages/                  Un archivo por página (la lógica propia de cada una)
│           ├── auth.js             registro + ingresar
│           ├── cuenta.js
│           ├── directorio.js
│           ├── perfil.js
│           ├── trayectoria.js
│           └── legal.js
│
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  Tablas, triggers, funciones y políticas RLS
│
├── docs/
│   └── SETUP.md                    Puesta en marcha, pruebas y pendientes
├── vercel.json                     URLs limpias y cabeceras de seguridad
└── README.md
```

## Convenciones

- **Una carpeta por página** (`/ruta/index.html`) para tener URLs limpias (`/registro/`) sin extensión `.html`.
- **Rutas absolutas** a los recursos (`/assets/...`) y a los enlaces internos (`/directorio/`).
- **Una pieza de JS por página** en `assets/js/pages/`; lo compartido vive en `assets/js/core/` y se expone en `window.VERSA`.
- **La seguridad está en la base de datos**, no en el navegador: las políticas RLS y los triggers de `supabase/migrations/` deciden quién lee y escribe qué (incluido el estado «verificado» de los trabajos).
- Cambios de esquema: añade un archivo nuevo `00N_descripcion.sql` en `supabase/migrations/`; no edites los anteriores una vez aplicados.
- Los documentos de la propuesta (`*.pptx`, `*.docx`, `*.pdf`) están en `.gitignore` y no forman parte de la app.

## Empezar

Ver [docs/SETUP.md](docs/SETUP.md).
