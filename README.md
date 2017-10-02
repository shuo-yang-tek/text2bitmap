`text2bitmap.registerFont(filename, fontName)`
---

* `filename`: path to the font file

* `fontName`: font name

* return `Promise`

`text2bitmap.draw(opts)`
---

* `opts.alignHorizonal`: align horizonal

* `opts.alignVertical`: align vertical

* `opts.backgroundRGBA`: background color in 32-bit integer

* `opts.ellipsis`: a short text displayed when `opts.width` is set, and overflow

* `opts.fontColor`: font color in `#rrggbb` format

* `opts.fontFamily`: array of `fontName`

* `opts.fontSize`: font size

* `opts.height`: height

* `opts.text`: text to display

* `opts.width`: width

* return `Promise({width, height, data})`
