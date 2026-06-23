import React, { useState } from 'react'
import type { BlockNode } from '@/shared/types'

const ctrlBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,0.55)',
  background: 'rgba(0,0,0,0.45)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

const badge: React.CSSProperties = {
  background: 'rgba(0,0,0,0.45)',
  color: '#fff',
  borderRadius: 12,
  padding: '3px 10px',
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  userSelect: 'none',
}

/**
 * Редакторский превью static-карусели.
 *
 * Рантайм карусели (CarouselRuntime) работает только на деплое, поэтому в холсте
 * слайды иначе стопкой накладывались бы друг на друга. Здесь повторяем deploy-раскладку
 * (горизонтальный трек, один слайд виден) и добавляем редакторские стрелки + счётчик,
 * чтобы листать слайды без JS. Контролы — только в редакторе, в сохранённую структуру
 * не попадают (это обычные React-кнопки поверх трека).
 */
export const StaticCarouselTrack: React.FC<{
  slides: BlockNode[]
  renderSlide: (slide: BlockNode) => React.ReactNode
}> = ({ slides, renderSlide }) => {
  const [index, setIndex] = useState(0)
  const total = slides.length
  const n = Math.max(total, 1)
  const active = total > 0 ? Math.min(index, total - 1) : 0
  const pad = (x: number) => (x < 10 ? '0' : '') + x

  return (
    <>
      <div
        style={{
          display: 'flex',
          width: `${n * 100}%`,
          height: '100%',
          transform: `translateX(-${active * (100 / n)}%)`,
          transition: 'transform 0.3s ease',
        }}
      >
        {slides.map((s) => (
          <div key={s.id} style={{ flex: `0 0 ${100 / n}%`, width: `${100 / n}%` }}>
            {renderSlide(s)}
          </div>
        ))}
      </div>

      {total > 1 && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            right: 12,
            bottom: 12,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <button
            type="button"
            style={ctrlBtn}
            title="Предыдущий слайд (превью редактора)"
            onClick={() => setIndex(() => (active - 1 + total) % total)}
          >
            ‹
          </button>
          <span style={badge}>
            {pad(active + 1)} / {pad(total)}
          </span>
          <button
            type="button"
            style={ctrlBtn}
            title="Следующий слайд (превью редактора)"
            onClick={() => setIndex(() => (active + 1) % total)}
          >
            ›
          </button>
        </div>
      )}
    </>
  )
}
