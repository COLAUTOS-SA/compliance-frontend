# 🚀 GUÍA COMPLETA: Implementación Backend Adobe Sign

## 📌 ANTES DE EMPEZAR

### 1. Obtener Credenciales de Adobe Sign

**Pasos:**
1. Accede a https://secure.na3.adobesign.com/web/login (usa tu cuenta de Adobe)
2. Ve a **Dashboard** → **Integraciones** → **APIs** en el lado izquierdo
3. Haz clic en **"Crear una aplicación OAuth"**
4. Configura:
   - **Nombre de Aplicación:** "Colautos Compliance"
   - **Redirection URI:** `https://compliance.colautos.co/api/adobe/callback` (HTTPS obligatorio en prod)
   - **Scopes requeridos (SELECCIONA TODOS):**
     - ✅ `agreement_write` - Crear/enviar acuerdos
     - ✅ `agreement_read` - Leer estado de acuerdos
     - ✅ `library_write` - Acceso a templates
     - ✅ `webhook_write` - Crear webhooks

5. **Copia y GUARDA:**
   - `Client ID` → Variable `ADOBE_CLIENT_ID`
   - `Client Secret` → Variable `ADOBE_CLIENT_SECRET`

### 2. Configurar Webhook en Adobe Sign

**Pasos:**
1. Dashboard Adobe Sign → **Integraciones** → **Webhooks**
2. Haz clic en **"Crear Webhook"**
3. Configura:
   - **Webhook Name:** "Colautos Compliance"
   - **Webhook URL:** `https://compliance.colautos.co/api/adobe/webhook`
   - **Selecciona TODOS estos eventos:**
     - ✅ `agreement.created`
     - ✅ `agreement.signed`
     - ✅ `agreement.rejected`
     - ✅ `agreement.expired`
   - **Webhook Secret:** Se genera automáticamente en Adobe (COPIAR)

4. **Copia:**
   - `Webhook Secret` → Variable `ADOBE_WEBHOOKS_SECRET`

### 3. Crear Templates en Adobe Sign

Para cada tipo de contraparte, crea un template en Adobe Sign con los campos que se van a rellenar dinámicamente:

**Template 1: PROVEEDOR**
- Nombre: `template-proveedor-dd`
- Campos con merge:
  - `{{nombre}}` - Nombre/Razón social
  - `{{correo}}` - Email
  - `{{nro_doc}}` - Número documento
  - Firma (Signature field)
  - Fecha automática

**Template 2: CLIENTE**
- Nombre: `template-cliente-dd`
- (Mismo patrón de campos)

**Template 3: ACCIONISTA**
- Nombre: `template-accionista-dd`
- (Mismo patrón de campos)

**Template 4: EMPLEADO**
- Nombre: `template-empleado-dd`
- (Mismo patrón de campos)

Después de crear cada template, copia el **Template ID** (usarás en código backend para cada uno)

---

## 🛠️ IMPLEMENTACIÓN BACKEND (Node.js/Express)

### PASO 1: Variables de Entorno (.env)

```env
# Adobe Sign Credentials
ADOBE_CLIENT_ID=xxxxxxx
ADOBE_CLIENT_SECRET=xxxxxxx
ADOBE_WEBHOOKS_SECRET=xxxxxxx
ADOBE_API_BASE_URL=https://api.na3.adobesign.com

# Templates IDs (de Adobe Sign)
ADOBE_TEMPLATE_PROVEEDOR=xxxxx
ADOBE_TEMPLATE_CLIENTE=xxxxx
ADOBE_TEMPLATE_ACCIONISTA=xxxxx
ADOBE_TEMPLATE_EMPLEADO=xxxxx

# Storage
STORAGE_PATH=/uploads/documentos-firmados
STORAGE_URL=https://compliance.colautos.co/uploads

# Webhook
BACKEND_WEBHOOK_URL=https://compliance.colautos.co/api/adobe/webhook

# Email
EMAIL_SERVICE=gmail  # o tu proveedor
EMAIL_USER=cumplimiento@colautos.co
EMAIL_PASSWORD=xxxxx
EMAIL_FROM=Colautos Cumplimiento <cumplimiento@colautos.co>
```

### PASO 2: Crear Tabla en BD

