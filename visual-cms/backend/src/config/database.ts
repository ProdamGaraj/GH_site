import { DataSource } from 'typeorm'
import { Site } from '../models/Site'
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
import { AnalyticsEvent } from '../models/AnalyticsEvent'
import { AnalyticsSession } from '../models/AnalyticsSession'
import { Language } from '../models/Language'
import { Translation } from '../models/Translation'
import { PageVersion } from '../models/PageVersion'
import { DeployLog } from '../models/DeployLog'
import { Collection } from '../models/Collection'
import { CollectionOverride } from '../models/CollectionOverride'
import { MediaAsset } from '../models/MediaAsset'

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
  entities: [Site, Page, Block, Group, DataSourceEntity, DataBinding, Template, DataSubmission, PageVariable, Form, FormDestination, FormSubmissionLog, AnalyticsEvent, AnalyticsSession, Language, Translation, PageVersion, DeployLog, Collection, CollectionOverride, MediaAsset],
  migrations: [],
  subscribers: [],
})
