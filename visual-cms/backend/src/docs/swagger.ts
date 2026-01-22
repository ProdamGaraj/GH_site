/**
 * Swagger UI Route
 * 
 * Отдаёт Swagger UI для документации API
 */

import { Router, Request, Response } from 'express'
import { openApiSpec } from './openapi'

const router = Router()

// Swagger UI HTML template
const swaggerUiHtml = (specUrl: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Visual CMS API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui.css" />
  <style>
    body { margin: 0; padding: 0; }
    .swagger-ui .topbar { display: none; }
    .swagger-ui .info { margin: 20px 0; }
    .swagger-ui .info .title { font-size: 32px; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.10.3/swagger-ui-bundle.js"></script>
  <script>
    window.onload = function() {
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout",
        tryItOutEnabled: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>
`

// ReDoc HTML template (alternative documentation)
const redocHtml = (specUrl: string) => `
<!DOCTYPE html>
<html>
<head>
  <title>Visual CMS API Documentation</title>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css?family=Montserrat:300,400,700|Roboto:300,400,700" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; }
  </style>
</head>
<body>
  <redoc spec-url='${specUrl}'></redoc>
  <script src="https://cdn.redoc.ly/redoc/latest/bundles/redoc.standalone.js"></script>
</body>
</html>
`

/**
 * GET /docs - Swagger UI
 */
router.get('/', (req: Request, res: Response) => {
  const protocol = req.protocol
  const host = req.get('host')
  const specUrl = `${protocol}://${host}/api/docs/openapi.json`
  
  res.setHeader('Content-Type', 'text/html')
  res.send(swaggerUiHtml(specUrl))
})

/**
 * GET /docs/redoc - ReDoc (alternative)
 */
router.get('/redoc', (req: Request, res: Response) => {
  const protocol = req.protocol
  const host = req.get('host')
  const specUrl = `${protocol}://${host}/api/docs/openapi.json`
  
  res.setHeader('Content-Type', 'text/html')
  res.send(redocHtml(specUrl))
})

/**
 * GET /docs/openapi.json - OpenAPI spec
 */
router.get('/openapi.json', (req: Request, res: Response) => {
  res.json(openApiSpec)
})

/**
 * GET /docs/openapi.yaml - OpenAPI spec in YAML
 */
router.get('/openapi.yaml', (req: Request, res: Response) => {
  // Simple JSON to YAML conversion
  const yaml = jsonToYaml(openApiSpec)
  res.setHeader('Content-Type', 'text/yaml')
  res.send(yaml)
})

/**
 * Simple JSON to YAML converter
 */
function jsonToYaml(obj: unknown, indent = 0): string {
  const spaces = '  '.repeat(indent)
  
  if (obj === null || obj === undefined) {
    return 'null'
  }
  
  if (typeof obj === 'boolean' || typeof obj === 'number') {
    return String(obj)
  }
  
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#')) {
      return `|\n${obj.split('\n').map(line => spaces + '  ' + line).join('\n')}`
    }
    return obj.includes(' ') || obj.includes("'") ? `"${obj}"` : obj
  }
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map(item => {
      const itemYaml = jsonToYaml(item, indent + 1)
      if (typeof item === 'object' && item !== null) {
        return `\n${spaces}- ${itemYaml.trim()}`
      }
      return `\n${spaces}- ${itemYaml}`
    }).join('')
  }
  
  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) return '{}'
    
    return entries.map(([key, value]) => {
      const valueYaml = jsonToYaml(value, indent + 1)
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        return `\n${spaces}${key}:${valueYaml}`
      }
      if (Array.isArray(value)) {
        return `\n${spaces}${key}:${valueYaml}`
      }
      return `\n${spaces}${key}: ${valueYaml}`
    }).join('')
  }
  
  return String(obj)
}

export default router