```sql
CREATE TABLE adobe_agreements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  id_solicitud INT NOT NULL UNIQUE,
  id_contraparte INT NOT NULL,
  agreement_id VARCHAR(255) UNIQUE NOT NULL,
  template_id VARCHAR(255),
  status ENUM('draft','sent','signed','rejected','expired') DEFAULT 'draft',
  widget_id VARCHAR(255),
  signing_url TEXT,
  pdf_url TEXT,
  pdf_path VARCHAR(500),
  signers_info JSON,  -- {email, name, status}
  fecha_firma DATETIME,
  fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id) ON DELETE CASCADE,
  FOREIGN KEY (id_contraparte) REFERENCES contrapartes(id) ON DELETE CASCADE,
  INDEX idx_agreement_id (agreement_id),
  INDEX idx_status (status)
);
```

### PASO 3: Instalar Dependencias

```bash
npm install axios nodemailer crypto dotenv
# o si usas otro mailer: npm install nodemailer
```

### PASO 4: Crear Servicio Adobe Sign (adobeSignService.js)

```javascript
// backend/services/adobeSignService.js

const axios = require('axios');
const crypto = require('crypto');

class AdobeSignService {
  constructor(clientId, clientSecret, apiBaseUrl) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.apiBaseUrl = apiBaseUrl;
    this.accessToken = null;
    this.tokenExpiresAt = null;
  }

  /**
   * Obtiene token de acceso OAuth
   */
  async getAccessToken() {
    // Si el token está vigente, devolverlo
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/oauth/token`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
          grant_type: 'client_credentials',
          scope: 'agreement_write agreement_read webhook_write',
        },
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = Date.now() + (response.data.expires_in * 1000) - 60000; // 1 min antes

      return this.accessToken;
    } catch (err) {
      console.error('Error obteniendo token de Adobe Sign:', err.response?.data || err.message);
      throw new Error('Failed to get Adobe Sign access token');
    }
  }

  /**
   * Crea un acuerdo a partir de un template y lo personaliza
   */
  async createAgreementFromTemplate(templateId, tipoContraparte, datos) {
    const token = await this.getAccessToken();

    try {
      const payload = {
        fileInfos: [
          {
            // Usar template ID
            libraryDocumentId: templateId,
          },
        ],
        name: `DD_${tipoContraparte}_${datos.nombre.replace(/\s+/g, '_')}`,
        participantSetsInfo: [
          {
            memberInfos: [
              {
                email: datos.correo,
                name: datos.nombre,
              },
            ],
            order: 1,
            role: 'SIGNER',
          },
        ],
        signatureType: 'ESIGN',
        state: 'SENT',
        // Merge fields para personalizar
        mergeFieldsInfo: [
          {
            fieldName: 'nombre',
            values: [datos.nombre],
          },
          {
            fieldName: 'correo',
            values: [datos.correo],
          },
          {
            fieldName: 'nro_doc',
            values: [datos.nro_doc],
          },
        ],
      };

      const response = await axios.post(
        `${this.apiBaseUrl}/v6/agreements`,
        payload,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error('Error creando acuerdo:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Crea un widget de firma (solo lectura del acuerdo)
   */
  async createSigningWidget(agreementId, tipoContraparte) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.post(
        `${this.apiBaseUrl}/v6/widgets`,
        {
          agreementId: agreementId,
          redirectUrl: 'https://compliance.colautos.co/segment', // Redirige al completar
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error('Error creando widget:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Obtiene el estado actual del acuerdo
   */
  async getAgreementStatus(agreementId) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/v6/agreements/${agreementId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      return response.data;
    } catch (err) {
      console.error('Error obteniendo estado:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Descarga el PDF del acuerdo firmado
   */
  async downloadSignedDocument(agreementId) {
    const token = await this.getAccessToken();

    try {
      const response = await axios.get(
        `${this.apiBaseUrl}/v6/agreements/${agreementId}/combinedDocument`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          responseType: 'arraybuffer',
        }
      );

      return response.data; // Buffer del PDF
    } catch (err) {
      console.error('Error descargando documento:', err.response?.data || err.message);
      throw err;
    }
  }

  /**
   * Valida la firma HMAC del webhook
   */
  validateWebhookSignature(payload, signature, secret) {
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(payload)
      .digest('hex');

    return hmac === signature;
  }
}

module.exports = AdobeSignService;
```

### PASO 5: Crear Endpoints

```javascript
// backend/routes/adobeRoutes.js

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const AdobeSignService = require('../services/adobeSignService');
const db = require('../db');  // Tu conexión a BD
const { sendEmailWithAttachment } = require('../services/emailService');

// Inicializar servicio
const adobeSign = new AdobeSignService(
  process.env.ADOBE_CLIENT_ID,
  process.env.ADOBE_CLIENT_SECRET,
  process.env.ADOBE_API_BASE_URL
);

// Mapear tipos de contraparte a template IDs
const TEMPLATE_IDS = {
  'PROVEEDOR': process.env.ADOBE_TEMPLATE_PROVEEDOR,
  'CLIENTE': process.env.ADOBE_TEMPLATE_CLIENTE,
  'ACCIONISTA': process.env.ADOBE_TEMPLATE_ACCIONISTA,
  'EMPLEADO': process.env.ADOBE_TEMPLATE_EMPLEADO,
};

/**
 * POST /api/adobe/initiate-signing
 * Inicia el proceso de firma
 */
router.post('/initiate-signing', async (req, res) => {
  try {
    const {
      id_solicitud,
      id_contraparte,
      tipo_contraparte,
      nombre,
      correo,
      nro_doc,
    } = req.body;

    if (!id_solicitud || !id_contraparte || !tipo_contraparte) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros requeridos',
      });
    }

    const templateId = TEMPLATE_IDS[tipo_contraparte];
    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Tipo de contraparte no válido',
      });
    }

    // 1) Crear acuerdo desde template
    const agreementData = await adobeSign.createAgreementFromTemplate(
      templateId,
      tipo_contraparte,
      { nombre, correo, nro_doc }
    );

    const agreementId = agreementData.id;
    if (!agreementId) {
      throw new Error('No se recibió agreement_id de Adobe Sign');
    }

    // 2) Crear widget de firma
    const widgetData = await adobeSign.createSigningWidget(
      agreementId,
      tipo_contraparte
    );

    const widgetId = widgetData.id;
    if (!widgetId) {
      throw new Error('No se recibió widget_id');
    }

    // 3) Guardar en BD tabla adobe_agreements
    const sql = `
      INSERT INTO adobe_agreements
        (id_solicitud, id_contraparte, agreement_id, template_id, status, widget_id)
      VALUES (?, ?, ?, ?, 'sent', ?)
    `;

    db.query(sql, [id_solicitud, id_contraparte, agreementId, templateId, widgetId],
      (err, result) => {
        if (err) {
          console.error('Error guardando agreement en BD:', err);
          return res.status(500).json({
            success: false,
            message: 'Error guardando agreement en BD',
          });
        }

        res.json({
          success: true,
          data: {
            agreement_id: agreementId,
            widget_id: widgetId,
            signing_url: widgetData.url,
          },
        });
      }
    );
  } catch (err) {
    console.error('Error en initiate-signing:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Error al iniciar firma',
    });
  }
});

