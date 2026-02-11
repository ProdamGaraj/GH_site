import { DataSource } from 'typeorm'
import { Page } from '../models/Page'
import { Block } from '../models/Block'
import { Group } from '../models/Group'
import { DataSource as DataSourceEntity } from '../models/DataSource'
import { DataBinding } from '../models/DataBinding'
import { Template } from '../models/Template'
import { DataSubmission } from '../models/DataSubmission'
import { PageVariable } from '../models/PageVariable'
import { Form } from '../models/Form'
import { FormDestination } from '../models/FormDestination'
import { FormSubmissionLog } from '../models/FormSubmissionLog'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Page, Block, Group, DataSourceEntity, DataBinding, Template, DataSubmission, PageVariable, Form, FormDestination, FormSubmissionLog],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
})
