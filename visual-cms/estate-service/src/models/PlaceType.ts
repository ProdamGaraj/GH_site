import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/**
 * Тип места на карте проекта: школа, детсад, больница…
 *
 * Общий для всех ЖК. Ключ неизменен — на него ссылаются места у ЖК
 * (`complexes.places[].type`). Иконка — ключ из набора services/mapIcons.ts,
 * цвет — `#rrggbb`. Тип, которым пользуются места, не удаляется, а прячется
 * флагом `hidden`: места остаются в данных, но с карты уходят.
 */
@Entity('place_types')
export class PlaceType {
  @PrimaryColumn({ type: 'varchar', length: 40 })
  key!: string

  @Column({ type: 'varchar', length: 80 })
  nameRu!: string

  @Column({ type: 'varchar', length: 80, default: '' })
  nameUz!: string

  @Column({ type: 'varchar', length: 80, default: '' })
  nameEn!: string

  @Column({ type: 'varchar', length: 40 })
  icon!: string

  @Column({ type: 'varchar', length: 7 })
  color!: string

  @Column({ type: 'int', default: 0 })
  order!: number

  @Column({ type: 'boolean', default: false })
  hidden!: boolean

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt!: Date

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt!: Date
}
