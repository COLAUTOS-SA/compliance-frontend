# Compliance Frontend

Aplicacion web para el sistema de debida diligencia y cumplimiento SAGRILAF de COLAUTOS. Permite autenticar usuarios, gestionar solicitudes, consultar seguimiento, administrar catalogos y operar flujos por segmento de contraparte.

## Tecnologia principal

- React 19
- Vite
- React Router
- Tailwind CSS
- React Icons
- ESLint

## Requisitos

- Node.js 18 o superior recomendado
- npm
- Backend de compliance disponible y accesible desde el navegador

## Instalacion

```bash
npm install
```

Para desarrollo local:

```bash
npm run dev
```

Para construir una version de produccion:

```bash
npm run build
```

Para previsualizar el build:

```bash
npm run preview
```

Para revisar reglas de lint:

```bash
npm run lint
```

## Configuracion de entorno

La aplicacion usa variables de entorno de Vite. Los archivos `.env`, `.env.*` y `.env.example` estan ignorados por Git para evitar subir configuracion de ambientes, endpoints internos o datos sensibles.

Variable principal:

```env
VITE_API_URL=https://compliance.colautos.co/api
```

Notas:

- `VITE_API_URL` debe apuntar al backend, normalmente incluyendo el prefijo `/api`.
- Si no se define, varias pantallas usan como respaldo `https://compliance.colautos.co/api`.
- En desarrollo local, un valor comun seria `http://localhost:3001/api`.
- Las variables de Vite se incorporan al bundle del navegador; no deben contener secretos.

## Estructura del proyecto

```text
src/
  App.jsx                  Definicion principal de rutas
  main.jsx                 Arranque de React
  components/              Componentes reutilizables
  context/                 Contextos de autenticacion y Adobe Sign
  hooks/                   Hooks de integracion
  pages/                   Pantallas principales
  constants/               Catalogos y definiciones estaticas
  mocks/                   Datos de apoyo para desarrollo
public/                    Imagenes y recursos publicos
```

## Rutas de la aplicacion

- `/login` pantalla de inicio de sesion
- `/` redireccion segun usuario autenticado
- `/admin` consola administrativa
- `/segment/:segmento` flujo de gestion por segmento
- `/seguimiento` seguimiento de solicitudes
- `*` pantalla de no encontrado o redireccion a login

Las rutas protegidas dependen del contexto de autenticacion implementado en `src/context/AuthContext.jsx` y del componente `src/components/ProtectedRoute.jsx`.

## Modulos principales

- `AdminConsole.jsx`: administracion de informacion y catalogos operativos.
- `Segment.jsx`: flujo principal por segmento de contraparte.
- `SeguimientoSolicitud.jsx`: consulta y seguimiento de solicitudes.
- `Login.jsx`: autenticacion de usuarios.
- `AdobeContext.jsx` y `useAdobeSign.js`: conexion del frontend con funcionalidades de Adobe Sign expuestas por el backend.
- `segments.js`, `requiredDocs.js` y `adminCatalogs.js`: configuracion funcional usada por las pantallas.

## Conexion con backend

El frontend consume el backend mediante `VITE_API_URL`. Antes de desplegar o probar flujos completos, confirme que:

1. El backend este levantado.
2. `GET /api/` responda correctamente.
3. `GET /db-health` confirme conexion a base de datos.
4. CORS permita llamadas desde el dominio del frontend.
5. Los endpoints de Adobe y archivos esten configurados en el backend si se usaran firmas digitales.

## Build y despliegue

El build de produccion queda en `dist/`, carpeta que esta ignorada por Git.

Checklist recomendado:

1. Definir `VITE_API_URL` para el ambiente de destino.
2. Ejecutar `npm ci`.
3. Ejecutar `npm run lint`.
4. Ejecutar `npm run build`.
5. Publicar el contenido de `dist/` en el hosting web.
6. Configurar fallback de rutas SPA hacia `index.html`.

## Seguridad

- No subir `.env`, `.env.*` ni `.env.example`.
- No guardar tokens o secretos en variables `VITE_*`, porque quedan visibles en el navegador.
- Mantener endpoints internos y credenciales solo en el backend.
- Validar permisos de usuario tambien en el backend, no solo en la interfaz.

## Comandos utiles

```bash
npm install
npm run dev
npm run lint
npm run build
npm run preview
```
