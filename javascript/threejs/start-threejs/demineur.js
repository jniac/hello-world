
let { camera, pointer, scene } = app

// ease curves:
// https://www.desmos.com/calculator/i6kwlsrerc
let shaky = (x, f = 5, p = 3) => Math.sin(x * Math.PI * f) * ((1 - x) ** p)
// https://www.desmos.com/calculator/kpoeitak2g
let powww = (x, a = 12, b = 1) => (1 - (x ** (a * x))) * b

let xMax = 7
let yMax = 5

let numberOfBombs = 5
let numberOfTrolls = 3

document.querySelector('#bomb-total').innerText = numberOfBombs
document.querySelector('#troll-total').innerText = numberOfTrolls

let cards = []
let CardStatus = { NORMAL:0, CHECKED:1, MARKED:2 }

let getCard = (x, y) => {

	if (x < 0 || x >= xMax || y < 0 || y >= yMax)
		return null

	return cards[y * xMax + x]

}

let getNeighbors = (x, y) => [
	getCard(x - 1, y - 1),
	getCard(x + 0, y - 1),
	getCard(x + 1, y - 1),
	getCard(x + 1, y + 0),
	getCard(x + 1, y + 1),
	getCard(x + 0, y + 1),
	getCard(x - 1, y + 1),
	getCard(x - 1, y + 0),
].filter(card => card)

for (let y = 0; y < yMax; y++) {

	for(let x = 0; x < xMax; x++) {

		let card = new THREE.Mesh(
			new THREE.PlaneGeometry(),
			new THREE.MeshBasicMaterial({ color:'purple', map:app.loadTexture('assets/dots.png') }),
		)

		let verso = new THREE.Mesh(
			new THREE.PlaneGeometry(),
			new THREE.MeshBasicMaterial({ color:'#6cf' }),
		)
		verso.rotation.y = Math.PI
		card.verso = verso
		card.add(verso)

		card.position.x = (x - (xMax - 1) / 2) * 1.1
		card.position.y = (y - (yMax - 1) / 2) * 1.1

		card.reversed = false
		card.isBomb = false
		card.isTroll = false
		card.status = CardStatus.NORMAL

		Object.defineProperties(card, {

			isNormal: { get:() => card.status === CardStatus.NORMAL },
			isChecked: { get:() => card.status === CardStatus.CHECKED },
			isMarked: { get:() => card.status === CardStatus.MARKED },

		})

		card.computeBombNumber = () => card.bombNumber = getNeighbors(x, y).filter(card => card.isBomb).length

		card.reverse = () => {
			card.reversed = true
			card.fire('reverse')
			TweenMax.to(card.rotation, .5, { y:Math.PI, ease:Back.easeOut.config(1.7) })
		}


		scene.add(card)

		card.on('OVER', () => {
			if (!card.reversed)
				TweenMax.to(card.scale, .3, { x:1.12, y:1.12 })
		})
		card.on('OUT', () => {
			TweenMax.to(card.scale, .3, { x:1, y:1 })
		})
		card.on('CLICK', () => {
			if (pointer.down.keys.shift || card.status > 0) {
				card.status = (card.status + 1) % 3
				let url = 'assets/' + (card.isChecked ? 'dots+check.png' : card.isMarked ? 'dots+interrogation.png' : 'dots.png')
				card.material.map = app.loadTexture(url)
				checkVictory()
			} else {
				card.fire('flip')
				card.reverse()
			}
		})

		card.on('reverse', async () => {

			if (card.bombNumber === 0 && !card.isTroll) {
				for(let neighbor of getNeighbors(x, y).filter(card => !card.reversed)) {
					await app.wait(.1)
					neighbor.reverse()
				}
			}

		})

		cards.push(card)

	}

}



let noBombNoTrollCards = [...cards]
let bombCards = []
let trollCards = []