/**
 * GET /api/adobe/agreement/:agreementId
 * Obtiene el estado del acuerdo
 */
router.get('/agreement/:agreementId', async (req, res) => {
  try {
    const { agreementId } = req.params;

    const statusData = await adobeSign.getAgreementStatus(agreementId);

    // Mapear estado de Adobe al nuestro
    const status = statusData.status?.toLowerCase() || 'unknown';

    res.json({
      success: true,
      data: {
        status: status,
        signers_info: statusData.participantSetsInfo,
      },
    });
  } catch (err) {
    console.error('Error obteniendo estado:', err);
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
});

/**
 * POST /api/adobe/webhook
 * Webhook que Adobe Sign llama cuando hay eventos
 */
router.post('/webhook', async (req, res) => {
  try {
    // CRÍTICO: Validar signature HMAC
    const signature = req.headers['x-adobe-signature'];
    const payload = req.rawBody; // Middleware debe guardar body crudo

    if (!signature || !adobeSign.validateWebhookSignature(
      payload,
      signature,
      process.env.ADOBE_WEBHOOKS_SECRET
    )) {
      console.warn('Webhook signature inválida');
      return res.status(401).json({ success: false, error: 'Invalid signature' });
    }

    const body = req.body;
    console.log('Webhook recibido:', JSON.stringify(body, null, 2));

    // Procesar eventos
    if (!body.webhookEvents || body.webhookEvents.length === 0) {
      return res.json({ success: true });
    }

    for (const event of body.webhookEvents) {
      const eventCode = event.eventCode; // AGREEMENT_SIGNED, AGREEMENT_REJECTED, etc
      const agreementAssets = body.agreementAssetList || [];

      if (agreementAssets.length === 0) continue;

      const agreement = agreementAssets[0];
      const agreementId = agreement.id;

      console.log(`Evento: ${eventCode}, Agreement: ${agreementId}`);

      // Obtener información de BD
      const sqlSelect = 'SELECT * FROM adobe_agreements WHERE agreement_id = ?';
      db.query(sqlSelect, [agreementId], async (err, results) => {
        if (err) {
          console.error('Error en query:', err);
          return;
        }

        if (results.length === 0) {
          console.warn(`Agreement no encontrado en BD: ${agreementId}`);
          return;
        }

        const adobeAgreement = results[0];
        const solicitudId = adobeAgreement.id_solicitud;
        const contraparteId = adobeAgreement.id_contraparte;

        // ========== AGREEMENT_SIGNED ==========
        if (eventCode === 'AGREEMENT_SIGNED') {
          try {
            // 1) Descargar PDF
            const pdfBuffer = await adobeSign.downloadSignedDocument(agreementId);

            // 2) Guardar en almacenamiento
            const filename = `${solicitudId}_${agreementId}.pdf`;
            const uploadPath = path.join(process.env.STORAGE_PATH, filename);

            // Crear directorio si no existe
            if (!fs.existsSync(process.env.STORAGE_PATH)) {
              fs.mkdirSync(process.env.STORAGE_PATH, { recursive: true });
            }

            fs.writeFileSync(uploadPath, pdfBuffer);

            const pdfUrl = `${process.env.STORAGE_URL}/${filename}`;

            // 3) Actualizar BD
            const sqlUpdate = `
              UPDATE adobe_agreements
              SET status = 'signed', pdf_url = ?, pdf_path = ?, fecha_firma = NOW()
              WHERE agreement_id = ?
            `;
            db.query(sqlUpdate, [pdfUrl, uploadPath, agreementId], (err) => {
              if (err) {
                console.error('Error actualizando BD:', err);
                return;
              }

              // También actualizar solicitudes
              const sqlUpdateSolicitud = `
                UPDATE solicitudes
                SET conocimiento_contrapartes = ?
                WHERE id = ?
              `;
              db.query(sqlUpdateSolicitud, [pdfUrl, solicitudId], (err) => {
                if (err) console.error('Error actualizando solicitud:', err);
              });
            });

            // 4) Enviar email a contraparte
            // Obtener email de la contraparte
            const sqlGetContraparte = 'SELECT Correo, Nombre FROM contrapartes WHERE id = ?';
            db.query(sqlGetContraparte, [contraparteId], (err, contraResults) => {
              if (err || contraResults.length === 0) {
                console.error('Error obteniendo email contraparte:', err);
                return;
              }

              const contraparte = contraResults[0];
              const emailContent = `
                Estimado/a ${contraparte.Nombre},

                Tu documento de debida diligencia ha sido firmado exitosamente.

                La Oficial de Cumplimiento revisará tu solicitud y te notificará
                del resultado en los próximos días.

                Puedes consultar el estado en: https://compliance.colautos.co/seguimiento

                Saludos,
                Equipo de Cumplimiento - Colautos
              `;

              sendEmailWithAttachment({
                to: contraparte.Correo,
                subject: 'Tu documento de debida diligencia ha sido firmado',
                text: emailContent,
                attachmentPath: uploadPath,
                attachmentName: filename,
              }).catch(err => console.error('Error enviando email:', err));
            });
          } catch (err) {
            console.error('Error procesando AGREEMENT_SIGNED:', err);
          }
        }
        // ========== AGREEMENT_REJECTED ==========
        else if (eventCode === 'AGREEMENT_REJECTED') {
          const sqlUpdate = 'UPDATE adobe_agreements SET status = ? WHERE agreement_id = ?';
          db.query(sqlUpdate, ['rejected', agreementId], (err) => {
            if (err) console.error('Error actualizando status:', err);
          });

          // Obtener email y enviar notificación
          const sqlGetContraparte = 'SELECT Correo, Nombre FROM contrapartes WHERE id = ?';
          db.query(sqlGetContraparte, [contraparteId], (err, contraResults) => {
            if (err || contraResults.length === 0) return;

            const contraparte = contraResults[0];
            const emailContent = `
              Estimado/a ${contraparte.Nombre},

              El proceso de firma fue rechazado. Por favor intenta de nuevo.

              Si necesitas ayuda, contacta a: cumplimiento@colautos.co

              Saludos,
              Equipo de Cumplimiento
            `;

            sendEmailWithAttachment({
              to: contraparte.Correo,
              subject: 'Tu firma ha sido rechazada',
              text: emailContent,
            }).catch(err => console.error('Error enviando email:', err));
          });
        }
        // ========== AGREEMENT_EXPIRED ==========
        else if (eventCode === 'AGREEMENT_EXPIRED') {
          const sqlUpdate = 'UPDATE adobe_agreements SET status = ? WHERE agreement_id = ?';
          db.query(sqlUpdate, ['expired', agreementId], (err) => {
            if (err) console.error('Error actualizando status:', err);
          });

          // Notificar
          const sqlGetContraparte = 'SELECT Correo, Nombre FROM contrapartes WHERE id = ?';
          db.query(sqlGetContraparte, [contraparteId], (err, contraResults) => {
            if (err || contraResults.length === 0) return;

            const contraparte = contraResults[0];
            const emailContent = `
              Estimado/a ${contraparte.Nombre},

              El plazo para firmar has vencido (30 días).
              Deberás generar un nuevo documento para continuar.

              Contacta a: cumplimiento@colautos.co

              Saludos,
              Equipo de Cumplimiento
            `;

            sendEmailWithAttachment({
              to: contraparte.Correo,
              subject: 'Tu solicitud de firma ha expirado',
              text: emailContent,
            }).catch(err => console.error('Error enviando email:', err));
          });
        }
      });
    }

    // Responder a Adobe que recibimos el webhook
    res.json({ success: true });
  } catch (err) {
    console.error('Error en webhook:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
```

### PASO 6: Servicio de Email (emailService.js)

```javascript
// backend/services/emailService.js

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',  // O tu servicio
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

async function sendEmailWithAttachment({ to, subject, text, attachmentPath, attachmentName }) {
  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to,
    subject,
    text,
  };

  if (attachmentPath) {
    mailOptions.attachments = [
      {
        filename: attachmentName,
        path: attachmentPath,
      },
    ];
  }

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Email enviado a ${to}`);
  } catch (err) {
    console.error(`Error enviando email a ${to}:`, err);
    throw err;
  }
}

module.exports = { sendEmailWithAttachment };
```

### PASO 7: Middleware para Webhook (en app.js o main server file)

```javascript
// backend/app.js o server.js

const express = require('express');
const app = express();

// CRÍTICO: Guardar body crudo para validación HMAC
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Rutas de Adobe Sign
const adobeRoutes = require('./routes/adobeRoutes');
app.use('/api/adobe', adobeRoutes);

// Servir estáticos para PDFs
app.use('/uploads', express.static(process.env.STORAGE_PATH));

// ... resto de rutas ...

app.listen(3001, () => {
  console.log('Backend escuchando en puerto 3001');
});
```

---

## ✅ VERIFICACIÓN Y PRUEBAS

### Test Local del Webhook

```bash
# 1. Generar firma HMAC correcta
PAYLOAD='{"eventCode":"AGREEMENT_SIGNED","agreementAssetList":[{"id":"xxx","status":"SIGNED"}]}'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "your-webhook-secret" -hex | cut -d' ' -f2)

# 2. Enviar POST al webhook
curl -X POST https://compliance.colautos.co/api/adobe/webhook \
  -H "Content-Type: application/json" \
  -H "x-adobe-signature: $SIGNATURE" \
  -d "$PAYLOAD"
```

### Test Completo End-to-End

1. ✅ Login y acceder a segmento (ej: /segment/proveedores-generales-pj)
2. ✅ Completar datos básicos
3. ✅ Clic en "Iniciar firma"
4. ✅ Ver que aparezca iframe de Adobe Sign
5. ✅ Firma en Adobe Sign (en test, puede ser firma digital)
6. ✅ Verificar que polling detecte firma (3 segundos)
7. ✅ Mensaje "✅ Documento firmado correctamente"
8. ✅ Adjuntar documentos requeridos
9. ✅ Clic "Guardar solicitud"
10. ✅ Verificar BD: Datos en `solicitudes`, `contrapartes`, `archivos`, `adobe_agreements`
11. ✅ Verificar almacenamiento: PDF está en `/uploads/documentos-firmados/`
12. ✅ Verificar email: Contraparte recibe copia en su inbox

### Comandos MySQL para Verificar

```sql
-- Ver solicitud creada
SELECT * FROM solicitudes WHERE segmento_slug = 'proveedores-generales-pj';

-- Ver acuerdo de Adobe
SELECT * FROM adobe_agreements WHERE status = 'signed';

-- Ver contacto de contraparte
SELECT * FROM contrapartes WHERE Nombre LIKE '%test%';

-- Ver archivos registrados
SELECT * FROM archivos WHERE id_solicitud = xxx;
```

---

## 🐛 TROUBLESHOOTING

**Problema:** "Error obteniendo token de Adobe Sign"
- ✅ Verifica Client ID y Client Secret (sin espacios)
- ✅ Verifica que OAuth esté habilitado en Adobe

**Problema:** "Widget no aparece después de iniciar firma"
- ✅ Verifica que widget_id se retornó correctamente
- ✅ Verifica que la URL sea HTTPS en "Redirection URI"

**Problema:** "Webhook no se llama"
- ✅ Verifica que webhook URL sea HTTPS
- ✅ En Adobe Sign dashboard, ve a "Webhooks" y revisa "Delivery Log"
- ✅ Prueba manualmente con curl (ver Test Local arriba)

**Problema:** "PDF no se guarda"
- ✅ Verifica permisos de `/uploads` (debe ser 755)
- ✅ Verifica que la ruta exista, sino se crea automáticamente

**Problema:** "Email no llega"
- ✅ Si usas Gmail: Habilita "Contraseñas de aplicación" (no contraseña normal)
- ✅ Verifica que EMAIL_USER y EMAIL_PASSWORD sean correctos
- ✅ Prueba sending directo: `node -e "require('./emailService').sendEmail(...)"`

---

## 📌 CHECKLIST DE IMPLEMENTACIÓN

- [ ] Obtener credenciales Adobe Sign (Client ID, Secret)
- [ ] Crear 4 templates en Adobe Sign
- [ ] Configurar webhook en Adobe Sign dashboard
- [ ] Crear tabla `adobe_agreements` en BD
- [ ] Instalar dependencias (axios, nodemailer)
- [ ] Crear `adobeSignService.js`
- [ ] Crear endpoints en `/api/adobe`
- [ ] Crear `emailService.js`
- [ ] Agregar middleware de webhook en app.js
- [ ] Llenar `.env` con todas las variables
- [ ] Crear directorio `/uploads/documentos-firmados`
- [ ] Test local del webhook
- [ ] Test end-to-end completo
- [ ] Verificar en BD y email
- [ ] Deploy a VPS

---

## 🚀 DEPLOYMENT A VPS

Antes de desplegar, confirma:

1. ✅ HTTPS configurado (SSL certificate)
2. ✅ URLs apuntan a `https://compliance.colautos.co`
3. ✅ Webhook URL registrada en Adobe Sign
4. ✅ Variables de entorno en servidor
5. ✅ Directorio `/uploads` con permisos 755
6. ✅ Email service configurado
7. ✅ BD creada con tabla `adobe_agreements`

```bash
# En VPS, antes de iniciar:
export ADOBE_CLIENT_ID=xxxxx
export ADOBE_CLIENT_SECRET=xxxxx
# ... etc todas las variables

npm start
```

---

**¡Éxito con la implementación! 🎉**
