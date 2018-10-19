
import namespace from './namespace.js'
import settings from './settings.js'
import { Color } from './color.js'
import { readonly, getter, getterSetter } from './utils.js'

let { width, height } = settings

let mouse = { x:0, y:0 }

let instancesCount = 0
let instances = new Set()

let canvas, ctx

let init = () => {

    canvas = document.querySelector('canvas.pixel-bot')

    canvas.addEventListener('mousemove', event => {

        let { x, y } = event
        let r = canvas.getBoundingClientRect()

        x += -r.x
        y += -r.y

        x *= width / r.width
        y *= height / r.height

        mouse.x = Math.floor(x)
        mouse.y = Math.floor(y)

    })

    ctx = canvas.getContext('2d')

    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, width, height)

}

let running = true
let sampling = 1
let frame = 0

let update = () => {

    let sample = 0

    while (sample++ < sampling) {

        for (let instance of instances) {

            let { updateRate = 1 } = instance

            while (updateRate-- > 0) {

                let { x, y } = instance

                let [r, g, b] = ctx.getImageData(x, y, 1, 1).data

                instance.pixelColor.r = r / 0xff
                instance.pixelColor.g = g / 0xff
                instance.pixelColor.b = b / 0xff

                instance.update()

                instance.updateCount++

            }

        }

        frame++

    }

}

let loop = () => {

    try {

        if (running) {

            update()

        }

        requestAnimationFrame(loop)

    } catch (e) {

        console.log('oups')

        throw e

    }

}

setTimeout(() => {

    init()
    loop()

}, 0)

let orientations = 'NESW'



let define = (name, definition) => {

    let { constructor, ...prototype } = definition

    if (constructor !== Object.prototype.constructor) {

        console.warn(`PixelBot.define() Error, constructor must NOT be defined, use "start" instead`)

    }

    constructor = (new Function('initInstance', `return function ${name} (){ initInstance(this, arguments) }`))(initInstance)

    Object.setPrototypeOf(constructor.prototype, PixelBot.prototype)

    Object.assign(constructor.prototype, prototype)

    register(constructor)

    return constructor

}

let register = (constructor) => {

    let { name } = constructor

    console.log(`register "${name}"`)

    Object.defineProperties(constructor, {

        instances: {
            value: new Set(),
        },

        instancesCount: {
            value: 0,
            writable: true,
        },

    })

    namespace.add(name, constructor)

}

let initInstance = (instance, args) => {

    instance.pixelColor = new Color()
    instance.x = 0
    instance.y = 0
    instance.orientation = 'E'
    instance.updateCount = 0

    if (!instance.constructor.hasOwnProperty('instances')) {

        register(instance.constructor)

    }

    instance.uid = instancesCount++
    instance.instanceId = instance.constructor.instancesCount++
    instance.constructor.instances.add(instance)
    instance.identifier = instance.constructor.name + '#' + instance.instanceId

    instances.add(instance)

    if (instance.start)
        instance.start(...args)

}

let exportCode = () => {

    let definitions = []

    for (let name of Object.keys(namespace.dict)) {

        let Definition = namespace.get(name)

        let methods = Object.getOwnPropertyNames(Definition.prototype)
            .filter(v => v !== 'constructor')
            .map(v => '\t' + Definition.prototype[v].toString())
            .join('\n\n')

        let str = `class ${name} extends PixelBot {\n\n${methods}\n\n}`

        definitions.push(str)

    }

    let mapValue = (value) => {

    	if (typeof value === 'string')
    		return `'${value}'`

	    return value.toString()

    }

    let instances = Object.keys(namespace.dict).map((k) => {

    	let A = namespace.dict[k]

    	return `// ${k}\n\n` + [...A.instances.values()].map(bot => {

    		let str = Object.entries(bot)
    			.filter(([k]) => !/pixelColor|updateCount|identifier|instanceId/.test(k))
    			.map(([k, v]) => `\t${k}: ${mapValue(v)},`)
    			.join('\n')

    		return `new ${k}().set({\n${str}\n})`

        }).join('\n\n')

    })

    return definitions.join('\n\n') + instances.join('\n\n')

}


export default class PixelBot {

    static new(name, ...args) {

        let constructor = namespace.get(name)

        if (constructor) {

            return new constructor(...args)

        } else {

            console.warn(`PixelBot.new() Error, can not find definition for ${name}`)

        }

    }

    static clear(fillColor = null) {

        for (let bot of instances) {

            bot.destroy()

        }

        if (fillColor !== null) {

            ctx.fillStyle = fillColor
            ctx.fillRect(0, 0, width, height)

        }

    }

    static async load(url) {

        let response = await fetch(url)

        let code = await response.text()

        eval(code)

    }

    constructor() {

        initInstance(this, arguments)

    }

    destroy() {

        this.constructor.instances.delete(this)
        instances.delete(this)

    }

    set(props) {

        Object.assign(this, props)

        return this

    }

    turnRight() {

        let index = orientations.indexOf(this.orientation)

        index++

        if (index > orientations.length - 1) {

            index = 0

        }

        this.orientation = orientations[index]

        return this

    }

    turnLeft() {

        let index = orientations.indexOf(this.orientation)

        index--

        if (index < 0) {

            index = orientations.length - 1

        }

        this.orientation = orientations[index]

        return this

    }

    turn(toRight) {

        if (toRight) {

            this.turnRight()

        } else {

            this.turnLeft()

        }

        return this

    }

    lookAt({ x, y }) {

        let dx = x - this.x
        let dy = y - this.y

        let a = Math.atan2(-dy, -dx) / 2 / Math.PI

        a *= 4

        a = Math.round(a)

        a += -1 + 4

        a %= 4

        this.orientation = orientations[a]

        return this

    }

    move(distance = 1) {

        let { x, y, orientation } = this

        if (orientation === 'N') {

            y += -distance

        } else if (orientation === 'E') {

            x += distance

        } else if (orientation === 'S') {

            y += distance

        } else if (orientation === 'W') {

            x += -distance

        }

        if (x >= width)
            x += -width

        if (x < 0)
            x += width

        if (y >= height)
            y += -height

        if (y < 0)
            y += height

        Object.assign(this, { x, y })

        return this

    }

    setPixelColor(color) {

        ctx.fillStyle = color
        ctx.fillRect(this.x, this.y, 1, 1)

        return this

    }

}



readonly(PixelBot, {

    instances,

    init,
    define,
    update,
    namespace,
    exportCode,
    ctx,
    mouse,

})

getter(PixelBot, {

    frame: () => frame,
    instancesCount: () => instancesCount,

})

getterSetter(PixelBot, {

    sampling: {
        get: () => sampling,
        set: value => sampling = value,
    },

    running: {
        get: () => running,
        set: value => running = value,
    },

})
