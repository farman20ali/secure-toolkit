import { describe, expect, it } from 'vitest'
import {
  createContrastBoostedCanvas,
  createInvertedCanvas,
  createRotatedCanvas,
} from './barcode-scanner-engine'

describe('barcode-scanner-engine canvas utilities', () => {
  it('creates contrast boosted canvas with correct dimensions', () => {
    const src = document.createElement('canvas')
    src.width = 200
    src.height = 100
    const boosted = createContrastBoostedCanvas(src)
    expect(boosted.width).toBe(200)
    expect(boosted.height).toBe(100)
  })

  it('creates inverted canvas with correct dimensions', () => {
    const src = document.createElement('canvas')
    src.width = 300
    src.height = 150
    const inverted = createInvertedCanvas(src)
    expect(inverted.width).toBe(300)
    expect(inverted.height).toBe(150)
  })

  it('creates rotated canvas swapping width and height for 90 degrees', () => {
    const src = document.createElement('canvas')
    src.width = 400
    src.height = 200
    const rotated = createRotatedCanvas(src, 90)
    expect(rotated.width).toBe(200)
    expect(rotated.height).toBe(400)
  })
})
