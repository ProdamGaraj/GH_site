/**
 * Сервис управления языками
 */
import { AppDataSource } from '../config/database'
import { Language } from '../models/Language'

export class LanguageService {
  private repository = AppDataSource.getRepository(Language)

  async getAll(): Promise<Language[]> {
    return this.repository.find({
      order: { order: 'ASC', name: 'ASC' },
    })
  }

  async getActive(): Promise<Language[]> {
    return this.repository.find({
      where: { isActive: true },
      order: { order: 'ASC' },
    })
  }

  async getDefault(): Promise<Language | null> {
    return this.repository.findOne({ where: { isDefault: true } })
  }

  async getByCode(code: string): Promise<Language | null> {
    return this.repository.findOne({ where: { code } })
  }

  async getById(id: string): Promise<Language | null> {
    return this.repository.findOne({ where: { id } })
  }

  async create(data: Partial<Language>): Promise<Language> {
    // If this is set as default, unset any existing default
    if (data.isDefault) {
      await this.repository.update({}, { isDefault: false })
    }

    // If no languages exist yet, make this one the default
    const count = await this.repository.count()
    if (count === 0) {
      data.isDefault = true
    }

    // Set order to next available
    if (data.order === undefined) {
      const maxOrder = await this.repository
        .createQueryBuilder('lang')
        .select('MAX(lang.order)', 'max')
        .getRawOne()
      data.order = (maxOrder?.max ?? -1) + 1
    }

    const language = this.repository.create(data)
    return this.repository.save(language)
  }

  async update(id: string, data: Partial<Language>): Promise<Language | null> {
    const language = await this.repository.findOne({ where: { id } })
    if (!language) return null

    // If setting as default, unset any existing default
    if (data.isDefault && !language.isDefault) {
      await this.repository.update({}, { isDefault: false })
    }

    // Don't allow unsetting the only default
    if (data.isDefault === false && language.isDefault) {
      const otherDefaults = await this.repository.count({ where: { isDefault: true } })
      if (otherDefaults <= 1) {
        // Keep it as default, ignore the change
        delete data.isDefault
      }
    }

    Object.assign(language, data)
    return this.repository.save(language)
  }

  async delete(id: string): Promise<boolean> {
    const language = await this.repository.findOne({ where: { id } })
    if (!language) return false

    // Don't allow deleting the default language
    if (language.isDefault) {
      throw new Error('Cannot delete the default language. Set another language as default first.')
    }

    const result = await this.repository.delete(id)
    return (result.affected ?? 0) > 0
  }

  async reorder(orderedIds: string[]): Promise<Language[]> {
    for (let i = 0; i < orderedIds.length; i++) {
      await this.repository.update(orderedIds[i], { order: i })
    }
    return this.getAll()
  }

  /**
   * Seed default languages (Russian and English) if none exist
   */
  async seedDefaults(): Promise<void> {
    const count = await this.repository.count()
    if (count > 0) return

    const defaults: Partial<Language>[] = [
      { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', isDefault: true, isActive: true, order: 0, direction: 'ltr' },
      { code: 'en', name: 'English', nativeName: 'English', flag: '🇬🇧', isDefault: false, isActive: true, order: 1, direction: 'ltr' },
    ]

    for (const lang of defaults) {
      const entity = this.repository.create(lang)
      await this.repository.save(entity)
    }
  }
}

export const languageService = new LanguageService()
