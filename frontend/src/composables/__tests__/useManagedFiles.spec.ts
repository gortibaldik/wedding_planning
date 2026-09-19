import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { I18nFile, I18nInfoGridSection } from '../useManagedFiles'

const doc = (): Partial<I18nFile> => ({
  lang: 'en',
  sections: [
    { type: 'text', title: 'A', text: 'a' },
    { type: 'info-grid', title: 'B', rows: [{ label: 'l1', value: 'v1' }] }
  ]
})

vi.mock('../useAuth', () => ({
  useAuth: () => ({
    authFetch: vi.fn(async () => ({
      ok: true,
      json: async () => ({ langs: ['en'], default_lang: 'en', files: { en: doc() } })
    }))
  })
}))

const { useManagedFiles, newSection, newInfoGridRow } = await import('../useManagedFiles')

describe('useManagedFiles array editing', () => {
  let mf: ReturnType<typeof useManagedFiles>

  beforeEach(async () => {
    mf = useManagedFiles()
    await mf.loadAll()
  })

  it('appends a new section and marks the doc dirty', () => {
    mf.insertInArray(['sections'], 2, newSection('text'))
    expect(mf.currentDoc.value!.sections).toHaveLength(3)
    expect(mf.currentDoc.value!.sections[2]).toEqual({ type: 'text', title: '', text: '' })
    expect(mf.isDirty.value).toBe(true)
  })

  it('creates info-grid sections with one blank row', () => {
    expect(newSection('info-grid')).toEqual({
      type: 'info-grid',
      title: '',
      rows: [{ label: '', value: '' }]
    })
  })

  it('inserts and removes rows inside a nested section', () => {
    mf.insertInArray(['sections', 1, 'rows'], 1, newInfoGridRow())
    const rows = () => (mf.currentDoc.value!.sections[1] as I18nInfoGridSection).rows
    expect(rows()).toHaveLength(2)
    mf.removeFromArray(['sections', 1, 'rows'], 0)
    expect(rows()).toEqual([{ label: '', value: '' }])
  })

  it('removes a section and revert restores it', () => {
    mf.removeFromArray(['sections'], 0)
    expect(mf.currentDoc.value!.sections.map(s => s.title)).toEqual(['B'])
    mf.revert()
    expect(mf.currentDoc.value!.sections.map(s => s.title)).toEqual(['A', 'B'])
    expect(mf.isDirty.value).toBe(false)
  })

  it('ignores out-of-range indices and non-array paths', () => {
    mf.removeFromArray(['sections'], 5)
    mf.insertInArray(['lang'], 0, 'x')
    mf.insertInArray(['missing', 0], 0, 'x')
    expect(mf.isDirty.value).toBe(false)
  })
})
