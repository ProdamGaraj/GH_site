import AWS from 'aws-sdk'

/**
 * S3-совместимый клиент для MinIO.
 *
 * При инициализации:
 *   1) проверяет наличие bucket, создаёт если нет;
 *   2) выставляет публичную read-only политику (anonymous GET),
 *      чтобы файлы можно было раздавать через nginx /media/* proxy.
 */
export class MinioStorageService {
  private s3: AWS.S3
  private bucket: string
  private initialized = false

  constructor() {
    this.bucket = process.env.S3_BUCKET || 'cms-media'
    this.s3 = new AWS.S3({
      endpoint: process.env.S3_ENDPOINT || 'http://minio:9000',
      accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
      secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      s3ForcePathStyle: true,
      signatureVersion: 'v4',
      region: process.env.S3_REGION || 'us-east-1',
    })
  }

  async ensureBucket(): Promise<void> {
    if (this.initialized) return
    try {
      await this.s3.headBucket({ Bucket: this.bucket }).promise()
    } catch (err: any) {
      if (err.statusCode === 404 || err.code === 'NotFound' || err.code === 'NoSuchBucket') {
        await this.s3.createBucket({ Bucket: this.bucket }).promise()
        // eslint-disable-next-line no-console
        console.log(`📦 Created MinIO bucket: ${this.bucket}`)
      } else if (err.statusCode !== 403) {
        // 403 means bucket exists but we can't head — proceed (PutObject works with creds)
        throw err
      }
    }

    // Public read-only policy: anonymous GetObject for all keys.
    const policy = {
      Version: '2012-10-17',
      Statement: [
        {
          Sid: 'PublicRead',
          Effect: 'Allow',
          Principal: { AWS: ['*'] },
          Action: ['s3:GetObject'],
          Resource: [`arn:aws:s3:::${this.bucket}/*`],
        },
      ],
    }

    try {
      await this.s3
        .putBucketPolicy({ Bucket: this.bucket, Policy: JSON.stringify(policy) })
        .promise()
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.warn(`⚠️  Failed to set bucket policy on ${this.bucket}:`, err.message)
    }

    this.initialized = true
  }

  async putObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.ensureBucket()
    await this.s3
      .putObject({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: 'public, max-age=2592000, immutable',
      })
      .promise()
  }

  async deleteObject(key: string): Promise<void> {
    await this.ensureBucket()
    await this.s3.deleteObject({ Bucket: this.bucket, Key: key }).promise()
  }

  async getObject(key: string): Promise<Buffer> {
    await this.ensureBucket()
    const resp = await this.s3.getObject({ Bucket: this.bucket, Key: key }).promise()
    if (!resp.Body) throw new Error(`Empty body for ${key}`)
    return resp.Body as Buffer
  }

  /**
   * Публичный URL ассета. Используется nginx proxy на /media/<key>.
   * Если PUBLIC_MEDIA_URL не задан — возвращает абсолютный путь /media/<key>.
   */
  publicUrl(key: string): string {
    const base = (process.env.PUBLIC_MEDIA_URL || '/media').replace(/\/+$/, '')
    return `${base}/${key}`
  }
}

export const minioStorageService = new MinioStorageService()
