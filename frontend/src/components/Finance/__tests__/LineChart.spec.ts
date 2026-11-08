import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import type { SeriesPoint } from '@/composables/useFinance'
import LineChart from '../LineChart.vue'

// Must match TICK_CHAR_WIDTH in LineChart.vue: the widest an 11px axis
// character is assumed to be, in viewBox units.
const CHAR_WIDTH = 7

// Fixed locale, so the test doesn't depend on the machine running it.
const formatMoney = (value: number) =>
  value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Plain `tsc` sees .vue files only through a default-export shim, so the
// series shape is spelled out here rather than importing `ChartSeries`.
const series = (...values: number[]): { name: string; color: string; points: SeriesPoint[] }[] => [
  {
    name: '',
    color: '#000',
    points: values.map((value, i) => ({ label: `2026-0${i + 1}`, value }))
  }
]

const yLabels = (values: number[]) => {
  const wrapper = mount(LineChart, {
    props: { series: series(...values), formatValue: formatMoney }
  })
  return wrapper.findAll('.line-chart__grid text').map(t => ({
    text: t.text(),
    x: Number(t.attributes('x'))
  }))
}

describe('LineChart y-axis', () => {
  it.each([[[1_200, 8_000]], [[40_000, 99_999]], [[60_000, 123_456]], [[250_000, 1_234_567]]])(
    'fits every label inside the SVG for %j',
    values => {
      const labels = yLabels(values)
      expect(labels).toHaveLength(5)
      for (const { text, x } of labels) {
        // Labels are right-aligned at `x`, so their left edge is x - width.
        expect(x - text.length * CHAR_WIDTH).toBeGreaterThanOrEqual(0)
      }
    }
  )

  it('keeps the default margin for short labels', () => {
    const labels = yLabels([10, 50])
    expect(new Set(labels.map(l => l.x))).toEqual(new Set([48]))
  })
})

describe('LineChart tooltip', () => {
  const twoLines = (a: number[], b: number[]) => [
    { ...series(...a)[0], name: 'Alpha', color: '#f00' },
    { ...series(...b)[0], name: 'Beta', color: '#00f' }
  ]

  const mountChart = (lines: ReturnType<typeof twoLines>) => {
    const wrapper = mount(LineChart, { props: { series: lines, formatValue: formatMoney } })
    // happy-dom does no layout: render the chart at its native 640x260 size.
    wrapper.element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 260 }) as DOMRect
    return wrapper
  }

  /** Data-point positions of each line, read from the rendered SVG. */
  const points = (wrapper: ReturnType<typeof mountChart>) =>
    wrapper.findAll('.line-chart__points').map(g =>
      g.findAll('circle').map(c => ({
        cx: Number(c.attributes('cx')),
        cy: Number(c.attributes('cy'))
      }))
    )

  const hoverAt = async (wrapper: ReturnType<typeof mountChart>, x: number, y: number) =>
    wrapper.trigger('mousemove', { clientX: x, clientY: y })

  const activeRow = (wrapper: ReturnType<typeof mountChart>) =>
    wrapper
      .findAll('.line-chart__tooltip-row--active')
      .map(r => r.find('.line-chart__tooltip-name').text())

  it('highlights the row of the line closest to the cursor', async () => {
    const wrapper = mountChart(twoLines([1000, 1000, 1000], [100, 100, 100]))
    const [alpha, beta] = points(wrapper)

    await hoverAt(wrapper, alpha[1].cx, alpha[1].cy + 3)
    expect(activeRow(wrapper)).toEqual(['Alpha'])

    await hoverAt(wrapper, beta[1].cx, beta[1].cy - 3)
    expect(activeRow(wrapper)).toEqual(['Beta'])
  })

  it('follows the line under the cursor between data points', async () => {
    // At the nearest month Beta (500) is closer to a cursor at value 420, but
    // 40% of the way to the next month Alpha has already climbed to 400.
    const wrapper = mountChart(twoLines([0, 1000, 1000], [500, 500, 500]))
    const [[a0, a1]] = points(wrapper)

    await hoverAt(wrapper, a0.cx + 0.4 * (a1.cx - a0.cx), a0.cy + 0.42 * (a1.cy - a0.cy))
    expect(activeRow(wrapper)).toEqual(['Alpha'])
  })

  it('highlights nothing for a single line', async () => {
    const wrapper = mount(LineChart, {
      props: { series: series(100, 200), formatValue: formatMoney }
    })
    wrapper.element.getBoundingClientRect = () =>
      ({ left: 0, top: 0, width: 640, height: 260 }) as DOMRect
    await wrapper.trigger('mousemove', { clientX: 320, clientY: 100 })
    expect(wrapper.find('.line-chart__tooltip').exists()).toBe(true)
    expect(wrapper.findAll('.line-chart__tooltip-row--active')).toHaveLength(0)
  })

  it('clears the highlight when the cursor leaves', async () => {
    const wrapper = mountChart(twoLines([1000, 1000], [100, 100]))
    await hoverAt(wrapper, 320, 20)
    expect(activeRow(wrapper)).toEqual(['Alpha'])
    await wrapper.trigger('mouseleave')
    expect(wrapper.find('.line-chart__tooltip').exists()).toBe(false)
  })
})
