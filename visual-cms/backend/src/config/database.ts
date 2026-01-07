import { DataSource } from 'typeorm'
import { Page } from '../models/Page'
import { Block } from '../models/Block'
import { Group } from '../models/Group'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  entities: [Page, Block, Group],
  migrations: ['src/migrations/**/*.ts'],
  subscribers: [],
})
