import assert from 'assert'
import { fileURLToPath } from 'node:url'
import { scanEmoji } from '../index.js'

describe('=== markdown-it-emoji-customizer ===\n', function () {
  describe('-- scanEmoji(fixtureDir, baseUrl) --\n', function () {
    it('should build an emoji definition object from the fixture directory', async function () {
      // the fixtures (simulated emoji packs)
      const fixtureDir = fileURLToPath(
        new URL('fixtures/emoji', import.meta.url),
      )
      // the baseUrl of where the emoji would hypothetically be on the site
      const baseUrl = '/img/emoji/'

      // print inputs
      console.log('--- input ---')
      console.log('- fixtureDir:', fixtureDir)
      console.log('- baseUrl:', baseUrl)
      console.log('-------------\n')

      // create the emojiDefs from scanEmoji(fixtureDir, baseUrl)
      const emojiDefs = await scanEmoji(fixtureDir, baseUrl)
      // print them
      console.log('\nEmoji Definitions:', JSON.stringify(emojiDefs, null, 2))

      // /fixtures/emoji/pack1/blank.png,
      // key should be 'collection1_blank' and value should be '/img/emoji/pack1/blank.png'
      assert.ok(emojiDefs['pack1_blank'], '"pack1_blank" key not found')
      assert.strictEqual(
        emojiDefs['pack1_blank'], // the emojiDef to check
        '/img/emoji/pack1/blank.png', // what the value should be
        'expected correct URL', // the error message if it's not
      )

      // /fixtures/emoji/pack2/blank.png,
      // key should be 'pack2_blank' and value should be '/img/emoji/pack2/blank.png'
      assert.ok(emojiDefs['pack2_blank'], '"pack2_blank" key not found')
      assert.strictEqual(
        emojiDefs['pack2_blank'], // the emojiDef to check
        '/img/emoji/pack2/blank.png', // what the value should be
        'expected correct URL', // the error message if it's not
      )
    })
  })
})
