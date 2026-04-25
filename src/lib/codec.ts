import {
  emptyGroove,
  resizeArrays,
  type Division,
  type Groove,
  type HatValue,
  type NoteValue,
  type Sticking,
} from './model'

/**
 * Binary wire format v3.
 *
 * Header (byte-aligned):
 *   0       u8  format version (= 3)
 *   1..2    u16 tempo (little-endian)
 *   3       u8  swing (0..100)
 *   4       u8  timeSig: (num<<4) | den  (num & den both 1..15)
 *   5       u8  measures (1..255)
 *   6       u8  bits 0..2 = divCode, bit 3 = hasT1, bit 4 = hasT4, bit 5 = hasCy
 *   7       u8  bits 0..2 = metronome/countIn/loop,
 *               bits 3..6 = hhEmpty/snEmpty/kkEmpty/stickingEmpty
 *               (an "empty" voice skips its cell bits entirely)
 *
 * Voice cells (bit-packed, MSB-first); each voice only present if NOT empty:
 *   hh: N × 3 bits
 *   sn: N × 2 bits
 *   kk: N × 2 bits
 *   t1: N × 2 bits   (only if hasT1)
 *   t4: N × 2 bits   (only if hasT4)
 *   cy: N × 2 bits   (only if hasCy)
 *   sticking: N × 2 bits
 *   (padded to byte boundary)
 *
 * Optional trailer (absent = empty title & author):
 *   u8 title_len, title_len bytes of UTF-8,
 *   u8 author_len, author_len bytes of UTF-8.
 *
 * The whole buffer is base64url-encoded for the URL.
 *
 * Sizes: 16-step empty groove → 8 bytes → 11 url chars.
 *        16-step typical (HH+SN+KK active, sticking empty) → ~22 bytes → ~30 url chars.
 */

const FORMAT_VERSION = 3
const DIV_CODES: Division[] = [4, 6, 8, 12, 16, 24, 32]
const STICK: Sticking[] = ['-', 'R', 'L', 'B']

class BitWriter {
  private bytes: number[] = []
  private cur = 0
  private cb = 0
  writeBits(val: number, n: number) {
    for (let i = n - 1; i >= 0; i--) {
      this.cur = (this.cur << 1) | ((val >> i) & 1)
      this.cb++
      if (this.cb === 8) {
        this.bytes.push(this.cur & 0xff)
        this.cur = 0
        this.cb = 0
      }
    }
  }
  align() {
    if (this.cb > 0) {
      this.cur <<= 8 - this.cb
      this.bytes.push(this.cur & 0xff)
      this.cur = 0
      this.cb = 0
    }
  }
  writeByte(b: number) {
    this.align()
    this.bytes.push(b & 0xff)
  }
  writeBytes(src: Uint8Array) {
    this.align()
    for (const b of src) this.bytes.push(b & 0xff)
  }
  toBytes(): Uint8Array {
    this.align()
    return new Uint8Array(this.bytes)
  }
}

