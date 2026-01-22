import { Router } from 'express'
import DataBindingController from '../controllers/DataBindingController'

const router = Router()

/**
 * Data Fetch Routes
 *
 * �������� �: docs/data-binding-system-spec.md
 * ��� 2.1 Backend: Data Fetching Service
 *
 * Endpoints:
 * - POST /api/data/fetch              - �������� ������ �� ���������
 * - POST /api/data/fetch-with-binding - �������� ������ � ����������� binding
 * - POST /api/data/submit-with-binding - ��������� ������ ����� OUTPUT binding
 */

// ������� ������ �� Data Source � �����������/�����������
router.post('/fetch', (req, res) => DataBindingController.fetchData(req, res))

// ������� ������ ��������� ������������ binding
router.post('/fetch-with-binding', (req, res) => DataBindingController.fetchWithBinding(req, res))

// �������� ������ ����� OUTPUT binding
router.post('/submit-with-binding', (req, res) => DataBindingController.submitWithBinding(req, res))

export default router
