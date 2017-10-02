const fontkit = require('fontkit')
const Bitmap = require('./lib/pureimage-slim/bitmap')
const sharp = require('sharp')

const FONTS = {}

function registerFont(filename, fontName) {
	return new Promise((resolve, reject) => {
		fontkit.open(filename, (err, font) => {
			if( err )
				return reject(err)

			FONTS[fontName] = font
			resolve()
		})
	})
}

function getGlyphs(text, fontFamily, fontSize) {
	const result = []

	for(let i = 0; i < text.length; i++) {
		const charCode = text.codePointAt(i)

		for(let j = 0; j < fontFamily.length; j++) {
			const targetFont = FONTS[fontFamily[j]]
			const fonts = targetFont.fonts || [targetFont]

			for(let k = 0; k < fonts.length; k++) {
				const font = fonts[k]

				if( font.hasGlyphForCodePoint(charCode) ) {
					const glyph = font.glyphForCodePoint(charCode)
					const isBmp = typeof glyph.getImageForSize === 'function'
					const boundleY = isBmp ?
						{
							minY: 0,
							maxY: fontSize,
						} : {
							minY: glyph.bbox.minY / font.unitsPerEm * fontSize,
							maxY: glyph.bbox.maxY / font.unitsPerEm * fontSize,
						}
					result.push({
						glyph,
						isBmp,
						unitsPerEm: font.unitsPerEm,
						minY: isBmp ? 0 : boundleY.minY,
						maxY: isBmp ? fontSize : boundleY.maxY,
						width: isBmp ?
							fontSize :
							glyph.advanceWidth / font.unitsPerEm * fontSize
					})

					k = fonts.length
					j = fontFamily.length
				}
			}
		}

		const charCode2 = text.charCodeAt(i)
		if( charCode2 >= 0xd800 && charCode2 <= 0xdbff )
			i += 1
	}

	return result
}

function drawGlyph(ctx, bitmap, glyph, fontSize, x, y) {
	if( glyph.isBmp ) {
		x = Math.round(x)
		y = Math.round(y)
		return sharp(glyph.glyph.getImageForSize(fontSize).data)
			.resize(fontSize)
			.raw()
			.toBuffer()
			.then(buf => {
				const startIdx = (bitmap.width * y + x) * 4

				for(let i = 0; i < buf.length; i += 4) {
					const currIdx = startIdx + (i % (fontSize * 4)) + Math.floor(i / fontSize / 4) * bitmap.width * 4
					const ratio = buf[buf.length - i - 1] / 0xff

					for(let j = 0; j < 4; j++) {
						bitmap.data[currIdx + j] = Math.floor(bitmap.data[currIdx + j] * (1 - ratio) + buf[buf.length - i - 4 + j] * ratio)
					}
				}

				return Promise.resolve()
			})
	} else {
		ctx.beginPath()
		ctx.save()
		ctx.translate(x, y)
		glyph.glyph.render(ctx, fontSize)
		ctx.closePath()
		ctx.restore()
		return Promise.resolve()
	}
}

function draw(opts) {
	const originGlyphs = getGlyphs(opts.text, opts.fontFamily, opts.fontSize)
	const originWidth = originGlyphs.reduce((sum, glyph) => sum + glyph.width, 0)

	let renderGlyphs = originGlyphs.slice()
	let renderWidth = originWidth

	if( opts.ellipsis && opts.width && originWidth > opts.width ) {
		const ellipsisGlyphs = getGlyphs(opts.ellipsis, opts.fontFamily, opts.fontSize)
		const ellipsisWidth = ellipsisGlyphs.reduce((sum, glyph) => sum + glyph.width, 0)

		do {
			const dropedGlyph = renderGlyphs.pop()
			renderWidth -= dropedGlyph.width
		} while( renderWidth + ellipsisWidth > opts.width && renderGlyphs.length )

		renderGlyphs = renderGlyphs.concat(ellipsisGlyphs)
		renderWidth += ellipsisWidth
	}

	let boundleY = {
		minY: renderGlyphs[0].minY,
		maxY: renderGlyphs[0].maxY
	}

	for(let i = 1; i < renderGlyphs.length; i++) {
		const glyph = renderGlyphs[i]

		boundleY = {
			minY: Math.min(boundleY.minY, glyph.minY),
			maxY: Math.max(boundleY.maxY, glyph.maxY),
		}
	}

	const renderHeight = boundleY.maxY - boundleY.minY

	const originPoint = {
		x: 0,
		y: -boundleY.minY,
	}

	if( opts.width ) {
		switch( opts.alignHorizonal ) {
		case 'center':
			originPoint.x += (opts.width - renderWidth) / 2
			break
		case 'right':
			originPoint.x += opts.width - renderWidth
			break
		}
	}

	if( opts.height ) {

		switch( opts.alignVertical ) {
		case 'center':
			originPoint.y += (opts.height - renderHeight) / 2
			break
		case 'top':
			originPoint.y += opts.height - renderHeight
			break
		}
	}

	const bitmap = new Bitmap(
		Math.ceil(opts.width || renderWidth),
		Math.ceil(opts.height || renderHeight),
		{ backgroundRGBA: opts.backgroundRGBA }
	)

	const ctx = bitmap.getContext('2d')
	ctx.fillStyle = opts.fontColor

	let currX = originPoint.x
	let p = drawGlyph(ctx, bitmap, renderGlyphs[0], opts.fontSize, currX, originPoint.y)
	const argsList = []

	for(let i = 1; i < renderGlyphs.length; i++) {
		currX += renderGlyphs[i - 1].width
		argsList.push([ctx, bitmap, renderGlyphs[i], opts.fontSize, currX, originPoint.y])
	}

	for(let i = 0; i < argsList.length; i++) {
		p = p.then(() => drawGlyph.apply(null, argsList[i]))
	}

	return p
		.then(() => sharp(bitmap.data, {
			raw: {
				width: bitmap.width,
				height: bitmap.height,
				channels: 4,
			}
		})
			.flip()
			.toBuffer()
		)
		.then(buf => ({
			width: bitmap.width,
			height: bitmap.height,
			data: buf
		}))
}

module.exports = {
	registerFont,
	draw,
}