for (let i = 0; i < numberOfBombs; i++) {

	let randomIndex = Math.floor(Math.random() * noBombNoTrollCards.length)
	let bombCard = noBombNoTrollCards.splice(randomIndex, 1)[0]

	bombCard.verso.material.color.set('#fc0')
	bombCard.verso.material.map = app.loadTexture('assets/bomb.png')
	bombCard.isBomb = true

	bombCard.on('flip', () => {

		document.querySelector('#victory').innerText = 'Raté !'
		document.querySelector('#victory').classList.add('fail')
		boom(40, pointer.intersection.point, ['#ffcc00', 'white', 'black'])
		camShake(1.8, [{ amplitude:.4, frequence:10 }, { amplitude:.2, frequence:45 }])

	})

	bombCards.push(bombCard)

}

for (let y = 0; y < yMax; y++) {

	for(let x = 0; x < xMax; x++) {

		let card = getCard(x, y)

		card.computeBombNumber()

		if (card.isBomb == false)
			card.verso.material.map = app.loadTexture('assets/number_' + card.bombNumber + '.png')
	}

}

for (let i = 0; i < numberOfTrolls; i++) {

	let randomIndex = Math.floor(Math.random() * noBombNoTrollCards.length)
	let trollCard = noBombNoTrollCards.splice(randomIndex, 1)[0]

	trollCard.verso.material.color.set('#ffccec')
	trollCard.verso.material.map = app.loadTexture('assets/troll-face.png')
	trollCard.isTroll = true

	trollCards.push(trollCard)

	trollCard.on('flip', () => {

		boom(10, pointer.intersection.point, ['#ffccec', 'red', 'black'])
		camShake(1, [{ amplitude:.05, frequence:20 }])

	})

}



let checkVictory = () => {

	let victory = cards.every(card => (card.isBomb && card.isChecked) || (!card.isBomb && !card.isChecked))

	document.querySelector('#bomb-checked').innerText = cards.filter(card => card.isChecked).length

	if (victory) {

		document.querySelector('#victory').innerText = 'Victoire !'

		for (let card of noBombNoTrollCards)
			card.reverse()

		for(let card of bombCards)
			boom(10, card.position, ['purple', 'black', 'white'])

	}

}








let camShake = (duration = 1.8, waves = [{ amplitude:.4, frequence:10 }]) => {

	for (let wave of waves) {
		wave.angle = 2 * Math.PI * app.random()
		wave.angleDelta = 2 * Math.PI * app.random(-1, 1)
	}

	let ease = (t) => {
		camera.position.x = 0
		camera.position.y = 0

		for (let { angle, angleDelta, amplitude, frequence } of waves) {
			angle += angleDelta * t
			amplitude *= shaky(t, frequence, 5)
			camera.position.x += amplitude * Math.cos(angle)
			camera.position.y += amplitude * Math.sin(angle)
		}
	}

	TweenMax.from(camera.position, duration, { ease:ease })

}

let boomDefaultCenter = new THREE.Vector3(0, 0, 0)
let boomDefaultColors = ['red', 'blue', 'yellow']
let boom = (count = 10, center = boomDefaultCenter, colors = boomDefaultColors) => {

	for (let i = 0; i < count; i++) {

		let color = app.random(colors)
		let mapUrl = app.random(['assets/art_Cross-Bold.png', 'assets/art_Cross-Normal.png'])

		let p = new app.Particle(
			new THREE.PlaneGeometry(),
			new THREE.MeshBasicMaterial({ color:color, map:app.loadTexture(mapUrl), transparent:true }),
		)

		let size = app.random(.1, 1)

		p.update = () => {
			let s = powww(p.tProgress) * size
			p.scale.set(s, s, s)
		}

		p.position.copy(center)
		p.rotation.z = Math.PI * app.random(-1, 1)

		p.friction = app.random(.95, .99)
		p.tMax = app.random(.5, 1)

		let velocity = app.random(3, 9)
		let angle = app.random(0, Math.PI * 2)
		p.velocity.x = velocity * Math.cos(angle)
		p.velocity.y = velocity * Math.sin(angle)

		p.rotationVelocity.z = 2 * Math.PI * app.random(-1, 1)
	}

}

// cards.forEach(card => card.rotation.y = Math.PI)
