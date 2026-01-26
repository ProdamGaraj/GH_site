/**
 * Роуты для mock данных
 */

import { Router } from 'express'
import { mockDataController } from '../controllers/MockDataController'

const router = Router()

/**
 * GET /api/mock/projects
 * Получить список всех проектов
 */
router.get('/projects', (req, res) => mockDataController.getProjects(req, res))

/**
 * GET /api/mock/projects/:id
 * Получить один проект по ID
 */
router.get('/projects/:id', (req, res) => mockDataController.getProjectById(req, res))

/**
 * GET /api/mock/news
 * Получить список новостей
 */
router.get('/news', (req, res) => mockDataController.getNews(req, res))

/**
 * GET /api/mock/team
 * Получить список команды
 */
router.get('/team', (req, res) => mockDataController.getTeam(req, res))

export default router
