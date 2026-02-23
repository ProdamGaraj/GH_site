/**
 * Контроллер для тестирования Template блоков
 * Позволяет проверить, как Template рендерится с тестовыми данными
 */

import { Request, Response } from 'express'
import { asyncHandler, NotFoundError, ValidationError } from '../middleware'
import { AppDataSource } from '../config/database'
import { Block } from '../models/Block'
import { htmlGenerator } from '../services/HtmlGenerator'

const blockRepository = AppDataSource.getRepository(Block)

interface FieldMapping {
  id: string
  targetProperty: string
  sourceField: string
}

export class TemplateTestController {
  /**
   * POST /api/template-test/render
   * Рендерит Template блок с тестовыми данными
   * 
   * Body:
   * {
   *   templateBlockId: string,
   *   testData: any[],
   *   fieldMappings: FieldMapping[]
   * }
   */
  renderTemplate = asyncHandler(async (req: Request, res: Response) => {
      const { templateBlockId, testData, fieldMappings } = req.body

      // Загружаем Template блок
      const templateBlock = await blockRepository.findOne({
        where: { id: templateBlockId }
      })

      if (!templateBlock) {
        throw new NotFoundError('Block', templateBlockId)
      }

      if (!templateBlock.isTemplate) {
        throw new ValidationError('The specified block is not marked as a template')
      }

      // Генерируем HTML для каждого элемента данных
      const renderedItems = (testData as Record<string, unknown>[]).map((item: Record<string, unknown>, index: number) => {
        // Клонируем структуру Template
        const itemStructure = JSON.parse(JSON.stringify(templateBlock.structure))
        
        // Применяем field mappings
        if (fieldMappings && Array.isArray(fieldMappings)) {
          this.applyFieldMappings(itemStructure, item, fieldMappings)
        }

        // Генерируем HTML для этого экземпляра
        return htmlGenerator['renderNode'](itemStructure, '  ')
      })

      // Создаём полный HTML документ для предпросмотра
      const fullHtml = `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Template Test - ${templateBlock.name}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 20px;
      background: #f5f5f5;
    }
    .test-container {
      max-width: 1200px;
      margin: 0 auto;
    }
    .test-header {
      background: white;
      padding: 20px;
      margin-bottom: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-items {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .test-item {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .test-item-label {
      font-size: 12px;
      color: #666;
      margin-bottom: 10px;
      font-weight: 500;
    }
  </style>
</head>
<body>
  <div class="test-container">
    <div class="test-header">
      <h1>Template Test: ${templateBlock.name}</h1>
      <p>Rendering ${testData.length} items</p>
      <p style="font-size: 14px; color: #666;">Template ID: ${templateBlockId}</p>
    </div>
    <div class="test-items">
      ${renderedItems.map((html: string, index: number) => `
        <div class="test-item">
          <div class="test-item-label">Item #${index + 1}</div>
          ${html}
        </div>
      `).join('\n')}
    </div>
  </div>
</body>
</html>`

      res.json({
        success: true,
        templateBlock: {
          id: templateBlock.id,
          name: templateBlock.name,
          detectedFields: templateBlock.detectedFields
        },
        itemsRendered: testData.length,
        html: fullHtml,
        items: renderedItems
      })
  })

  /**
   * POST /api/template-test/preview
   */
  generatePreview = this.renderTemplate

  /**
   * Применяет field mappings к структуре блока
   */
  private applyFieldMappings(structure: any, data: any, mappings: FieldMapping[]): void {
    if (!structure) return

    // Проходим по всем маппингам
    for (const mapping of mappings) {
      // Получаем значение из данных
      const value = this.getNestedValue(data, mapping.sourceField)
      
      if (value !== undefined) {
        // Применяем значение к целевому свойству
        this.setTargetProperty(structure, mapping.targetProperty, value)
      }
    }

    // Рекурсивно применяем к дочерним элементам
    if (structure.children && Array.isArray(structure.children)) {
      structure.children.forEach((child: any) => {
        this.applyFieldMappings(child, data, mappings)
      })
    }
  }

  /**
   * Получает значение из вложенного объекта по пути (например, "user.profile.name")
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  /**
   * Устанавливает значение целевого свойства (например, "content", "attributes.src")
   */
  private setTargetProperty(structure: any, targetProperty: string, value: any): void {
    const parts = targetProperty.split('.')
    
    if (parts[0] === 'content') {
      structure.content = value
    } else if (parts[0] === 'attributes' && parts[1]) {
      if (!structure.attributes) structure.attributes = {}
      structure.attributes[parts[1]] = value
    } else if (parts[0] === 'styles' && parts[1] === 'properties' && parts[2]) {
      if (!structure.styles) structure.styles = { properties: {} }
      if (!structure.styles.properties) structure.styles.properties = {}
      structure.styles.properties[parts[2]] = value
    }
  }
}

export const templateTestController = new TemplateTestController()