class BitReader {
  private i = 0
  private bit = 0
  constructor(private bytes: Uint8Array) {}
  readBits(n: number): number {
    let v = 0
    for (let k = 0; k < n; k++) {
      if (this.i >= this.bytes.length) throw new Error('codec: eof')
      v = (v << 1) | ((this.bytes[this.i] >> (7 - this.bit)) & 1)
      this.bit++
      if (this.bit === 8) {
        this.i++
        this.bit = 0
      }
    }
    return v
  }
  align() {
    if (this.bit > 0) {
      this.i++
      this.bit = 0
    }
  }
  readByte(): number {
    this.align()
    if (this.i >= this.bytes.length) throw new Error('codec: eof')
    return this.bytes[this.i++]
  }
  readBytes(n: number): Uint8Array {
    this.align()
    if (this.i + n > this.bytes.length) throw new Error('codec: eof')
    const out = this.bytes.slice(this.i, this.i + n)
    this.i += n
    return out
  }
  remaining(): number {
    this.align()
    return this.bytes.length - this.i
  }
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const pad = s.length % 4 === 2 ? '==' : s.length % 4 === 3 ? '=' : ''
  const b = s.replace(/-/g, '+').replace(/_/g, '/') + pad
  const bin = atob(b)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function allZero(xs: ArrayLike<number>): boolean {
  for (let i = 0; i < xs.length; i++) if (xs[i] !== 0) return false
  return true
}
function allDash(xs: ArrayLike<Sticking>): boolean {
  for (let i = 0; i < xs.length; i++) if (xs[i] !== '-') return false
  return true
}

export function encode(g: Groove): string {
  const divCode = DIV_CODES.indexOf(g.division)
  if (divCode < 0) throw new Error(`codec: unsupported division ${g.division}`)
  const n = g.voices.hh.length
  const w = new BitWriter()

  const hhEmpty = allZero(g.voices.hh)
  const snEmpty = allZero(g.voices.sn)
  const kkEmpty = allZero(g.voices.kk)
  const stEmpty = allDash(g.sticking)
  const hasT1 = !!g.voices.t1 && !allZero(g.voices.t1!)
  const hasT4 = !!g.voices.t4 && !allZero(g.voices.t4!)
  const hasCy = !!g.voices.cy && !allZero(g.voices.cy!)

  w.writeByte(FORMAT_VERSION)
  w.writeByte(g.tempo & 0xff)
  w.writeByte((g.tempo >> 8) & 0xff)
  w.writeByte(g.swing & 0xff)
  w.writeByte(((g.timeSig[0] & 0x0f) << 4) | (g.timeSig[1] & 0x0f))
  w.writeByte(g.measures & 0xff)
  w.writeByte(
    (divCode & 0x07) | ((hasT1 ? 1 : 0) << 3) | ((hasT4 ? 1 : 0) << 4) | ((hasCy ? 1 : 0) << 5),
  )
  w.writeByte(
    (g.metronome ? 1 : 0) |
      ((g.countIn ? 1 : 0) << 1) |
      ((g.loop ? 1 : 0) << 2) |
      ((hhEmpty ? 1 : 0) << 3) |
      ((snEmpty ? 1 : 0) << 4) |
      ((kkEmpty ? 1 : 0) << 5) |
      ((stEmpty ? 1 : 0) << 6),
  )

  if (!hhEmpty) for (let i = 0; i < n; i++) w.writeBits(g.voices.hh[i] & 0x07, 3)
  if (!snEmpty) for (let i = 0; i < n; i++) w.writeBits(g.voices.sn[i] & 0x03, 2)
  if (!kkEmpty) for (let i = 0; i < n; i++) w.writeBits(g.voices.kk[i] & 0x03, 2)
  if (hasT1) for (let i = 0; i < n; i++) w.writeBits((g.voices.t1![i] ?? 0) & 0x03, 2)
  if (hasT4) for (let i = 0; i < n; i++) w.writeBits((g.voices.t4![i] ?? 0) & 0x03, 2)
  if (hasCy) for (let i = 0; i < n; i++) w.writeBits((g.voices.cy![i] ?? 0) & 0x03, 2)
  if (!stEmpty) {
    for (let i = 0; i < n; i++) {
      const idx = STICK.indexOf(g.sticking[i])
      w.writeBits((idx < 0 ? 0 : idx) & 0x03, 2)
    }
  }

  const title = (g.title || '').slice(0, 255)
  const author = (g.author || '').slice(0, 255)
  if (title || author) {
    const enc = new TextEncoder()
    const tb = enc.encode(title)
    const ab = enc.encode(author)
    w.writeByte(tb.length)
    w.writeBytes(tb)
    w.writeByte(ab.length)
    w.writeBytes(ab)
  }

  return toBase64Url(w.toBytes())
}

export function decode(payload: string): Groove | null {
  try {
    const bytes = fromBase64Url(payload)
    const r = new BitReader(bytes)
    const v = r.readByte()
    if (v !== FORMAT_VERSION) return null
    const tempo = r.readByte() | (r.readByte() << 8)
    const swing = r.readByte()
    const ts = r.readByte()
    const measures = r.readByte()
    const flags1 = r.readByte()
    const flags2 = r.readByte()

    const divCode = flags1 & 0x07
    const hasT1 = !!(flags1 & 0x08)
    const hasT4 = !!(flags1 & 0x10)
    const hasCy = !!(flags1 & 0x20)
    const metronome = !!(flags2 & 0x01)
    const countIn = !!(flags2 & 0x02)
    const loop = !!(flags2 & 0x04)
    const hhEmpty = !!(flags2 & 0x08)
    const snEmpty = !!(flags2 & 0x10)
    const kkEmpty = !!(flags2 & 0x20)
    const stEmpty = !!(flags2 & 0x40)

    const division = DIV_CODES[divCode]
    if (!division) return null
    const n = division * measures
    if (n <= 0 || n > 2048) return null

    const hh: HatValue[] = new Array(n).fill(0)
    const sn: NoteValue[] = new Array(n).fill(0)
    const kk: NoteValue[] = new Array(n).fill(0)
    if (!hhEmpty) for (let i = 0; i < n; i++) hh[i] = r.readBits(3) as HatValue
    if (!snEmpty) for (let i = 0; i < n; i++) sn[i] = r.readBits(2) as NoteValue
    if (!kkEmpty) for (let i = 0; i < n; i++) kk[i] = r.readBits(2) as NoteValue

    let t1: NoteValue[] | undefined
    let t4: NoteValue[] | undefined
    let cy: NoteValue[] | undefined
    if (hasT1) {
      t1 = new Array(n)
      for (let i = 0; i < n; i++) t1[i] = r.readBits(2) as NoteValue
    }
    if (hasT4) {
      t4 = new Array(n)
      for (let i = 0; i < n; i++) t4[i] = r.readBits(2) as NoteValue
    }
    if (hasCy) {
      cy = new Array(n)
      for (let i = 0; i < n; i++) cy[i] = r.readBits(2) as NoteValue
    }

    const sticking: Sticking[] = new Array(n).fill('-')
    if (!stEmpty) for (let i = 0; i < n; i++) sticking[i] = STICK[r.readBits(2)]

    let title = ''
    let author = ''
    if (r.remaining() > 0) {
      const tLen = r.readByte()
      const tb = r.readBytes(tLen)
      const aLen = r.readByte()
      const ab = r.readBytes(aLen)
      const dec = new TextDecoder()
      title = dec.decode(tb)
      author = dec.decode(ab)
    }

    return resizeArrays({
      v: 1,
      title,
      author,
      timeSig: [(ts >> 4) & 0x0f, ts & 0x0f],
      division,
      measures,
      tempo,
      swing,
      metronome,
      countIn,
      loop,
      voices: { hh, sn, kk, t1, t4, cy },
      sticking,
    })
  } catch {
    return null
  }
}

// Unused re-export guard so tsc doesn't strip the import
void emptyGroove
